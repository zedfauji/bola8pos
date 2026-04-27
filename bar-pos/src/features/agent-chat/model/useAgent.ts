import { useStaffStore } from '@entities/staff/model/store';
import { runAgent } from '@shared/lib/agent/brain';
import type { Message } from '@shared/lib/agent/brain';
import { parseProductsCsv } from '@shared/lib/agent/csv-parser';
import { executeTool } from '@shared/lib/agent/tools/index';
import { extractProductsFromImage, extractProductsFromText } from '@shared/lib/agent/vision';
import { logger } from '@shared/lib/logger';
import { useAgentStore } from './agentStore';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve(reader.result as string); };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function useAgent() {
  const state = useAgentStore();
  const userRole = useStaffStore((s) => s.currentStaff?.role ?? 'bartender');

  const sendMessage = async (text: string): Promise<void> => {
    const conversationHistory: Message[] = useAgentStore.getState().messages;

    const userMessage: Message = { role: 'user', content: text };
    state.addMessage(userMessage);
    state.setTyping(true);

    try {
      const result = await runAgent(text, userRole, conversationHistory);

      state.setAwaitingConfirmation(result.awaitingConfirmation);

      const assistantMessage: Message = { role: 'assistant', content: result.text };
      state.addMessage(assistantMessage);

      if (!useAgentStore.getState().isOpen) {
        useAgentStore.setState({ hasUnread: true });
      }

      if (result.toolsExecuted.length > 0) {
        logger.info('agent.tools.executed', { tools: result.toolsExecuted.join(',') });
      }
    } catch (e) {
      logger.error('agent.sendMessage.failed', { role: userRole }, e);
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
      };
      state.addMessage(errorMessage);
    } finally {
      state.setTyping(false);
    }
  };

  const handleFileImport = async (file: File): Promise<void> => {
    state.addMessage({ role: 'user', content: `📎 ${file.name}` });
    state.setTyping(true);

    try {
      let products: Array<{ name: string; price: number }> = [];

      if (file.type === 'image/jpeg') {
        const base64 = await readFileAsBase64(file);
        products = await extractProductsFromImage(base64, 'image/jpeg');
      } else if (file.type === 'image/png') {
        const base64 = await readFileAsBase64(file);
        products = await extractProductsFromImage(base64, 'image/png');
      } else if (file.type === 'image/gif') {
        const base64 = await readFileAsBase64(file);
        products = await extractProductsFromImage(base64, 'image/gif');
      } else if (file.type === 'image/webp') {
        const base64 = await readFileAsBase64(file);
        products = await extractProductsFromImage(base64, 'image/webp');
      } else if (file.type === 'text/csv') {
        const text = await readFileAsText(file);
        products = parseProductsCsv(text);
      } else if (file.type === 'application/pdf') {
        const base64 = await readFileAsBase64(file);
        products = await extractProductsFromText(base64);
      }

      if (products.length > 0) {
        state.setPendingImportProducts(products);
        const preview = products
          .slice(0, 5)
          .map((p) => `| ${p.name} | $${p.price.toFixed(2)} |`)
          .join('\n');
        const header = '| Nombre | Precio |\n|--------|--------|';
        const remaining = products.length - 5;
        const more = products.length > 5 ? `\n\n...y ${String(remaining)} más` : '';
        const count = String(products.length);
        const plural = products.length !== 1 ? 's' : '';
        state.addMessage({
          role: 'assistant',
          content: `${header}\n${preview}${more}\n\nHaz clic en **Confirmar** para importar ${count} producto${plural}.`,
        });
      } else {
        state.addMessage({
          role: 'assistant',
          content: 'No encontré productos en el archivo.',
        });
      }
    } catch (e) {
      logger.error('agent.handleFileImport.failed', { fileName: file.name }, e);
      state.addMessage({
        role: 'assistant',
        content: 'No encontré productos en el archivo.',
      });
    } finally {
      state.setTyping(false);
    }
  };

  const confirmImport = async (): Promise<void> => {
    const products = useAgentStore.getState().pendingImportProducts;
    if (!products) return;

    state.setTyping(true);
    state.setPendingImportProducts(null);

    try {
      const ctx = { userId: undefined, userRole, durationMs: undefined };
      const result = await executeTool('bulk_import_products', { products }, ctx);

      const count = String(products.length);
      const plural = products.length !== 1 ? 's' : '';

      if (result.ok) {
        state.addMessage({
          role: 'assistant',
          content: `✅ ${count} producto${plural} importado${plural} correctamente.`,
        });
      } else {
        state.addMessage({
          role: 'assistant',
          content: `❌ Error al importar: ${result.error.message}`,
        });
      }
    } catch (e) {
      logger.error('agent.confirmImport.failed', {}, e);
      state.addMessage({
        role: 'assistant',
        content: `❌ Error al importar: ${String(e)}`,
      });
    } finally {
      state.setTyping(false);
    }
  };

  return {
    isOpen: state.isOpen,
    messages: state.messages,
    isTyping: state.isTyping,
    awaitingConfirmation: state.awaitingConfirmation,
    hasUnread: state.hasUnread,
    pendingImportProducts: state.pendingImportProducts,
    open: state.open,
    close: state.close,
    toggle: state.toggle,
    markRead: state.markRead,
    clearMessages: state.clearMessages,
    setPendingImportProducts: state.setPendingImportProducts,
    sendMessage,
    handleFileImport,
    confirmImport,
  };
}
