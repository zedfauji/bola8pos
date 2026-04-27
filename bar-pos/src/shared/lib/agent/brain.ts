import Anthropic from '@anthropic-ai/sdk';
import { retrieveContext } from './rag';
import { allToolDefinitions, executeTool, DESTRUCTIVE_TOOLS } from './tools/index';
import { logger } from '@shared/lib/logger';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResult {
  text: string;
  toolsExecuted: string[];
  usedFallback: boolean;
  awaitingConfirmation: boolean;
}

// ─── Config (lazy reads — vi.stubEnv works in tests) ─────────────────────────

function getApiKey(): string {
  return (import.meta.env['VITE_ANTHROPIC_API_KEY'] as string | undefined) ?? '';
}

function getModel(): string {
  return (import.meta.env['VITE_AGENT_MODEL'] as string | undefined) ?? 'claude-sonnet-4-6';
}

function getOllamaUrl(): string {
  return (import.meta.env['VITE_OLLAMA_URL'] as string | undefined) ?? 'http://localhost:11434';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_TOOL_LOOPS = 8;
const CONFIRM_WORDS = new Set(['confirm', 'confirmar', 'yes', 'sí', 'si']);

function detectLanguage(text: string): 'es' | 'en' {
  const spanishPattern =
    /\b(el|la|los|las|un|una|de|en|que|es|por|con|para|como|del|al|se|no|si|ya|su|le|más|pero|este|esta|hay|cómo|cuánto|cuántos|qué|tienes|tiene)\b/i;
  const matches = text.match(spanishPattern);
  return matches && matches.length >= 2 ? 'es' : 'en';
}

function isConfirmation(message: string): boolean {
  return CONFIRM_WORDS.has(message.trim().toLowerCase());
}

function buildSystemPrompt(userRole: string, ragContext: string, lang: 'es' | 'en'): string {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
  const langLine =
    lang === 'es'
      ? 'Respond in Spanish. Be concise and professional.'
      : 'Respond in English. Be concise and professional.';

  const parts = [
    'You are the AI assistant for Bola 8 POS, a bar and restaurant point-of-sale system.',
    `Current date/time: ${now}`,
    `User role: ${userRole}`,
    langLine,
    '',
    'You have tools to manage tabs, pool tables, the menu, reports, diagnostics, and system status.',
    '',
    'TOOL RULES — follow strictly:',
    '1. NEVER invent UUIDs. Always call get_menu (or list_tabs / list_pool_tables) first to obtain real IDs before calling any write tool.',
    '2. For add_items_to_tab: call get_menu first, match product by name, use the real product_id UUID from the result.',
    '3. For destructive tools (close_tab, stop_pool_session, stop_and_move_table, deactivate_product, bulk_import_products):',
    '   Describe what you will do and ask for confirmation. Do NOT call the tool in the same turn.',
    '   Only proceed when the user replies "confirm" or "confirmar".',
    '4. If a tool returns an error, report the exact error message to the user. Do not retry silently.',
  ];

  if (ragContext) parts.push('', ragContext);

  return parts.join('\n');
}

// ─── Ollama fallback ──────────────────────────────────────────────────────────

async function runOllamaFallback(
  userMessage: string,
  history: Message[],
  userRole: string
): Promise<string> {
  const system = [
    'You are the AI assistant for Bola 8 POS.',
    `User role: ${userRole}`,
    'You are in offline mode. Answer questions concisely. You cannot execute tools.',
    'If the user asks you to perform an action, inform them you are in offline mode.',
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const resp = await fetch(`${getOllamaUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2:3b-instruct-q4_K_M', messages, stream: false }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);

  const json = (await resp.json()) as { message?: { content?: string } };
  return json.message?.content ?? '(no response from fallback model)';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  userRole: string,
  conversationHistory: Message[],
  userId?: string
): Promise<AgentResult> {
  const lang = detectLanguage(userMessage);
  const toolsExecuted: string[] = [];

  let ragContext = '';
  try {
    ragContext = await retrieveContext(userMessage);
  } catch {
    // RAG is best-effort — continue without it
  }

  const systemPrompt = buildSystemPrompt(userRole, ragContext, lang);

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });

  let attempt = 0;
  while (attempt < 2) {
    try {
      let response = await client.messages.create({
        model: getModel(),
        max_tokens: 1024,
        system: systemPrompt,
        tools: allToolDefinitions as unknown as Anthropic.Tool[],
        messages,
      });

      let loopCount = 0;
      while (response.stop_reason === 'tool_use' && loopCount < MAX_TOOL_LOOPS) {
        loopCount++;

        const toolBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Append assistant turn before processing tools
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolBlocks) {
          // Confirmation gate — check the current user message, not history
          if (DESTRUCTIVE_TOOLS.has(block.name) && !isConfirmation(userMessage)) {
            const prompt =
              lang === 'es'
                ? `Voy a ejecutar "${block.name}". ¿Confirmas? Responde "confirmar" para continuar.`
                : `About to run "${block.name}". Reply "confirm" to proceed.`;
            return { text: prompt, toolsExecuted, usedFallback: false, awaitingConfirmation: true };
          }

          const ctx = { userId, userRole, durationMs: undefined };
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            ctx
          );
          toolsExecuted.push(block.name);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result.ok ? result.data : result.error),
          });
        }

        messages.push({ role: 'user', content: toolResults });

        response = await client.messages.create({
          model: getModel(),
          max_tokens: 1024,
          system: systemPrompt,
          tools: allToolDefinitions as unknown as Anthropic.Tool[],
          messages,
        });
      }

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return {
        text: textBlock?.text ?? '',
        toolsExecuted,
        usedFallback: false,
        awaitingConfirmation: false,
      };
    } catch (e) {
      attempt++;
      logger.warn('brain.runAgent.claude_error', { attempt, detail: String(e) });
      if (attempt < 2) continue;
    }
  }

  // Ollama fallback after 2 Claude failures
  logger.warn('brain.runAgent.ollama_fallback', { userRole });
  try {
    const text = await runOllamaFallback(userMessage, conversationHistory, userRole);
    return { text, toolsExecuted, usedFallback: true, awaitingConfirmation: false };
  } catch (fallbackErr) {
    logger.warn('brain.runAgent.fallback_failed', { detail: String(fallbackErr) });
    const text =
      lang === 'es'
        ? 'El asistente no está disponible en este momento. Intenta de nuevo más tarde.'
        : 'The assistant is currently unavailable. Please try again later.';
    return { text, toolsExecuted, usedFallback: true, awaitingConfirmation: false };
  }
}
