import { AuditAction } from '@prisma/client';
import { auditRepository } from './audit.repository';
import { AuditLogQueryInput } from './audit.validator';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { logger } from '../../shared/logger/logger';

export interface AuditActor {
  userId: string;
  userEmail: string;
}

const CAMPOS_PLANOS = ['province', 'businessName', 'actaNumber', 'amount', 'cedula'] as const;

function nuevoDesdeMetadataPlana(metadata: Record<string, unknown>): Record<string, unknown> | null {
  if (metadata.anterior || metadata.nuevo) return null;
  const nuevo: Record<string, unknown> = {};
  for (const campo of CAMPOS_PLANOS) {
    if (metadata[campo] !== undefined) nuevo[campo] = metadata[campo];
  }
  return Object.keys(nuevo).length > 0 ? nuevo : null;
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
    try {
      return await auditRepository.create({
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        userEmail: params.userEmail,
        metadata: params.metadata as object | undefined,
        user: params.userId ? { connect: { id: params.userId } } : undefined,
      });
    } catch (error) {
      logger.warn('[audit] no se pudo persistir evento', {
        action: params.action,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
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
      data: result.data.map((row) => {
        const { userEmail: _correo, user, ...rest } = row;
        return {
          ...rest,
          user: user
            ? {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username
                  ? user.username.includes('@')
                    ? user.username.split('@')[0] || null
                    : user.username
                  : null,
              }
            : null,
        };
      }),
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  async listByEntity(entityId: string, page: number, limit: number) {
    const result = await auditRepository.findByEntity(entityId, page, limit);
    return {
      data: result.data.map((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        const asUsuario = (value?: string | null) => {
          const raw = value?.trim() || '';
          if (!raw) return null;
          if (raw.includes('@')) {
            const local = raw.split('@')[0]?.trim() || '';
            return local || null;
          }
          return raw;
        };
        const usuarioMeta =
          typeof metadata.usuario === 'string' ? asUsuario(metadata.usuario) : null;
        const sedeMeta = typeof metadata.sede === 'string' ? metadata.sede : null;
        const departamentoMeta = typeof metadata.departamento === 'string' ? metadata.departamento : null;
        const nuevoGuardado = metadata.nuevo ?? nuevoDesdeMetadataPlana(metadata);
        const confirmacion =
          metadata.confirmacion === 'CONFIRMED' || metadata.confirmacion === 'CANCELLED'
            ? metadata.confirmacion
            : null;
        return {
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          createdAt: row.createdAt,
          usuario: usuarioMeta || asUsuario(row.user?.username),
          sede: sedeMeta || row.user?.sede?.name || null,
          departamento: departamentoMeta || row.user?.departamento?.name || null,
          anterior: metadata.anterior ?? null,
          nuevo: nuevoGuardado,
          campos: Array.isArray(metadata.fields) ? metadata.fields : null,
          confirmacion,
          summary: typeof metadata.summary === 'string' ? metadata.summary : null,
        };
      }),
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },
};
