/**
 * TAB DETAIL COMPONENT
 *
 * Full tab view: header, order history by time, pool charges, totals, tip, actions.
 */

import { AlertCircle, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffStore } from '@entities/staff/model/store';
import { useTab } from '@entities/tab/model/queries';
import type { Order, OrderItem } from '@entities/tab/model/types';
import {
  calculateTipAmount,
  calculateTipSuggestions,
  getTabDurationTier,
} from '@shared/lib/domain-helpers';
import { cn } from '@shared/lib/utils';
import { EmptyState } from '@shared/ui/EmptyState';
import { TabListSkeleton } from '@shared/ui/LoadingSkeletons';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { TimerDisplay } from '@shared/ui/TimerDisplay';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardHeader, CardContent } from '@shared/ui/card';

import { PoolChargeItem } from './PoolChargeItem';

export interface TabDetailProps {
  tabId: string;
  onAddItems: () => void;
  onCloseTab: () => void;
  onTransferTab?: () => void;
  onVoidOrderRequested?: (order: Order) => void;
  className?: string;
}

function calculateLineTotal(item: OrderItem): number {
  return (item.unitPrice + item.modifierPriceDelta) * item.quantity;
}

function drinksSubtotalFromItems(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}

function poolChargesTotal(tab: { poolCharges: { totalCharge: number }[] }): number {
  return tab.poolCharges.reduce((s, c) => s + c.totalCharge, 0);
}

function formatOrderTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function durationBadgeStatus(
  tier: ReturnType<typeof getTabDurationTier>
): 'tab_open_ok' | 'tab_open_warn' | 'tab_open_critical' {
  if (tier === 'critical') return 'tab_open_critical';
  if (tier === 'warn') return 'tab_open_warn';
  return 'tab_open_ok';
}

type TipMode = 'pct10' | 'pct15' | 'pct18' | 'pct20' | 'custom';

// 'pctNN' are internal TipMode state identifiers, not UI copy; the '%' labels
// are already exempt via the plugin's numeric/symbol regex — this const
// array is module-scope (not inside JSX) so a regular eslint-disable comment
// attaches correctly.
// eslint-disable-next-line i18next/no-literal-string
const TIP_SUGGESTION_MODES = [
  ['pct10', '10%'],
  ['pct15', '15%'],
  ['pct18', '18%'],
  ['pct20', '20%'],
] as const satisfies ReadonlyArray<readonly [Exclude<TipMode, 'custom'>, string]>;

