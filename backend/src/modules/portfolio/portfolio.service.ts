/**
 * Service del módulo de cartera/seguimiento.
 * Lógica de negocio para PortfolioRecord + PortfolioAction.
 */
import { Prisma } from '@prisma/client';
import { portfolioRepository } from './portfolio.repository';
import {
  PortfolioQueryInput,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  CreateActionInput,
} from './portfolio.validator';
import {
  NotFoundError,
  BadRequestError,
} from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { auditService, AuditActor } from '../audit/audit.service';

// ── Helpers ───────────────────────────────────────────────────────

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────

export const portfolioService = {
  /**
   * Listado paginado de registros de cartera con filtros y vistas especiales.
   */
  async list(filters: PortfolioQueryInput) {
    const result = await portfolioRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Registros de cartera de una entidad.
   */
  async listByEntity(entityId: string) {
    const exists = await portfolioRepository.entityExists(entityId);
    if (!exists) {
      throw new NotFoundError('Entidad', entityId);
    }
    return portfolioRepository.findByEntity(entityId);
  },

  /**
   * Detalle de un registro de cartera con acciones.
   */
  async getById(id: string) {
    const record = await portfolioRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Registro de cartera', id);
    }
    return record;
  },

  /**
   * Crear registro de cartera.
   * Validaciones:
   * - La entidad debe existir y no estar MERGED
   * - Si se asigna responsable, debe existir
   */
  async create(input: CreatePortfolioInput) {
    // Verificar entidad
    const entityExists = await portfolioRepository.entityExists(input.entityId);
    if (!entityExists) {
      throw new NotFoundError('Entidad', input.entityId);
    }

    // Verificar usuario asignado
    if (input.assignedToId) {
      const userExists = await portfolioRepository.userExists(input.assignedToId);
      if (!userExists) {
        throw new NotFoundError('Usuario', input.assignedToId);
      }
    }

    const data: Prisma.PortfolioRecordCreateInput = {
      entity: { connect: { id: input.entityId } },
      assignedTo: input.assignedToId
        ? { connect: { id: input.assignedToId } }
        : undefined,
      status: input.status || 'NEW',
      priority: input.priority || 'MEDIUM',
      category: input.category,
      subject: input.subject,
      description: input.description,
      nextFollowUpDate: input.nextFollowUpDate
        ? new Date(input.nextFollowUpDate)
        : undefined,
    };

    return portfolioRepository.create(data);
  },

  /**
   * Actualizar registro de cartera.
   */
  async update(id: string, input: UpdatePortfolioInput, actor?: AuditActor) {
    const current = await portfolioRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Registro de cartera', id);
    }

    // Si se asigna un nuevo responsable, verificar que exista
    if (input.assignedToId) {
      const userExists = await portfolioRepository.userExists(input.assignedToId);
      if (!userExists) {
        throw new NotFoundError('Usuario', input.assignedToId);
      }
    }

    const data: Prisma.PortfolioRecordUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.category !== undefined) data.category = input.category;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.description !== undefined) data.description = input.description;
    if (input.closedReason !== undefined) data.closedReason = input.closedReason;

    if (input.assignedToId !== undefined) {
      data.assignedTo = input.assignedToId === null
        ? { disconnect: true }
        : { connect: { id: input.assignedToId } };
    }

    if (input.nextFollowUpDate !== undefined) {
      data.nextFollowUpDate = input.nextFollowUpDate
        ? new Date(input.nextFollowUpDate)
        : null;
    }

    // Auto-cerrar si el status cambia a CLOSED o RESOLVED
    if (input.status === 'CLOSED' || input.status === 'RESOLVED') {
      if (!current.closedAt) {
        data.closedAt = new Date();
      }
    }

    const record = await portfolioRepository.update(id, data);

    await auditService.log({
      action: 'UPDATE',
      entityType: 'PORTFOLIO',
      entityId: record.id,
      entityLabel: record.subject,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: { fields: Object.keys(input) },
    });

    return record;
  },

  /**
   * Cerrar registro de cartera con motivo.
   */
  async close(id: string, reason?: string) {
    const record = await portfolioRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Registro de cartera', id);
    }

    if (record.status === 'CLOSED') {
      throw new BadRequestError('El registro de cartera ya está cerrado');
    }

    return portfolioRepository.close(id, reason);
  },

  /**
   * Agregar acción/gestión a un registro de cartera.
   */
  async addAction(portfolioId: string, input: CreateActionInput) {
    const record = await portfolioRepository.findById(portfolioId);
    if (!record) {
      throw new NotFoundError('Registro de cartera', portfolioId);
    }

    const data: Prisma.PortfolioActionCreateInput = {
      portfolio: { connect: { id: portfolioId } },
      actionType: input.actionType,
      description: input.description,
      result: input.result,
      nextSteps: input.nextSteps,
      actionDate: input.actionDate ? new Date(input.actionDate) : new Date(),
    };

    return portfolioRepository.addAction(data);
  },

  /**
   * Lista acciones de un registro de cartera.
   */
  async listActions(portfolioId: string) {
    const record = await portfolioRepository.findById(portfolioId);
    if (!record) {
      throw new NotFoundError('Registro de cartera', portfolioId);
    }
    return portfolioRepository.findActions(portfolioId);
  },

  /**
   * Estadísticas generales de cartera.
   */
  async getStats() {
    return portfolioRepository.getStats();
  },
};
