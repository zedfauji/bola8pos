/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export async function bumpKdsItem(
  itemId: string,
  nextStatus: 'in_progress' | 'done'
): Promise<Result<void>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db
    .from('order_items')
    .update({ kds_status: nextStatus })
    .eq('id', itemId);

  if (error) {
    logger.error('kds.bump', { itemId, nextStatus, error });
    return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
  }
  return ok(undefined);
}
