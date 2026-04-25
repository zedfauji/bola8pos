import { BellRing, CheckSquare, Clock, Phone, PhoneOff, UserX, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';


import type { WaitlistEntry, WaitlistNotification } from '@entities/waitlist/model/types';
import { Badge } from '@shared/ui';
import { Button } from '@shared/ui';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatWait(minutes: number): string {
  if (minutes > 120) return '>2 hr wait';
  return `~${minutes} min wait`;
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hr ago';
  return `${diffHr} hr ago`;
}

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

// ────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WaitlistEntry['status'] }) {
  if (status === 'notified') {
    return (
      <span className="inline-flex items-center rounded-full border border-pos-accent/30 bg-pos-accent/20 px-2 py-0.5 text-xs font-medium text-pos-accent">
        notified
      </span>
    );
  }
  if (status === 'no_show') {
    return <Badge variant="destructive">no show</Badge>;
  }
  return <Badge variant="secondary">{status.replace('_', ' ')}</Badge>;
}

// ────────────────────────────────────────────────────────────────────────────
// NotificationStatusRow — shown only when status = 'notified'
// ────────────────────────────────────────────────────────────────────────────

function NotificationStatusRow({
  lastNotification,
}: {
  lastNotification: WaitlistNotification | null;
}) {
  if (!lastNotification) {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>Notified via manager terminal</span>
      </div>
    );
  }

  if (lastNotification.channel === 'manager') {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>Notified via manager terminal</span>
      </div>
    );
  }

  // whatsapp channel
  if (lastNotification.status === 'sent') {
    return (
      <div className="flex items-center gap-1 text-sm text-pos-accent">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>Notified via WhatsApp</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-destructive">
      <BellRing className="h-3 w-3" aria-hidden="true" />
      <span>Notification failed</span>
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
  const isActive = entry.status === 'waiting' || entry.status === 'notified';
  const displayWait = Math.max(5, quotedWait);
  const waitLabel = formatWait(displayWait);

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
              <span>WhatsApp</span>
            </>
          ) : (
            <>
              <PhoneOff className="h-3 w-3" aria-hidden="true" />
              <span>No phone</span>
            </>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" />
          <span>
            {entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span className="font-mono tabular-nums">{waitLabel}</span>
        </div>
        <span className="text-sm">added {formatTimeAgo(entry.createdAt)}</span>
      </div>

      {/* Notification status — only when status = 'notified' */}
      {entry.status === 'notified' && (
        <NotificationStatusRow lastNotification={lastNotification} />
      )}

      {/* Action buttons — only for active entries */}
      {isActive && (
        <div className="flex items-center gap-2 pt-1">
          {/* Notify slot — only for waiting entries */}
          {entry.status === 'waiting' && notifySlot}

          {/* Seat button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isSeating}
            onClick={() => { onSeat(entry.id); }}
            aria-label="Seat party"
          >
            <CheckSquare className="h-4 w-4 mr-1" aria-hidden="true" />
            Seat party
          </Button>

          {/* No-show button — icon only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { onNoShow(entry.id); }}
            aria-label="Mark as no-show"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <UserX className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Cancel button — only for waiting entries */}
          {entry.status === 'waiting' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { onCancel(entry.id); }}
              aria-label="Cancel entry"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
