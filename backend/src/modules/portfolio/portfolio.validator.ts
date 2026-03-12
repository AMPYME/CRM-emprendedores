/**
 * Validadores Zod para el módulo de cartera/seguimiento.
 */
import { z } from 'zod';

// ── Crear registro de cartera ─────────────────────────────────────
export const createPortfolioSchema = z.object({
  entityId: z.string().uuid('Entity ID debe ser un UUID válido'),
  assignedToId: z.string().uuid('User ID debe ser un UUID válido').optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).default('NEW'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  category: z.string().max(100).trim().optional(),
  subject: z.string().min(1, 'Asunto es requerido').max(500).trim(),
  description: z.string().max(5000).trim().optional(),
  nextFollowUpDate: z.string().optional(), // ISO date string
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

// ── Actualizar registro de cartera ────────────────────────────────
export const updatePortfolioSchema = z.object({
  assignedToId: z.string().uuid('User ID debe ser un UUID válido').nullable().optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().max(100).trim().optional(),
  subject: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  nextFollowUpDate: z.string().nullable().optional(),
  closedReason: z.string().max(1000).trim().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

// ── Crear acción/gestión ──────────────────────────────────────────
export const createActionSchema = z.object({
  actionType: z.enum([
    'CALL', 'EMAIL_ACTION', 'VISIT', 'MEETING',
    'WHATSAPP', 'NOTE', 'DOCUMENT', 'STATUS_CHANGE', 'OTHER',
  ]),
  description: z.string().min(1, 'Descripción es requerida').max(5000).trim(),
  result: z.string().max(2000).trim().optional(),
  nextSteps: z.string().max(2000).trim().optional(),
  actionDate: z.string().optional(), // ISO date string, default = ahora
});

export type CreateActionInput = z.infer<typeof createActionSchema>;

// ── Filtros de listado de cartera ─────────────────────────────────
export const portfolioQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'nextFollowUpDate', 'priority', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().uuid().optional(),
  category: z.string().optional(),
  // Filtros especiales de cartera
  view: z.enum(['overdue', 'upcoming', 'unmanaged', 'all']).optional(),
});

export type PortfolioQueryInput = z.infer<typeof portfolioQuerySchema>;

// ── Param de portfolio ID ─────────────────────────────────────────
export const portfolioIdParamSchema = z.object({
  id: z.string().uuid('Portfolio ID debe ser un UUID válido'),
});

export type PortfolioIdParam = z.infer<typeof portfolioIdParamSchema>;

// ── Param para rutas anidadas (/portfolios/:portfolioId/actions) ──
export const portfolioIdNestedParamSchema = z.object({
  portfolioId: z.string().uuid('Portfolio ID debe ser un UUID válido'),
});

export type PortfolioIdNestedParam = z.infer<typeof portfolioIdNestedParamSchema>;
