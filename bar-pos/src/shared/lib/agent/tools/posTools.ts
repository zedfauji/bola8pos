import { supabase } from '@shared/lib/supabase';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import { logAgentAction } from '@shared/lib/telemetry';
import { ok, err } from '@shared/lib/result';
import type { Result } from '@shared/lib/result';
import type { AgentActionContext } from '@shared/lib/telemetry';

// Tables not yet in generated types use runtime cast
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

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
    description: 'Closes an open tab. Fails if active pool sessions are linked.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id: { type: 'string' },
      },
      required: ['tab_id'],
    },
  },
  {
    name: 'add_items_to_tab',
    description: 'Adds one or more products to a tab. Triggers inventory depletion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tab_id: { type: 'string' },
        items: {
          type: 'array',
          description: 'Products to add',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              quantity:   { type: 'number' },
              unit_price: { type: 'number', description: 'Price in pesos' },
              notes:      { type: 'string' },
            },
            required: ['product_id', 'quantity', 'unit_price'],
          },
        },
        notes: { type: 'string', description: 'Order-level note' },
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
        new_staff_id:     { type: 'string', description: 'UUID of the new staff owner (optional)' },
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
    description: 'Starts a pool timer on a table. Auto-creates a new tab named "Pool <label>" if tab_id is omitted (matches UI behaviour). Requires open caja session and active shift.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table_id: { type: 'string', description: 'UUID of the pool table' },
        tab_id:   { type: 'string', description: 'UUID of the tab to link (optional)' },
      },
      required: ['table_id'],
    },
  },
  {
    name: 'stop_pool_session',
    description: 'Stops the active pool session, calculates billing, marks table as available.',
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
    description: 'Stops a pool session and moves the linked tab to a regular table number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id:       { type: 'string' },
        table_id:         { type: 'string', description: 'UUID of the pool table' },
        tab_id:           { type: 'string' },
        rate_per_hour:    { type: 'number' },
        new_table_number: { type: 'number' },
      },
      required: ['session_id', 'table_id', 'tab_id', 'rate_per_hour', 'new_table_number'],
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveStaffContext(userId: string | undefined): Promise<
  { staffId: string; shiftId: string } | null
