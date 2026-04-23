import { z } from 'zod';
import { KdsStatusSchema, UuidSchema, TimestampSchema } from '@shared/lib/domain';

export const KdsOrderItemSchema = z.object({
  id: UuidSchema,
  orderId: UuidSchema,
  productId: UuidSchema,
  productName: z.string(),
  categoryId: UuidSchema,
  isFood: z.boolean(),
  quantity: z.number().int().positive(),
  notes: z.string().nullable(),
  kdsStatus: KdsStatusSchema,
  createdAt: TimestampSchema,
  tabCustomerName: z.string().nullable(),
  tableNumber: z.number().int().nullable(),
});

export type KdsOrderItem = z.infer<typeof KdsOrderItemSchema>;
