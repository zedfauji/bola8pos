/**
 * entities/waitlist/model/types.ts
 *
 * Re-exports from domain.ts. Single source of truth is domain.ts;
 * this file exists to keep FSD layer imports consistent.
 */
export type {
  WaitlistEntry,
  WaitlistEntryCreate,
  WaitlistNotification,
  WaitlistEntryStatus,
} from '@shared/lib/domain';

export {
  WaitlistEntrySchema,
  WaitlistEntryCreateSchema,
  WaitlistNotificationSchema,
  WaitlistEntryStatusSchema,
  PhoneE164Schema,
} from '@shared/lib/domain';