> {
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
  // Fallback: first active shift
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
  const { data, error } = await supabase
    .from('tabs')
    .select(`
      id, customer_name, table_number, status, opened_at, notes,
      orders:tabs_orders(
        id, status, notes, created_at,
        order_items ( id, product_id, quantity, unit_price, notes,
          products ( name )
        )
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
  if (!staff) {
    return err({ code: 'AGENT_ERROR' as const, message: 'No active shift found. Clock in first.' });
  }

  const cajaId = await resolveOpenCajaId();
  if (!cajaId) {
    return err({ code: 'CAJA_CLOSED' as const, message: 'No open caja session. Open caja first.' });
  }

  const { data, error } = await supabase
    .from('tabs')
    .insert({
      customer_name:    args.customer_name,
      table_number:     args.table_number ?? null,
      staff_id:         staff.staffId,
      shift_id:         staff.shiftId,
      status:           'open',
      notes:            args.notes ?? null,
      caja_session_id:  cajaId,
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

export async function closeTab(
  args: { tab_id: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const { count } = await supabase
    .from('pool_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('tab_id', args.tab_id)
    .is('stopped_at', null);

  if ((count ?? 0) > 0) {
    return err({ code: 'SESSION_STILL_RUNNING' as const, message: 'Active pool session on this tab. Stop the session first.' });
  }

  const { data, error } = await supabase
    .from('tabs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', args.tab_id)
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

export async function addItemsToTab(
  args: {
    tab_id: string;
    items: Array<{ product_id: string; quantity: number; unit_price: number; notes?: string }>;
    notes?: string;
  },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const staff = await resolveStaffContext(ctx.userId);
  if (!staff) {
    return err({ code: 'AGENT_ERROR' as const, message: 'No active shift found. Clock in first.' });
  }

  const { data, error } = await db.rpc('create_order_with_items', {
    p_tab_id:        args.tab_id,
    p_staff_id:      staff.staffId,
    p_status:        'pending',
    p_notes:         args.notes ?? '',
    p_items:         args.items.map((i) => ({
      product_id:             i.product_id,
      quantity:               i.quantity,
      unit_price:             i.unit_price,
      modifier_ids:           [],
      modifier_price_delta:   0,
      notes:                  i.notes ?? '',
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

  const staff = await resolveStaffContext(ctx.userId);

  const { data, error } = await db.rpc('transfer_tab', {
    p_tab_id:          args.tab_id,
    p_to_staff_id:     args.new_staff_id ?? null,
    p_to_table:        args.new_table_number ?? null,
    p_transferred_by:  staff?.staffId ?? null,
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
      pool_sessions!pool_sessions_table_id_fkey (
        id, started_at, tab_id
      )
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

  // Resolve tab — auto-create one (matching UI behaviour) if none provided
  let resolvedTabId: string | null = args.tab_id ?? null;
  if (!resolvedTabId) {
    const staff = await resolveStaffContext(ctx.userId);
    if (!staff) {
      return err({ code: 'AGENT_ERROR' as const, message: 'No active shift found. Clock in first.' });
    }
    const cajaId = await resolveOpenCajaId();
    if (!cajaId) {
      return err({ code: 'CAJA_CLOSED' as const, message: 'No open caja session. Open caja first.' });
    }

    // Fetch table label for tab name
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

export async function stopPoolSession(
  args: { session_id: string; table_id: string; rate_per_hour: number },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  const { data: session, error: fetchErr } = await supabase
    .from('pool_sessions')
    .select('id, started_at')
    .eq('id', args.session_id)
    .single();

  if (fetchErr || !session) {
    return err({ code: 'NOT_FOUND' as const, message: `Session not found: ${fetchErr?.message ?? 'null'}` });
  }

  // Fetch billing settings (firstHourMode)
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
    startedAt: new Date(session.started_at),
    endTime:   stoppedAt,
    ratePerHour: args.rate_per_hour,
    firstHourMode,
  });

  const { data: updated, error: sessionErr } = await supabase
    .from('pool_sessions')
    .update({
      stopped_at:     stoppedAt.toISOString(),
      billed_minutes: billedMinutes,
      total_charge:   totalCharge,
    })
    .eq('id', args.session_id)
    .select()
    .single();

  if (sessionErr) {
    void logAgentAction('stop_pool_session', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: sessionErr.message });
  }

  const { error: tableErr } = await supabase
    .from('pool_tables')
    .update({ status: 'available', current_session_id: null })
    .eq('id', args.table_id);

  if (tableErr) {
    void logAgentAction('stop_pool_session', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: tableErr.message });
  }

  const result = { ...updated, billed_minutes: billedMinutes, total_charge: totalCharge };
  void logAgentAction('stop_pool_session', args as Record<string, unknown>, result, { ...ctx, durationMs: Date.now() - t0 });
  return ok(result);
}

export async function assignSessionToTab(
  args: { session_id: string; tab_id: string },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();
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

export async function stopAndMoveTable(
  args: {
    session_id: string;
    table_id: string;
    tab_id: string;
    rate_per_hour: number;
    new_table_number: number;
  },
  ctx: AgentActionContext
): Promise<Result<unknown>> {
  const t0 = Date.now();

  // Stop the session (reuse stopPoolSession logic)
  const stopResult = await stopPoolSession(
    { session_id: args.session_id, table_id: args.table_id, rate_per_hour: args.rate_per_hour },
    ctx
  );
  if (!stopResult.ok) return stopResult;

  // Move the tab to new table number
  const { error: tabErr } = await supabase
    .from('tabs')
    .update({ table_number: args.new_table_number })
    .eq('id', args.tab_id);

  if (tabErr) {
    void logAgentAction('stop_and_move_table', args as Record<string, unknown>, null, { ...ctx, durationMs: Date.now() - t0 });
    return err({ code: 'AGENT_ERROR' as const, message: tabErr.message });
  }

  const result = { session: stopResult.data, moved_to_table: args.new_table_number };
  void logAgentAction('stop_and_move_table', args as Record<string, unknown>, result, { ...ctx, durationMs: Date.now() - t0 });
  return ok(result);
}
