import type { TFunction } from 'i18next';
import { BellRing, CheckSquare, Clock, Phone, PhoneOff, UserX, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { WaitlistEntry, WaitlistNotification } from '@entities/waitlist/model/types';
import { Badge } from '@shared/ui';
import { POSButton } from '@shared/ui';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// `t` is threaded in explicitly (module-scope functions, not components —
// cannot call the useTranslation() hook themselves).
// ────────────────────────────────────────────────────────────────────────────

function formatWait(t: TFunction<'entities'>, minutes: number): string {
  if (minutes > 120) return t('waitlistEntryCard.waitOver2hr');
  return t('waitlistEntryCard.waitMinutes', { minutes });
}

function formatTimeAgo(t: TFunction<'entities'>, date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t('waitlistEntryCard.justNow');
  if (diffMin === 1) return t('waitlistEntryCard.oneMinAgo');
  if (diffMin < 60) return t('waitlistEntryCard.minutesAgo', { minutes: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return t('waitlistEntryCard.oneHourAgo');
  return t('waitlistEntryCard.hoursAgo', { hours: diffHr });
}

/* eslint-disable i18next/no-literal-string -- computed Tailwind class name
   strings, not UI copy. */
function getCardBorderClass(status: WaitlistEntry['status']): string {
  switch (status) {
    case 'waiting':
      return 'border-border';
    case 'notified':
      return 'border-pos-accent/50';
    case 'no_show':
      return 'border-pos-danger bg-pos-danger/5';
    case 'seated':
    case 'cancelled':
    default:
      return 'border-border opacity-60';
  }
}
/* eslint-enable i18next/no-literal-string */

// ────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WaitlistEntry['status'] }) {
  const { t } = useTranslation('entities');
  if (status === 'notified') {
    return (
      <span className="inline-flex items-center rounded-full border border-pos-accent/30 bg-pos-accent/20 px-2 py-0.5 text-xs font-medium text-pos-accent">
        {t('waitlistEntryCard.status.notified')}
      </span>
    );
  }
  if (status === 'no_show') {
    return <Badge variant="destructive">{t('waitlistEntryCard.status.noShow')}</Badge>;
  }
  // eslint-disable-next-line i18next/no-literal-string -- fallback for
  // 'waiting'/'seated'/'cancelled', all covered by explicit catalog keys below
  const fallbackKey = `waitlistEntryCard.status.${status}`;
  return <Badge variant="secondary">{t(fallbackKey, status.replace('_', ' '))}</Badge>;
}

// ────────────────────────────────────────────────────────────────────────────
// NotificationStatusRow — shown only when status = 'notified'
// ────────────────────────────────────────────────────────────────────────────

function NotificationStatusRow({
  lastNotification,
}: {
  lastNotification: WaitlistNotification | null;
}) {
  const { t } = useTranslation('entities');
  if (!lastNotification) {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>{t('waitlistEntryCard.notifiedViaManager')}</span>
      </div>
    );
  }

  if (lastNotification.channel === 'manager') {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>{t('waitlistEntryCard.notifiedViaManager')}</span>
      </div>
    );
  }

  // whatsapp channel
  if (lastNotification.status === 'sent') {
    return (
      <div className="flex items-center gap-1 text-sm text-pos-accent">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>{t('waitlistEntryCard.notifiedViaWhatsapp')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-destructive">
      <BellRing className="h-3 w-3" aria-hidden="true" />
      <span>{t('waitlistEntryCard.notificationFailed')}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface WaitlistEntryCardProps {
  entry: WaitlistEntry;
  /** Minutes until this party is estimated to be seated. From computeQuotedWait. */
  quotedWait: number;
  lastNotification: WaitlistNotification | null;
  /**
   * Render prop: widget passes <NotifyButton /> here.
   * Only shown when status = 'waiting'.
   * The entity card cannot import from features layer — the widget owns the slot.
   */
  notifySlot?: ReactNode;
  onSeat: (entryId: string) => void;
  onNoShow: (entryId: string) => void;
  onCancel: (entryId: string) => void;
  isSeating: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function WaitlistEntryCard({
  entry,
  quotedWait,
  lastNotification,
  notifySlot,
  onSeat,
  onNoShow,
  onCancel,
  isSeating,
}: WaitlistEntryCardProps) {
  const { t } = useTranslation('entities');
  const isActive = entry.status === 'waiting' || entry.status === 'notified';
  const displayWait = Math.max(5, quotedWait);
  const waitLabel = formatWait(t, displayWait);

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 min-h-[80px] ${getCardBorderClass(entry.status)}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold truncate">{entry.name}</span>
          <StatusBadge status={entry.status} />
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
          {entry.phoneE164 ? (
            <>
              <Phone className="h-3 w-3" aria-hidden="true" />
              <span>{t('waitlistEntryCard.whatsapp')}</span>
            </>
          ) : (
            <>
              <PhoneOff className="h-3 w-3" aria-hidden="true" />
              <span>{t('waitlistEntryCard.noPhone')}</span>
            </>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" />
          <span>{t('waitlistEntryCard.partySize', { count: entry.partySize })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span className="font-mono tabular-nums">{waitLabel}</span>
        </div>
        <span className="text-sm">
          {t('waitlistEntryCard.addedTimeAgo', { timeAgo: formatTimeAgo(t, entry.createdAt) })}
        </span>
      </div>

      {/* Notification status — only when status = 'notified' */}
      {entry.status === 'notified' && (
        <NotificationStatusRow lastNotification={lastNotification} />
      )}

      {/* Action buttons — only for active entries */}
      {isActive && (
        <div className="flex items-center gap-3 pt-1">
          {/* Notify slot — only for waiting entries */}
          {entry.status === 'waiting' && notifySlot}

          {/* Seat button */}
          <POSButton
            variant="outline"
            touchSize="default"
            disabled={isSeating}
            onClick={() => { onSeat(entry.id); }}
            aria-label={t('waitlistEntryCard.seatPartyAriaLabel')}
          >
            <CheckSquare className="h-4 w-4 mr-1" aria-hidden="true" />
            {t('waitlistEntryCard.seatParty')}
          </POSButton>

          {/* No-show button — icon only */}
          <POSButton
            variant="ghost"
            touchSize="default"
            size="icon"
            onClick={() => { onNoShow(entry.id); }}
            aria-label={t('waitlistEntryCard.markNoShowAriaLabel')}
            className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <UserX className="h-4 w-4" aria-hidden="true" />
          </POSButton>

          {/* Cancel button — only for waiting entries */}
          {entry.status === 'waiting' && (
            <POSButton
              variant="ghost"
              touchSize="default"
              size="icon"
              onClick={() => { onCancel(entry.id); }}
              aria-label={t('waitlistEntryCard.cancelEntryAriaLabel')}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </POSButton>
          )}
        </div>
      )}
    </div>
  );
}
