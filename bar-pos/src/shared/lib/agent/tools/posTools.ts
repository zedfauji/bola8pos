import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import { ok, err } from '@shared/lib/result';
import type { Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { logAgentAction } from '@shared/lib/telemetry';
import type { AgentActionContext } from '@shared/lib/telemetry';
import { createPendingAction } from '../pendingActions';


// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const posToolDefinitions = [
  // ── Tab reads ──
  {
    name: 'list_tabs',
    description: 'Lists all currently open tabs with customer name, table number, and item count.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_tab',
    description: 'Returns full details of a single tab including all order items.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id: { type: 'string', description: 'UUID of the tab' },
      },
      required: ['tab_id'],
    },
  },
  // ── Tab writes ──
  {
    name: 'open_tab',
    description: 'Opens a new tab for a customer. Requires an open caja session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string' },
        table_number:  { type: 'number', description: 'Omit for bar / no-table orders' },
        notes:         { type: 'string' },
      },
      required: ['customer_name'],
    },
  },
  {
    name: 'close_tab',
    description: 'Previews closing an open tab and creates a confirmation token. Call confirm_action to execute.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id: { type: 'string', description: 'UUID from list_tabs or find_tab' },
      },
      required: ['tab_id'],
    },
  },
  {
    name: 'add_items_to_tab',
    description: 'Adds products to a tab. Use find_product to get real product_id — never invent IDs. Price is always fetched from DB.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Real UUID from get_menu or find_product' },
              quantity:   { type: 'number' },
            },
            required: ['product_id', 'quantity'],
          },
        },
        notes: { type: 'string' },
      },
      required: ['tab_id', 'items'],
    },
  },
  {
    name: 'transfer_tab',
    description: 'Transfers a tab to a different staff member or table number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id:           { type: 'string' },
        new_staff_id:     { type: 'string', description: 'UUID of new staff owner (optional)' },
        new_table_number: { type: 'number', description: 'New table number (optional)' },
      },
      required: ['tab_id'],
    },
  },
  // ── Pool table reads ──
  {
    name: 'list_pool_tables',
    description: 'Lists all pool tables with current status, session start time, and linked tab.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  // ── Pool table writes ──
  {
    name: 'start_pool_session',
    description: 'Starts a pool timer on a table. Auto-creates a new tab named "Pool <label>" if tab_id is omitted. Requires open caja session and active shift.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table_id: { type: 'string', description: 'UUID from list_pool_tables or find_pool_table' },
        tab_id:   { type: 'string', description: 'UUID of existing tab to link (optional)' },
      },
      required: ['table_id'],
    },
  },
  {
    name: 'stop_pool_session',
    description: 'Previews stopping an active pool session with billing and creates a confirmation token. Call confirm_action to execute.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id:    { type: 'string', description: 'UUID of the active session' },
        table_id:      { type: 'string', description: 'UUID of the pool table' },
        rate_per_hour: { type: 'number', description: 'Billing rate in pesos/hour' },
      },
      required: ['session_id', 'table_id', 'rate_per_hour'],
    },
  },
  {
    name: 'assign_session_to_tab',
    description: 'Links an active pool session to a tab.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' },
        tab_id:     { type: 'string' },
      },
      required: ['session_id', 'tab_id'],
    },
  },
  {
    name: 'stop_and_move_table',
    description: 'Previews stopping a pool session and moving the tab to a regular table. Call confirm_action to execute.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id:       { type: 'string' },
        table_id:         { type: 'string' },
        tab_id:           { type: 'string' },
        rate_per_hour:    { type: 'number' },
        new_table_number: { type: 'number' },
      },
      required: ['session_id', 'table_id', 'tab_id', 'rate_per_hour', 'new_table_number'],
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveStaffContext(
  userId: string | undefined
): Promise<{ staffId: string; shiftId: string } | null> {
  if (userId) {
    const { data } = await supabase
      .from('shifts')
      .select('id, staff_id')
      .eq('staff_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { staffId: data.staff_id, shiftId: data.id };
  }
  const { data } = await supabase
    .from('shifts')
    .select('id, staff_id')
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { staffId: data.staff_id, shiftId: data.id };
}

async function resolveOpenCajaId(): Promise<string | null> {
  const { data } = await supabase
    .from('caja_sessions')
    .select('id')
    .is('closed_at', null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Returns error message string if row not found, null if OK.
// Dynamic table name requires a local any cast — caller validates table names.
async function assertExists(
  table: string,
  id: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any) // dynamic table name cannot be statically typed
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('id', id);
  return ((count as number | null) ?? 0) > 0 ? null : `No ${table} row with id ${id}`;
}

// ─── Tab implementations ──────────────────────────────────────────────────────

export async function listTabs(
  _args: Record<string, never>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const { data, error } = await supabase
    .from('tabs')
    .select('id, customer_name, table_number, status, opened_at, staff_id')
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('opened_at', { ascending: false });

  if (error) {
    void logAgentAction('list_tabs', {}, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('list_tabs', {}, { count: data?.length }, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

export async function getTab(
  args: { tab_id: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const missing = await assertExists('tabs', args.tab_id);
  if (missing) return err({ code: 'NOT_FOUND' as const, message: missing });

  const { data, error } = await supabase
    .from('tabs')
    .select(`
      id, customer_name, table_number, status, opened_at, notes,
      order_items ( id, product_id, quantity, unit_price, notes,
        products ( name )
      )
    `)
    .eq('id', args.tab_id)
    .is('deleted_at', null)
    .single();

  if (error) {
    void logAgentAction('get_tab', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('get_tab', args, data, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

export async function openTab(
  args: { customer_name: string; table_number?: number; notes?: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const staff = await resolveStaffContext(ctx.userId);
  if (!staff) return err({ code: 'AGENT_ERROR' as const, message: 'No active shift. Clock in first.' });

  const cajaId = await resolveOpenCajaId();
  if (!cajaId) return err({ code: 'CAJA_CLOSED' as const, message: 'No open caja session. Open caja first.' });

  const { data, error } = await supabase
    .from('tabs')
    .insert({
      customer_name:   args.customer_name,
      table_number:    args.table_number ?? null,
      staff_id:        staff.staffId,
      shift_id:        staff.shiftId,
      status:          'open',
      notes:           args.notes ?? null,
      caja_session_id: cajaId,
    })
    .select('id, customer_name, table_number, status, opened_at')
    .single();

  if (error) {
    void logAgentAction('open_tab', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('open_tab', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

// Internal executor — called by confirm_action
export async function _executeCloseTab(
  args: Record<string, unknown>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const { tab_id } = args as { tab_id: string };
  const t0 = Date.now();

  const { count } = await supabase
    .from('pool_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('tab_id', tab_id)
    .is('stopped_at', null);

  if ((count ?? 0) > 0) {
    return err({ code: 'SESSION_STILL_RUNNING' as const, message: 'Active pool session on this tab. Stop the session first.' });
  }

  const { data, error } = await supabase
    .from('tabs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', tab_id)
    .eq('status', 'open')
    .select('id, status, closed_at')
    .single();

  if (error) {
    void logAgentAction('close_tab', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('close_tab', args, data, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

// Public tool — builds preview + pending action
export async function closeTab(
  args: { tab_id: string },
  _ctx: AgentActionContext
): Promise<Result<unknown>> {
  const missing = await assertExists('tabs', args.tab_id);
  if (missing) return err({ code: 'NOT_FOUND' as const, message: missing });

  const { data: tab } = await supabase
    .from('tabs')
    .select('customer_name, table_number, status')
    .eq('id', args.tab_id)
    .single();

  if ((tab as { status?: string } | null)?.status !== 'open') {
    return err({ code: 'AGENT_ERROR' as const, message: 'Tab is not open.' });
  }

  const preview = {
    action: 'close_tab',
    tab_id: args.tab_id,
    customer_name: (tab as { customer_name?: string } | null)?.customer_name,
    table_number:  (tab as { table_number?: number } | null)?.table_number,
  };

  const token = createPendingAction('close_tab', args as Record<string, unknown>, preview, _executeCloseTab);
  return ok({ pending: true, confirm_token: token, preview });
}

export async function addItemsToTab(
  args: {
    tab_id: string;
    items: Array<{ product_id: string; quantity: number }>;
    notes?: string;
  },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  // Pre-flight: tab must exist
  const tabMissing = await assertExists('tabs', args.tab_id);
  if (tabMissing) return err({ code: 'NOT_FOUND' as const, message: tabMissing });

  // Pre-flight: all product IDs must exist
  const productIds = args.items.map((i) => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, base_price')
    .in('id', productIds)
    .is('deleted_at', null);

  if (prodErr) return err({ code: 'AGENT_ERROR' as const, message: prodErr.message });

  const foundIds = new Set((products ?? []).map((p) => p.id));
  const missing = productIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return err({ code: 'NOT_FOUND' as const, message: `Products not found: ${missing.join(', ')}. Use find_product to get real IDs.` });
  }

  const staff = await resolveStaffContext(ctx.userId);
  if (!staff) return err({ code: 'AGENT_ERROR' as const, message: 'No active shift. Clock in first.' });

  // Build price map — DB price always wins over any Claude-supplied value
  const priceMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.base_price]));

  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_tab_id:         args.tab_id,
    p_staff_id:       staff.staffId,
    p_status:         'pending',
    p_notes:          args.notes ?? '',
    p_items:          args.items.map((i) => ({
      product_id:           i.product_id,
      quantity:             i.quantity,
      unit_price:           priceMap[i.product_id] ?? 0,
      modifier_ids:         [],
      modifier_price_delta: 0,
      notes:                '',
    })),
    p_skip_depletion: false,
  });

  if (error) {
    void logAgentAction('add_items_to_tab', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }

  void logAgentAction('add_items_to_tab', args as Record<string, unknown>, { tab_id: args.tab_id, item_count: args.items.length }, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

export async function transferTab(
  args: { tab_id: string; new_staff_id?: string; new_table_number?: number },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const tabMissing = await assertExists('tabs', args.tab_id);
  if (tabMissing) return err({ code: 'NOT_FOUND' as const, message: tabMissing });

  if (args.new_staff_id) {
    const staffMissing = await assertExists('profiles', args.new_staff_id);
    if (staffMissing) return err({ code: 'NOT_FOUND' as const, message: staffMissing });
  }

  const staff = await resolveStaffContext(ctx.userId);

  const { data, error } = await supabase.rpc('transfer_tab', {
    p_tab_id:         args.tab_id,
    p_transferred_by: staff?.staffId ?? '',
    ...(args.new_staff_id !== undefined ? { p_to_staff_id: args.new_staff_id } : {}),
    ...(args.new_table_number !== undefined ? { p_to_table: args.new_table_number } : {}),
  });

  if (error) {
    void logAgentAction('transfer_tab', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('transfer_tab', args as Record<string, unknown>, data, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

// ─── Pool table implementations ───────────────────────────────────────────────

export async function listPoolTables(
  _args: Record<string, never>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
  const { data, error } = await supabase
    .from('pool_tables')
    .select(`
      id, label, status, rate_per_hour, current_session_id,
      pool_sessions ( id, started_at, tab_id, stopped_at )
    `)
    .order('label', { ascending: true });

  if (error) {
    void logAgentAction('list_pool_tables', {}, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('list_pool_tables', {}, { count: data?.length }, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

export async function startPoolSession(
  args: { table_id: string; tab_id?: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const tableMissing = await assertExists('pool_tables', args.table_id);
  if (tableMissing) return err({ code: 'NOT_FOUND' as const, message: tableMissing });

  if (args.tab_id) {
    const tabMissing = await assertExists('tabs', args.tab_id);
    if (tabMissing) return err({ code: 'NOT_FOUND' as const, message: tabMissing });
  }

  let resolvedTabId: string | null = args.tab_id ?? null;

  if (!resolvedTabId) {
    const staff = await resolveStaffContext(ctx.userId);
    if (!staff) return err({ code: 'AGENT_ERROR' as const, message: 'No active shift. Clock in first.' });

    const cajaId = await resolveOpenCajaId();
    if (!cajaId) return err({ code: 'CAJA_CLOSED' as const, message: 'No open caja session. Open caja first.' });

    const { data: tableRow } = await supabase
      .from('pool_tables')
      .select('label')
      .eq('id', args.table_id)
      .single();
    const label = (tableRow as { label?: string } | null)?.label?.trim() ?? args.table_id;

    const { data: newTab, error: tabErr } = await supabase
      .from('tabs')
      .insert({
        customer_name:   `Pool ${label}`,
        table_number:    null,
        staff_id:        staff.staffId,
        shift_id:        staff.shiftId,
        status:          'open',
        notes:           null,
        caja_session_id: cajaId,
      })
      .select('id')
      .single();

    if (tabErr || !newTab) {
      void logAgentAction('start_pool_session', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
      return err({ code: 'AGENT_ERROR' as const, message: tabErr?.message ?? 'Failed to create tab' });
    }
    resolvedTabId = newTab.id;
  }

  const { data: session, error: insertErr } = await supabase
    .from('pool_sessions')
    .insert({ table_id: args.table_id, tab_id: resolvedTabId })
    .select()
    .single();

  if (insertErr) {
    void logAgentAction('start_pool_session', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: insertErr.message });
  }

  const { error: tableErr } = await supabase
    .from('pool_tables')
    .update({ status: 'occupied', current_session_id: session.id })
    .eq('id', args.table_id);

  if (tableErr) {
    void logAgentAction('start_pool_session', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: tableErr.message });
  }

  const result = { ...session, tab_id: resolvedTabId };
  void logAgentAction('start_pool_session', args as Record<string, unknown>, result, { ...ctx, durationMs: Date.now() - t0 });
  return ok(result);
}

// Internal executor for stop_pool_session
export async function _executeStopPoolSession(
  args: Record<string, unknown>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const { session_id, table_id, rate_per_hour } = args as { session_id: string; table_id: string; rate_per_hour: number };
  const t0 = Date.now();

  const { data: session, error: fetchErr } = await supabase
    .from('pool_sessions')
    .select('id, started_at')
    .eq('id', session_id)
    .single();

  if (fetchErr || !session) {
    return err({ code: 'NOT_FOUND' as const, message: `Session not found: ${fetchErr?.message ?? 'null'}` });
  }

  const { data: billingSettings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'billing')
    .maybeSingle();
  const firstHourMode: 'full' | 'prorated' =
    (billingSettings?.value as Record<string, unknown> | null)?.['firstHourMode'] === 'full'
      ? 'full'
      : 'prorated';

  const stoppedAt = new Date();
  const { billedMinutes, totalCharge } = computePoolSessionBilling({
    startedAt:    new Date(session.started_at),
    endTime:      stoppedAt,
    ratePerHour:  rate_per_hour,
    firstHourMode,
  });

  const { data: updated, error: sessionErr } = await supabase
    .from('pool_sessions')
    .update({ stopped_at: stoppedAt.toISOString(), billed_minutes: billedMinutes, total_charge: totalCharge })
    .eq('id', session_id)
    .select()
    .single();

  if (sessionErr) {
    void logAgentAction('stop_pool_session', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: sessionErr.message });
  }

  const { error: tableErr } = await supabase
    .from('pool_tables')
    .update({ status: 'available', current_session_id: null })
    .eq('id', table_id);

  if (tableErr) {
    void logAgentAction('stop_pool_session', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: tableErr.message });
  }

  const result = { ...updated, billed_minutes: billedMinutes, total_charge: totalCharge };
  void logAgentAction('stop_pool_session', args, result, { ...ctx, durationMs: Date.now() - t0 });
  return ok(result);
}

// Public tool — builds preview + pending action
export async function stopPoolSession(
  args: { session_id: string; table_id: string; rate_per_hour: number },
  _ctx: AgentActionContext
): Promise<Result<unknown>> {
  const sessionMissing = await assertExists('pool_sessions', args.session_id);
  if (sessionMissing) return err({ code: 'NOT_FOUND' as const, message: sessionMissing });

  const tableMissing = await assertExists('pool_tables', args.table_id);
  if (tableMissing) return err({ code: 'NOT_FOUND' as const, message: tableMissing });

  const { data: session } = await supabase
    .from('pool_sessions')
    .select('started_at, tab_id')
    .eq('id', args.session_id)
    .single();

  const startedAt = new Date((session as { started_at?: string } | null)?.started_at ?? Date.now());
  const elapsedMinutes = Math.ceil((Date.now() - startedAt.getTime()) / 60_000);
  const estimatedCharge = ((elapsedMinutes / 60) * args.rate_per_hour).toFixed(2);

  const preview = {
    action:            'stop_pool_session',
    session_id:        args.session_id,
    table_id:          args.table_id,
    elapsed_minutes:   elapsedMinutes,
    rate_per_hour:     args.rate_per_hour,
    estimated_charge:  `$${estimatedCharge}`,
  };

  const token = createPendingAction('stop_pool_session', args as Record<string, unknown>, preview, _executeStopPoolSession);
  return ok({ pending: true, confirm_token: token, preview });
}

export async function assignSessionToTab(
  args: { session_id: string; tab_id: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const sessionMissing = await assertExists('pool_sessions', args.session_id);
  if (sessionMissing) return err({ code: 'NOT_FOUND' as const, message: sessionMissing });

  const tabMissing = await assertExists('tabs', args.tab_id);
  if (tabMissing) return err({ code: 'NOT_FOUND' as const, message: tabMissing });

  const { data, error } = await supabase
    .from('pool_sessions')
    .update({ tab_id: args.tab_id })
    .eq('id', args.session_id)
    .is('stopped_at', null)
    .select('id, tab_id')
    .single();

  if (error) {
    void logAgentAction('assign_session_to_tab', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: error.message });
  }
  void logAgentAction('assign_session_to_tab', args, data, { ...ctx, durationMs: Date.now() - t0 });
  return ok(data);
}

// Internal executor for stop_and_move_table
export async function _executeStopAndMoveTable(
  args: Record<string, unknown>,
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const { session_id, table_id, tab_id, rate_per_hour, new_table_number } =
    args as { session_id: string; table_id: string; tab_id: string; rate_per_hour: number; new_table_number: number };

  const stopResult = await _executeStopPoolSession(
    { session_id, table_id, rate_per_hour },
    ctx
  );
  if (!stopResult.ok) return stopResult;

  const t0 = Date.now();
  const { error: tabErr } = await supabase
    .from('tabs')
    .update({ table_number: new_table_number })
    .eq('id', tab_id);

  if (tabErr) {
    void logAgentAction('stop_and_move_table', args, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: tabErr.message });
  }

  const result = { session: stopResult.data, moved_to_table: new_table_number };
  void logAgentAction('stop_and_move_table', args, result, { ...ctx, durationMs: Date.now() - t0 });
  return ok(result);
}

// Public tool — builds preview + pending action
export async function stopAndMoveTable(
  args: { session_id: string; table_id: string; tab_id: string; rate_per_hour: number; new_table_number: number },
  _ctx: AgentActionContext
): Promise<Result<unknown>> {
  const sessionMissing = await assertExists('pool_sessions', args.session_id);
  if (sessionMissing) return err({ code: 'NOT_FOUND' as const, message: sessionMissing });

  const tabMissing = await assertExists('tabs', args.tab_id);
  if (tabMissing) return err({ code: 'NOT_FOUND' as const, message: tabMissing });

  const { data: session } = await supabase
    .from('pool_sessions')
    .select('started_at')
    .eq('id', args.session_id)
    .single();

  const startedAt = new Date((session as { started_at?: string } | null)?.started_at ?? Date.now());
  const elapsedMinutes = Math.ceil((Date.now() - startedAt.getTime()) / 60_000);
  const estimatedCharge = ((elapsedMinutes / 60) * args.rate_per_hour).toFixed(2);

  const preview = {
    action:           'stop_and_move_table',
    session_id:       args.session_id,
    tab_id:           args.tab_id,
    elapsed_minutes:  elapsedMinutes,
    estimated_charge: `$${estimatedCharge}`,
    move_to_table:    args.new_table_number,
  };

  const token = createPendingAction('stop_and_move_table', args as Record<string, unknown>, preview, _executeStopAndMoveTable);
  return ok({ pending: true, confirm_token: token, preview });
}
