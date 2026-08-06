// src/entities/refund/model/types.ts
// Re-export all refund types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  Refund,
  RefundItem,
  RefundReason,
} from '@shared/lib/domain';
