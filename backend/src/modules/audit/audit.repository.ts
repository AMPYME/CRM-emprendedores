import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface AuditLogQuery {
  page: number;
  limit: number;
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export const auditRepository = {
  async create(data: Prisma.AuditLogCreateInput) {
    return prisma.auditLog.create({ data });
  },

  async findAll(filters: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.userId) where.userId = filters.userId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },
};
