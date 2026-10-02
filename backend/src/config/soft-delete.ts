import { Prisma, PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set([
  'VerificationItem',
  'EntityContact',
  'EventRegistration',
  'ImportBatch',
  'StagingRow',
  'IntakeSession',
  'IntakeEntity',
  'Entity',
  'Person',
  'Company',
  'User',
  'EntityRelationship',
  'PortfolioRecord',
  'CapitalSemilla',
  'Sede',
  'Departamento',
]);

const FILTERED_READS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
]);

function andNotDeleted(args: Prisma.MiddlewareParams['args']): Prisma.MiddlewareParams['args'] {
  const next = { ...(args ?? {}) };
  next.where = { AND: [next.where ?? {}, { deletedAt: null }] };
  return next;
}

export function registerSoftDelete(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
      return next(params);
    }

    if (params.action === 'delete' || params.action === 'deleteMany') {
      throw new Error(
        `Borrado físico no permitido en ${params.model}. Use el procedimiento de borrado lógico.`
      );
    }

    if (params.action === 'findUnique') {
      params.action = 'findFirst';
      params.args = andNotDeleted(params.args);
    } else if (params.action === 'findUniqueOrThrow') {
      params.action = 'findFirstOrThrow';
      params.args = andNotDeleted(params.args);
    } else if (FILTERED_READS.has(params.action)) {
      params.args = andNotDeleted(params.args);
    }

    return next(params);
  });
}
