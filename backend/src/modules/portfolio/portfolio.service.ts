/**
 * Service del módulo de cartera/seguimiento.
 * Lógica de negocio para PortfolioRecord + PortfolioAction.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
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
  ForbiddenError,
} from '../../shared/errors/app-error';
import type { AuthUser } from '../auth/auth.types';
import * as XLSX from 'xlsx';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext, cambios } from '../audit/audit-snapshot';

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
   * Excel de seguimientos de la sede del usuario, por fecha de creación.
   */
  async exportXlsx(user: AuthUser | undefined, query: { from?: unknown; to?: unknown }) {
    const sedeId = user?.sede?.id;
    if (!sedeId) {
      throw new ForbiddenError('Solo puedes descargar los seguimientos de tu sede, y tu usuario no tiene una sede asignada');
    }

    const fromRaw = typeof query.from === 'string' ? query.from : '';
    const toRaw = typeof query.to === 'string' ? query.to : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      throw new BadRequestError('Indica la fecha inicial y la fecha final (AAAA-MM-DD)');
    }
    const from = new Date(`${fromRaw}T00:00:00.000-05:00`);
    const to = new Date(`${toRaw}T23:59:59.999-05:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestError('El rango de fechas no es válido');
    }

    const rows = await portfolioRepository.findForExport(sedeId, from, to);
    const statusLabel: Record<string, string> = {
      NEW: 'Nuevo',
      IN_PROGRESS: 'En progreso',
      WAITING: 'En espera',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado',
    };
    const sheetRows = rows.map((row) => {
      const atendio = row.assignedTo?.username?.trim()
        || (row.assignedTo
          ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`.trim()
          : '');
      const documento =
        row.entity.person?.documentNumber ||
        row.entity.person?.cedula ||
        row.entity.company?.ruc ||
        '';
      return {
        'Fecha de creación': row.createdAt.toLocaleString('es-PA', { timeZone: 'America/Panama' }),
        Sede: row.sede?.name || user?.sede?.name || '',
        Departamento: row.departamento?.name || row.assignedTo?.departamento?.name || '',
        'Usuario que atendió': atendio || row.assignedTo?.username || '',
        Asunto: row.subject,
        Entidad: row.entity.displayName,
        Documento: documento,
        Estado: statusLabel[row.status] || row.status,
        Categoría: row.category || '',
        Descripción: row.description || '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      sheetRows.length
        ? sheetRows
        : [{
            'Fecha de creación': '',
            Sede: user?.sede?.name || '',
            Departamento: '',
            'Usuario que atendió': '',
            Asunto: '',
            Entidad: '',
            Documento: '',
            Estado: '',
            Categoría: '',
            Descripción: 'No hay seguimientos en este rango',
          }]
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Seguimientos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const safeName = (user?.sede?.name || 'sede').replace(/[^\w\-]+/g, '_').slice(0, 40);
    return {
      buffer,
      filename: `seguimientos_${safeName}_${fromRaw}_${toRaw}.xlsx`,
    };
  },

  /**
   * Crear registro de cartera.
   * Validaciones:
   * - La entidad debe existir y no estar MERGED
   * - Si se asigna responsable, debe existir
   */
  async create(input: CreatePortfolioInput, actor?: AuditActor) {
    // Verificar entidad
    const entityExists = await portfolioRepository.entityExists(input.entityId);
    if (!entityExists) {
      throw new NotFoundError('Entidad', input.entityId);
    }

    if (!actor?.userId) {
      throw new BadRequestError('No se pudo identificar al usuario que crea el seguimiento');
    }
    const assignedToId = actor.userId;
    const userExists = await portfolioRepository.userExists(assignedToId);
    if (!userExists) {
      throw new NotFoundError('Usuario', assignedToId);
    }

    let sedeId: string | undefined;
    let departamentoId: string | undefined;
    const owner = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: {
        sedeId: true,
        departamentoId: true,
        sede: { select: { deletedAt: true } },
        departamento: { select: { deletedAt: true } },
      },
    });
    if (owner?.sedeId && !owner.sede?.deletedAt) sedeId = owner.sedeId;
    if (owner?.departamentoId && !owner.departamento?.deletedAt) departamentoId = owner.departamentoId;

    const { portfolioApiRepository } = await import('../../infrastructure/database');
    const portfolioId = await portfolioApiRepository.create(actor.userId, {
      entityId: input.entityId,
      subject: input.subject,
      description: input.description,
      priority: input.priority || 'MEDIUM',
      category: input.category,
      assignedToId,
      sedeId,
      departamentoId,
    });
    if (input.status && input.status !== 'NEW') {
      await portfolioApiRepository.changeStatus(actor.userId, portfolioId, input.status);
    }
    if (input.nextFollowUpDate) {
      await portfolioRepository.update(portfolioId, {
        nextFollowUpDate: parseDateOnly(input.nextFollowUpDate),
      });
    }
    const record = await portfolioRepository.findById(portfolioId);
    if (!record) throw new NotFoundError('Registro de cartera', portfolioId);
    return record;
  },

  /**
   * Actualizar registro de cartera.
   */
  async update(id: string, input: UpdatePortfolioInput, actor?: AuditActor) {
    const current = await portfolioRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Registro de cartera', id);
    }

    if (input.status !== undefined && input.status !== current.status) {
      const { portfolioApiRepository } = await import('../../infrastructure/database');
      await portfolioApiRepository.changeStatus(
        actor?.userId ?? 'system',
        id,
        input.status,
        input.closedReason
      );
    }

    // Si se asigna un nuevo responsable, verificar que exista
    if (input.assignedToId) {
      const userExists = await portfolioRepository.userExists(input.assignedToId);
      if (!userExists) {
        throw new NotFoundError('Usuario', input.assignedToId);
      }
    }

    const data: Prisma.PortfolioRecordUpdateInput = {};
    // status ya aplicado vía procedure
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
        ? parseDateOnly(input.nextFollowUpDate)
        : null;
    }

    // Auto-cerrar si el status cambia a CLOSED o RESOLVED
    if (input.status === 'CLOSED' || input.status === 'RESOLVED') {
      if (!current.closedAt) {
        data.closedAt = new Date();
      }
    }

    const antes = vistaCartera(current);
    const record = await portfolioRepository.update(id, data);
    const quien = await actorContext(actor);
    const { anterior, nuevo } = cambios(antes, vistaCartera(record));
    await auditService.log({
      action: 'UPDATE',
      entityType: 'PORTFOLIO',
      entityId: record.entityId,
      entityLabel: record.subject,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: { subject: antes.subject, ...anterior },
        nuevo: { subject: record.subject, ...nuevo },
      },
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
  async addAction(portfolioId: string, input: CreateActionInput, actor?: AuditActor) {
    const record = await portfolioRepository.findById(portfolioId);
    if (!record) {
      throw new NotFoundError('Registro de cartera', portfolioId);
    }

    let sedeId: string | undefined;
    let departamentoId: string | undefined;
    if (actor?.userId) {
      const actorUser = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          sedeId: true,
          departamentoId: true,
          sede: { select: { deletedAt: true } },
          departamento: { select: { deletedAt: true } },
        },
      });
      if (actorUser?.sedeId && !actorUser.sede?.deletedAt) sedeId = actorUser.sedeId;
      if (actorUser?.departamentoId && !actorUser.departamento?.deletedAt) departamentoId = actorUser.departamentoId;
    }

    const data: Prisma.PortfolioActionCreateInput = {
      portfolio: { connect: { id: portfolioId } },
      performedBy: actor?.userId ? { connect: { id: actor.userId } } : undefined,
      sede: sedeId ? { connect: { id: sedeId } } : undefined,
      departamento: departamentoId ? { connect: { id: departamentoId } } : undefined,
      actionType: input.actionType,
      description: input.description,
      result: input.result,
      nextSteps: input.nextSteps,
      actionDate: input.actionDate ? new Date(input.actionDate) : new Date(),
    };

    const created = await portfolioRepository.addAction(data);
    const quien = await actorContext(actor);
    await auditService.log({
      action: 'CREATE',
      entityType: 'PORTFOLIO_ACTION',
      entityId: record.entityId,
      entityLabel: record.subject,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: null,
        nuevo: {
          subject: record.subject,
          actionType: input.actionType,
          description: input.description,
          result: input.result ?? null,
          nextSteps: input.nextSteps ?? null,
        },
      },
    });
    return created;
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

/**
 * Persiste campos de solo fecha en mediodía UTC para no correr el día
 * al formatear en zonas UTC- (p. ej. América/Panamá).
 */
function parseDateOnly(value: string): Date {
  const ymd = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
      throw new BadRequestError('Fecha de próximo seguimiento inválida');
    }
    return fallback;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function fechaCorta(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

function vistaCartera(record: {
  subject: string;
  status: string;
  priority: string;
  category?: string | null;
  description?: string | null;
  nextFollowUpDate?: Date | string | null;
  closedReason?: string | null;
}) {
  return {
    subject: record.subject,
    status: record.status,
    priority: record.priority,
    category: record.category ?? null,
    description: record.description ?? null,
    nextFollowUpDate: fechaCorta(record.nextFollowUpDate),
    closedReason: record.closedReason ?? null,
  };
}
