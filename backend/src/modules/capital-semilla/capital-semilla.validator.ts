import { z } from 'zod';

const optionalText = z.string().trim().max(200).optional().nullable();

export const saveCapitalSemillaSchema = z.object({
  recordId: z.string().uuid().optional(),
  province: optionalText,
  businessName: optionalText,
  actaNumber: z.string().trim().max(80).optional().nullable(),
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
});

export type SaveCapitalSemillaInput = z.infer<typeof saveCapitalSemillaSchema>;
