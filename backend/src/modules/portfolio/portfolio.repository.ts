/**
 * Repository del módulo de cartera/seguimiento.
 * Queries Prisma para CRUD de PortfolioRecord + PortfolioAction.
 */
import { Prisma, PortfolioRecord, PortfolioAction } from '@prisma/client';
import { prisma } from '../../config/database';
import { PortfolioQueryInput } from './portfolio.validator';
import { PaginatedResult } from '../../shared/types/api-response.types';

// ── Includes reutilizables ────────────────────────────────────────

const PORTFOLIO_LIST_INCLUDES = {
  entity: {
    select: {
      id: true,
      displayName: true,
      entityType: true,
      status: true,
      actEc: true,
      person: { select: { cedula: true, documentNumber: true, economicActivity: true } },
      company: { select: { ruc: true, economicActivity: true } },
    },
  },
  assignedTo: {
    select: {
      id: true,
      username: true,
    },
  },
  sede: {
    select: {
      id: true,
      name: true,
    },
  },
  departamento: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      actions: true,
    },
  },
} satisfies Prisma.PortfolioRecordInclude;

const PORTFOLIO_DETAIL_INCLUDES = {
  entity: {
    select: {
      id: true,
      displayName: true,
      entityType: true,
      status: true,
      province: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      username: true,
    },
  },
  sede: {
    select: {
      id: true,
      name: true,
    },
  },
  departamento: {
    select: {
      id: true,
      name: true,
    },
  },
  actions: {
    orderBy: { actionDate: 'desc' as const },
    include: {
      performedBy: {
        select: {
          id: true,
          username: true,
        },
      },
      sede: { select: { id: true, name: true } },
      departamento: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PortfolioRecordInclude;

// ── Tipos derivados ───────────────────────────────────────────────

export type PortfolioWithRelations = Prisma.PortfolioRecordGetPayload<{
  include: typeof PORTFOLIO_LIST_INCLUDES;
}>;

export type PortfolioDetail = Prisma.PortfolioRecordGetPayload<{
  include: typeof PORTFOLIO_DETAIL_INCLUDES;
}>;

// ── Helpers ───────────────────────────────────────────────────────

function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.PortfolioRecordOrderByWithRelationInput {
  const map: Record<string, Prisma.PortfolioRecordOrderByWithRelationInput> = {
    createdAt: { createdAt: sortOrder },
    updatedAt: { updatedAt: sortOrder },
    nextFollowUpDate: { nextFollowUpDate: sortOrder },
    priority: { priority: sortOrder },
    status: { status: sortOrder },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

// ── Repository ────────────────────────────────────────────────────

export const portfolioRepository = {
  /**
   * Listado paginado de registros de cartera con filtros.
   */
  async findAll(filters: PortfolioQueryInput): Promise<PaginatedResult<PortfolioWithRelations>> {
    const where: Prisma.PortfolioRecordWhereInput = {};
    const now = new Date();

    if (filters.status) {
      where.status = filters.status;
    } else if (filters.excludeResolved) {
      where.status = { not: 'RESOLVED' };
    }
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.sedeId) where.sedeId = filters.sedeId;
    if (filters.departamentoId) where.departamentoId = filters.departamentoId;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };

    // Filtros especiales de vista
    if (filters.view === 'overdue') {
      // Cartera vencida: fecha de seguimiento pasada, no cerrada ni resuelta
      where.nextFollowUpDate = { lt: now };
      where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    } else if (filters.view === 'upcoming') {
      // Cartera próxima: seguimiento en los próximos 7 días
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      where.nextFollowUpDate = { gte: now, lte: nextWeek };
      where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    } else if (filters.view === 'unmanaged') {
      // Sin gestionar: estado NEW, sin acciones
      where.status = 'NEW';
      where.actions = { none: {} };
    }

    const documento = filters.documento?.trim();
    if (documento) {
      where.entity = {
        OR: [
          { person: { OR: [{ cedula: documento }, { documentNumber: documento }] } },
          { company: { ruc: documento } },
        ],
      };
    } else if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
        { entity: { displayName: { contains: filters.search, mode: 'insensitive' } } },
        { entity: { person: { cedula: { contains: filters.search } } } },
        { entity: { person: { documentNumber: { contains: filters.search } } } },
        { entity: { company: { ruc: { contains: filters.search } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.portfolioRecord.findMany({
        where,
        include: PORTFOLIO_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.portfolioRecord.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Registros de cartera de una entidad.
   */
  async findByEntity(entityId: string) {
    return prisma.portfolioRecord.findMany({
      where: { entityId },
      include: PORTFOLIO_LIST_INCLUDES,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Detalle de un registro de cartera.
   */
  async findById(id: string): Promise<PortfolioDetail | null> {
    return prisma.portfolioRecord.findUnique({
      where: { id },
      include: PORTFOLIO_DETAIL_INCLUDES,
    });
  },

  /**
   * Crea un registro de cartera.
   */
  async create(data: Prisma.PortfolioRecordCreateInput): Promise<PortfolioWithRelations> {
    return prisma.portfolioRecord.create({
      data,
      include: PORTFOLIO_LIST_INCLUDES,
    });
  },

  /**
   * Actualiza un registro de cartera.
   */
  async update(id: string, data: Prisma.PortfolioRecordUpdateInput): Promise<PortfolioDetail> {
    return prisma.portfolioRecord.update({
      where: { id },
      data,
      include: PORTFOLIO_DETAIL_INCLUDES,
    });
  },

  /**
   * Cierra un registro de cartera.
   */
  async close(id: string, reason?: string): Promise<PortfolioDetail> {
    return prisma.portfolioRecord.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedReason: reason,
      },
      include: PORTFOLIO_DETAIL_INCLUDES,
    });
  },

  /**
   * Agrega una acción a un registro de cartera.
   */
  async addAction(data: Prisma.PortfolioActionCreateInput): Promise<PortfolioAction> {
    return prisma.portfolioAction.create({
      data,
      include: {
        performedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        sede: { select: { id: true, name: true } },
        departamento: { select: { id: true, name: true } },
      },
    });
  },

  /**
   * Acciones de un registro de cartera.
   */
  async findActions(portfolioId: string): Promise<PortfolioAction[]> {
    return prisma.portfolioAction.findMany({
      where: { portfolioId },
      include: {
        performedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        sede: { select: { id: true, name: true } },
        departamento: { select: { id: true, name: true } },
      },
      orderBy: { actionDate: 'desc' },
    });
  },

  /**
   * Verifica que la entidad existe y está activa.
   */
  async entityExists(entityId: string): Promise<boolean> {
    const count = await prisma.entity.count({
      where: { id: entityId, status: { not: 'MERGED' } },
    });
    return count > 0;
  },

  /**
   * Verifica que el usuario existe.
   */
  async userExists(userId: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id: userId, isActive: true },
    });
    return count > 0;
  },

  /**
   * Estadísticas de resumen de cartera.
   */
  async getStats() {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [total, byStatus, overdue, upcoming, unmanaged] = await Promise.all([
      prisma.portfolioRecord.count(),
      prisma.portfolioRecord.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.portfolioRecord.count({
        where: {
          nextFollowUpDate: { lt: now },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
      prisma.portfolioRecord.count({
        where: {
          nextFollowUpDate: { gte: now, lte: nextWeek },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
      prisma.portfolioRecord.count({
        where: {
          status: 'NEW',
          actions: { none: {} },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach((s) => {
      statusCounts[s.status] = s._count.id;
    });

    return { total, byStatus: statusCounts, overdue, upcoming, unmanaged };
  },
};
