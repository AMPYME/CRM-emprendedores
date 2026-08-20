import { AuditAction } from '@prisma/client';
import { auditRepository } from './audit.repository';
import { AuditLogQueryInput } from './audit.validator';
import { PaginationMeta } from '../../shared/types/api-response.types';

export interface AuditActor {
  userId: string;
  userEmail: string;
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

export const auditService = {
  async log(params: {
    action: AuditAction;
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    userId?: string;
    userEmail?: string;
    metadata?: Record<string, unknown>;
  }) {
    return auditRepository.create({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      userEmail: params.userEmail,
      metadata: params.metadata as object | undefined,
      user: params.userId ? { connect: { id: params.userId } } : undefined,
    });
  },

  async list(filters: AuditLogQueryInput) {
    const result = await auditRepository.findAll({
      page: filters.page,
      limit: filters.limit,
      action: filters.action,
      entityType: filters.entityType,
      userId: filters.userId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },
};
