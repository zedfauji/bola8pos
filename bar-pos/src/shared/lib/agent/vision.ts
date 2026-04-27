import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@shared/lib/logger';

export interface ExtractedProduct {
  name: string;
  price: number;
}

function getApiKey(): string {
  return (import.meta.env['VITE_ANTHROPIC_API_KEY'] as string | undefined) ?? '';
}

function getModel(): string {
  return (import.meta.env['VITE_AGENT_MODEL'] as string | undefined) ?? 'claude-sonnet-4-6';
}

const EXTRACTION_PROMPT =
  'Extract all menu items. Return ONLY valid JSON: [{"name":"...","price":0.0}]. No explanation.';

function parseProducts(responseText: string): ExtractedProduct[] {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : responseText.trim();
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return [];
    const products: ExtractedProduct[] = [];
    for (const item of parsed) {
      if (
        item !== null &&
        typeof item === 'object' &&
        'name' in item &&
        'price' in item &&
        typeof (item as Record<string, unknown>)['name'] === 'string' &&
        typeof (item as Record<string, unknown>)['price'] === 'number'
      ) {
        products.push({
          name: (item as { name: string; price: number }).name,
          price: (item as { name: string; price: number }).price,
        });
      }
    }
    return products;
  } catch {
    return [];
  }
}

export async function extractProductsFromImage(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<ExtractedProduct[]> {
  try {
    const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    if (!textBlock) return [];
    return parseProducts(textBlock.text);
  } catch (e) {
    logger.warn('vision.extractProductsFromImage.failed', { detail: String(e) });
    return [];
  }
}

export async function extractProductsFromText(text: string): Promise<ExtractedProduct[]> {
  try {
    const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${text}\n\n${EXTRACTION_PROMPT}`,
        },
      ],
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    if (!textBlock) return [];
    return parseProducts(textBlock.text);
  } catch (e) {
    logger.warn('vision.extractProductsFromText.failed', { detail: String(e) });
    return [];
  }
}
