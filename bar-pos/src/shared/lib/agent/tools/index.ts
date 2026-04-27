import { getMenu, addProduct, updateProduct, deactivateProduct, bulkImportProducts, menuToolDefinitions } from './menuTools';
import { generateSalesReport, getDailySummary, getTopProducts, reportToolDefinitions } from './reportTools';
import { checkDbConnection, getRecentErrors, getAgentAuditLog, runDiagnostic, generateDiagnosticReport, diagnosticToolDefinitions } from './diagnosticTools';
import { getPosStatus, getCurrentShift, systemToolDefinitions } from './systemTools';
import type { AgentActionContext } from '@shared/lib/telemetry';
import type { Result } from '@shared/lib/result';
import { err } from '@shared/lib/result';

export const allToolDefinitions = [
  ...menuToolDefinitions,
  ...reportToolDefinitions,
  ...diagnosticToolDefinitions,
  ...systemToolDefinitions,
];

// Tools that require user confirmation before execution
export const DESTRUCTIVE_TOOLS = new Set(['deactivate_product', 'bulk_import_products', 'delete_tab']);

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  switch (name) {
    case 'get_menu':              return getMenu(args as { category_id?: string }, ctx);
    case 'add_product':           return addProduct(args as { name: string; price: number; category_id?: string; description?: string }, ctx);
    case 'update_product':        return updateProduct(args as { id: string; name?: string; price?: number; description?: string }, ctx);
    case 'deactivate_product':    return deactivateProduct(args as { id: string }, ctx);
    case 'bulk_import_products':  return bulkImportProducts(args as { products: Array<{ name: string; price: number; category_id?: string }> }, ctx);
    case 'generate_sales_report': return generateSalesReport(args as { from: string; to: string }, ctx);
    case 'get_daily_summary':     return getDailySummary({} as Record<string, never>, ctx);
    case 'get_top_products':      return getTopProducts(args as { limit?: number; days?: number }, ctx);
    case 'check_db_connection':   return checkDbConnection({} as Record<string, never>, ctx);
    case 'get_recent_errors':     return getRecentErrors(args as { days?: number; limit?: number }, ctx);
    case 'get_agent_audit_log':   return getAgentAuditLog(args as { days?: number; limit?: number }, ctx);
    case 'run_diagnostic':               return runDiagnostic({} as Record<string, never>, ctx);
    case 'generate_diagnostic_report':   return generateDiagnosticReport({} as Record<string, never>, ctx);
    case 'get_pos_status':        return getPosStatus({} as Record<string, never>, ctx);
    case 'get_current_shift':     return getCurrentShift({} as Record<string, never>, ctx);
    default:
      return err({ code: 'TOOL_EXECUTION_ERROR' as const, message: `Unknown tool: ${name}` });
  }
}
