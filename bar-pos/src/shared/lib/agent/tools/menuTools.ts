import { supabase } from '@shared/lib/supabase';
import { logAgentAction } from '@shared/lib/telemetry';
import { ok, err } from '@shared/lib/result';
import type { Result } from '@shared/lib/result';
import type { AgentActionContext } from '@shared/lib/telemetry';

// Agent mutations use runtime-provided fields — cast to bypass strict Supabase generated types
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Tool Definitions (Claude API format) ────────────────────────────────────

export const menuToolDefinitions = [
  {
    name: 'get_menu',
    description: 'Returns the full list of active products in the POS menu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category_id: { type: 'string', description: 'Optional: filter by category UUID' },
      },
      required: [],
    },
  },
  {
    name: 'add_product',
    description: 'Creates a new product in the menu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        category_id: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name', 'price'],
    },
  },
  {
    name: 'update_product',
    description: 'Updates an existing product by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'deactivate_product',
    description: 'Soft-deletes a product by setting is_active=false. Requires confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bulk_import_products',
    description: 'Inserts multiple products at once. Requires confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              category_id: { type: 'string' },
            },
            required: ['name', 'price'],
          },
        },
      },
      required: ['products'],
    },
  },
] as const;

// ─── Implementations ─────────────────────────────────────────────────────────

export async function getMenu(
  args: { category_id?: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  let q = supabase.from('products').select('id, name, base_price, description, category_id').is('deleted_at', null);
  if (args.category_id) q = q.eq('category_id', args.category_id);
  const { data, error } = await q;
  const result = error ? err({ code: 'AGENT_ERROR' as const, message: error.message }) : ok(data);
  void logAgentAction('get_menu', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return result;
}

export async function addProduct(
  args: { name: string; price: number; category_id?: string; description?: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const { data, error } = await db.from('products').insert({ name: args.name, base_price: args.price, category_id: args.category_id ?? null, ...(args.description ? { description: args.description } : {}) }).select().single();
  const result = error ? err({ code: 'AGENT_ERROR' as const, message: error.message }) : ok(data);
  void logAgentAction('add_product', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return result;
}

export async function updateProduct(
  args: { id: string; name?: string; price?: number; description?: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) patch['name'] = args.name;
  if (args.price !== undefined) patch['price'] = args.price;
  if (args.description !== undefined) patch['description'] = args.description;
  if (patch['price'] !== undefined) { patch['base_price'] = patch['price']; delete patch['price']; }
  const { data, error } = await db.from('products').update(patch).eq('id', args.id).select().single();
  const result = error ? err({ code: 'AGENT_ERROR' as const, message: error.message }) : ok(data);
  void logAgentAction('update_product', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return result;
}

export async function deactivateProduct(
  args: { id: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const { data, error } = await db.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', args.id).select().single();
  const result = error ? err({ code: 'AGENT_ERROR' as const, message: error.message }) : ok(data);
  void logAgentAction('deactivate_product', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return result;
}

export async function bulkImportProducts(
  args: { products: Array<{ name: string; price: number; category_id?: string }> },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const rows = args.products.map((p) => ({ name: p.name, base_price: p.price, category_id: p.category_id ?? null }));
  const { data, error } = await db.from('products').insert(rows).select();
  const result = error ? err({ code: 'AGENT_ERROR' as const, message: error.message }) : ok(data);
  void logAgentAction('bulk_import_products', args as Record<string, unknown>, { count: rows.length }, { ...ctx, durationMs: Date.now() - t0 });
  return result;
}