export function TabDetail({
  tabId,
  onAddItems,
  onCloseTab,
  onTransferTab,
  onVoidOrderRequested,
  className,
}: TabDetailProps) {
  const { t } = useTranslation('entities');
  const { data: tab, isLoading, isError, error, resultError } = useTab(tabId);
  const hasError = isError || Boolean(resultError);
  const errorMessage = resultError?.message ?? error?.message ?? t('common.unknownError');
  const currentStaff = useStaffStore(state => state.currentStaff);

  const [tipMode, setTipMode] = useState<TipMode>('pct15');
  const [customTip, setCustomTip] = useState(0);

  const drinksSubtotal = useMemo(() => (tab ? drinksSubtotalFromItems(tab.items) : 0), [tab]);
  const poolTotal = useMemo(() => (tab ? poolChargesTotal(tab) : 0), [tab]);
  const grandSubtotal = useMemo(() => drinksSubtotal + poolTotal, [drinksSubtotal, poolTotal]);

  const tipSuggestions = useMemo(() => calculateTipSuggestions(grandSubtotal), [grandSubtotal]);

  const tipAmount = useMemo(() => {
    if (!tab) return 0;
    if (tipMode === 'custom') {
      return Math.round(customTip * 100) / 100;
    }
    const pct = tipMode === 'pct10' ? 10 : tipMode === 'pct15' ? 15 : tipMode === 'pct18' ? 18 : 20;
    return calculateTipAmount(grandSubtotal, pct, null);
  }, [tab, tipMode, customTip, grandSubtotal]);

  const totalWithTip = grandSubtotal + tipAmount;

  const canTransferTab = currentStaff?.role === 'manager' || currentStaff?.role === 'admin';

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <TabListSkeleton count={3} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={className}>
        <EmptyState
          icon={AlertCircle}
          title={t('tabDetail.errorLoadingTab')}
          description={errorMessage}
        />
      </div>
    );
  }

  if (!tab) {
    return (
      <div className={className}>
        <EmptyState
          icon={FileText}
          title={t('tabDetail.tabNotFound')}
          description={t('tabDetail.tabNotFoundDescription')}
        />
      </div>
    );
  }

  const now = new Date();
  const tier = getTabDurationTier(tab.openedAt, now);
  const durationBadge = durationBadgeStatus(tier);
  const sortedOrders: Order[] = [...tab.orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const itemLabel = (item: OrderItem) =>
    item.product?.name ?? t('tabDetail.unknownProductFallback', { id: item.productId.slice(0, 8) });

  return (
    <div className={cn('space-y-6', className)}>
      {tab.hasActivePoolSession && (
        <div
          className="rounded-lg border border-pos-warning/50 bg-pos-warning/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {tab.activePoolTableNumber != null
            ? t('tabDetail.poolTimerRunningOnTable', { tableNumber: tab.activePoolTableNumber })
            : t('tabDetail.poolTimerRunning')}{' '}
          {t('tabDetail.stopPoolBeforeClosing')}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {tab.customerName}
              </h2>
              {tab.tableNumber !== null && (
                <p className="text-muted-foreground">
                  {t('tabDetail.tableNumber', { number: tab.tableNumber })}
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              {tab.status === 'open' && <StatusBadge status={durationBadge} />}
              <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                <TimerDisplay
                  mode="tabOpen"
                  openedAt={tab.openedAt}
                  now={now}
                  size="sm"
                  warning={tier === 'warn'}
                  critical={tier === 'critical'}
                />
                <MoneyDisplay amount={drinksSubtotal} size="sm" />
                <span className="text-xs">{t('tabDetail.drinksSubtotal')}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">{t('tabDetail.orderHistory')}</h3>
        </CardHeader>
        <CardContent>
          {tab.items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('tabDetail.noItemsYet')}
              description={t('tabDetail.noItemsYetDescription')}
            />
          ) : sortedOrders.length === 0 ? (
            <ul className="space-y-2">
              {tab.items.map(item => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 border-b border-border/60 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      <span className="text-muted-foreground">{item.quantity}×</span>{' '}
                      {itemLabel(item)}
                    </div>
                    {item.modifierIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t('tabDetail.modifierCount', { count: item.modifierIds.length })}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground italic">{item.notes}</p>
                    )}
                  </div>
                  <MoneyDisplay amount={calculateLineTotal(item)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-6">
              {sortedOrders.map(order => (
                <div key={order.id} className="space-y-2">
                  <div className="flex items-center gap-2 border-b pb-1">
                    <Badge variant="secondary">{formatOrderTime(order.createdAt)}</Badge>
                    <span className="text-xs text-muted-foreground">{t('tabDetail.order')}</span>
                    <ProtectedAction action="void_order" currentRole={currentStaff?.role}>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="ml-auto"
                        onClick={() => {
                          onVoidOrderRequested?.(order);
                        }}
                      >
                        {t('tabDetail.void')}
                      </Button>
                    </ProtectedAction>
                  </div>
                  <ul className="space-y-2">
                    {order.items.map(item => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 border-b border-border/60 py-2 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            <span className="text-muted-foreground">{item.quantity}×</span>{' '}
                            {itemLabel(item)}
                          </div>
                          {item.modifierIds.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {t('tabDetail.modifierCount', { count: item.modifierIds.length })}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-muted-foreground italic">{item.notes}</p>
                          )}
                        </div>
                        <MoneyDisplay amount={calculateLineTotal(item)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tab.poolCharges.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">{t('tabDetail.poolCharges')}</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {tab.poolCharges.map(c => (
              <PoolChargeItem key={c.sessionId} charge={c} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">{t('tabDetail.totals')}</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>{t('tabDetail.drinks')}</span>
            <MoneyDisplay amount={drinksSubtotal} size="sm" />
          </div>
          {poolTotal > 0 && (
            <div className="flex justify-between">
              <span>{t('tabDetail.pool')}</span>
              <MoneyDisplay amount={poolTotal} size="sm" />
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>{t('tabDetail.subtotalDrinksPool')}</span>
            <MoneyDisplay amount={grandSubtotal} size="md" />
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('tabDetail.estimatedTip')}</span>
            <MoneyDisplay amount={tipAmount} size="sm" />
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>{t('tabDetail.estTotalWithTip')}</span>
            <MoneyDisplay amount={totalWithTip} size="lg" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">{t('tabDetail.tip')}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TIP_SUGGESTION_MODES.map(([mode, label]) => {
              const amt =
                mode === 'pct10'
                  ? tipSuggestions.tip10
                  : mode === 'pct15'
                    ? tipSuggestions.tip15
                    : mode === 'pct18'
                      ? tipSuggestions.tip18
                      : tipSuggestions.tip20;
              return (
                <Button
                  key={mode}
                  type="button"
                  variant={tipMode === mode ? 'default' : 'outline'}
                  className="flex h-auto flex-col gap-1 py-3"
                  onClick={() => {
                    setTipMode(mode);
                  }}
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <MoneyDisplay amount={amt} size="sm" />
                </Button>
              );
            })}
            <Button
              type="button"
              variant={tipMode === 'custom' ? 'default' : 'outline'}
              className="flex h-auto flex-col gap-1 py-3"
              onClick={() => {
                setTipMode('custom');
              }}
            >
              <span className="text-xs text-muted-foreground">{t('tabDetail.custom')}</span>
              <span className="text-sm font-medium">{t('tabDetail.enter')}</span>
            </Button>
          </div>
          {tipMode === 'custom' && (
            <MoneyInput
              label={t('tabDetail.customTip')}
              value={customTip}
              onChange={v => {
                setCustomTip(v);
              }}
              placeholder="0.00"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button size="lg" variant="default" onClick={onAddItems} className="w-full">
          {t('tabDetail.addItems')}
        </Button>
        <ProtectedAction action="close_tab" currentRole={currentStaff?.role}>
          <Button size="lg" variant="default" onClick={onCloseTab} className="w-full">
            {t('tabDetail.closeTab')}
          </Button>
        </ProtectedAction>
        {canTransferTab && onTransferTab && (
          <Button size="lg" variant="outline" onClick={onTransferTab} className="w-full">
            {t('tabDetail.transferTab')}
          </Button>
        )}
      </div>
    </div>
  );
}
