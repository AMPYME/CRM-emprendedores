import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  action: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'VERIFICATION_CLAIM',
    'VERIFICATION_UPDATE',
    'VERIFICATION_VALIDATE',
    'VERIFICATION_REJECT',
  ]).optional(),
  entityType: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditQuerySchema>;
