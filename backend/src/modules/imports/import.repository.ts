/**
 * Repository del modulo de importaciones.
 * Queries Prisma para ImportBatch + StagingRow.
 */
import { Prisma, ImportBatch, StagingRow, ImportStatus, StagingRowStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ImportQueryInput, StagingQueryInput } from './import.validator';
import { PaginatedResult } from '../../shared/types/api-response.types';
import { ExtractedFields } from './import.types';

// ── Includes reutilizables ────────────────────────────────────────

const BATCH_LIST_INCLUDES = {
  importedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  _count: {
    select: {
      stagingRows: true,
      entities: true,
    },
  },
} satisfies Prisma.ImportBatchInclude;

const BATCH_DETAIL_INCLUDES = {
  importedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  _count: {
    select: {
      stagingRows: true,
      entities: true,
    },
  },
} satisfies Prisma.ImportBatchInclude;

const STAGING_ROW_INCLUDES = {
  matchedEntity: {
    select: {
      id: true,
      displayName: true,
      entityType: true,
      status: true,
    },
  },
} satisfies Prisma.StagingRowInclude;

// ── Tipos derivados ───────────────────────────────────────────────

export type BatchWithRelations = Prisma.ImportBatchGetPayload<{
  include: typeof BATCH_LIST_INCLUDES;
}>;

export type StagingRowWithRelations = Prisma.StagingRowGetPayload<{
  include: typeof STAGING_ROW_INCLUDES;
}>;

// ── Helpers ───────────────────────────────────────────────────────

function buildBatchOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.ImportBatchOrderByWithRelationInput {
  const map: Record<string, Prisma.ImportBatchOrderByWithRelationInput> = {
    createdAt: { createdAt: sortOrder },
    status: { status: sortOrder },
    totalRows: { totalRows: sortOrder },
    fileName: { fileName: sortOrder },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

function buildStagingOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.StagingRowOrderByWithRelationInput {
  const map: Record<string, Prisma.StagingRowOrderByWithRelationInput> = {
    rowNumber: { rowNumber: sortOrder },
    status: { status: sortOrder },
    matchScore: { matchScore: sortOrder },
    createdAt: { createdAt: sortOrder },
  };
  return map[sortBy || ''] || { rowNumber: sortOrder };
}

// ── Repository ────────────────────────────────────────────────────

export const importRepository = {
  // ── ImportBatch ──────────────────────────────────────────────

  /**
   * Listado paginado de lotes de importacion.
   */
  async findAllBatches(
    filters: ImportQueryInput
  ): Promise<PaginatedResult<BatchWithRelations>> {
    const where: Prisma.ImportBatchWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.sourceType) where.sourceType = { contains: filters.sourceType, mode: 'insensitive' };

    if (filters.search) {
      where.OR = [
        { fileName: { contains: filters.search, mode: 'insensitive' } },
        { originalFileName: { contains: filters.search, mode: 'insensitive' } },
        { sourceType: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.importBatch.findMany({
        where,
        include: BATCH_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildBatchOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.importBatch.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Detalle de un lote de importacion.
   */
  async findBatchById(id: string): Promise<BatchWithRelations | null> {
    return prisma.importBatch.findUnique({
      where: { id },
      include: BATCH_DETAIL_INCLUDES,
    });
  },

  /**
   * Crea un lote de importacion.
   */
  async createBatch(data: {
    fileName: string;
    originalFileName: string;
    sourceType: string;
    targetEventId?: string;
    columnMapping?: Record<string, string>;
    importedById?: string;
  }): Promise<BatchWithRelations> {
    return prisma.importBatch.create({
      data: {
        fileName: data.fileName,
        originalFileName: data.originalFileName,
        sourceType: data.sourceType,
        columnMapping: data.columnMapping ? (data.columnMapping as any) : undefined,
        targetEventId: data.targetEventId,
        importedById: data.importedById,
      },
      include: BATCH_LIST_INCLUDES,
    });
  },

  /**
   * Actualiza un lote de importacion.
   */
  async updateBatch(
    id: string,
    data: Prisma.ImportBatchUpdateInput
  ): Promise<BatchWithRelations> {
    return prisma.importBatch.update({
      where: { id },
      data,
      include: BATCH_LIST_INCLUDES,
    });
  },

  /**
   * Elimina un lote de importacion y sus filas staging (cascade).
   */
  async deleteBatch(id: string): Promise<void> {
    await prisma.importBatch.delete({ where: { id } });
  },

  /**
   * Limpia el batch para permitir reintento sin re-subir archivo.
   * - Borra staging rows del batch
   * - Resetea stats/errores/timestamps y deja status en PENDING
   */
  async resetBatchForRetry(batchId: string): Promise<BatchWithRelations> {
    return prisma.$transaction(async (tx) => {
      await tx.stagingRow.deleteMany({ where: { importBatchId: batchId } });

      return tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'PENDING',
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          duplicateRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errorLog: Prisma.DbNull,
          startedAt: null,
          completedAt: null,
        },
        include: BATCH_LIST_INCLUDES,
      });
    });
  },

  /**
   * Obtiene estadisticas resumidas por status de los staging rows de un batch.
   */
  async getBatchStats(batchId: string) {
    const byStatus = await prisma.stagingRow.groupBy({
      by: ['status'],
      where: { importBatchId: batchId },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    byStatus.forEach((s) => {
      counts[s.status] = s._count.id;
    });

    return counts;
  },

  // ── StagingRow ──────────────────────────────────────────────

  /**
   * Listado paginado de filas staging de un batch.
   */
  async findStagingRows(
    batchId: string,
    filters: StagingQueryInput
  ): Promise<PaginatedResult<StagingRowWithRelations>> {
    const where: Prisma.StagingRowWhereInput = {
      importBatchId: batchId,
    };

    if (filters.status) where.status = filters.status;
    if (filters.hasErrors === true) {
      where.NOT = { validationErrors: { equals: Prisma.DbNull } };
    }
    if (filters.hasErrors === false) {
      where.validationErrors = { equals: Prisma.DbNull };
    }

    if (filters.search) {
      // Buscar en campos extraidos
      where.OR = [
        { extractedCedula: { contains: filters.search, mode: 'insensitive' } },
        { extractedRuc: { contains: filters.search, mode: 'insensitive' } },
        { extractedFirstName: { contains: filters.search, mode: 'insensitive' } },
        { extractedLastName: { contains: filters.search, mode: 'insensitive' } },
        { extractedEmail: { contains: filters.search, mode: 'insensitive' } },
        { extractedPhone: { contains: filters.search, mode: 'insensitive' } },
        { extractedBusinessName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.stagingRow.findMany({
        where,
        include: STAGING_ROW_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildStagingOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.stagingRow.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Detalle de una fila staging.
   */
  async findStagingRowById(id: string): Promise<StagingRowWithRelations | null> {
    return prisma.stagingRow.findUnique({
      where: { id },
      include: STAGING_ROW_INCLUDES,
    });
  },

  /**
   * Crea multiples filas staging de un batch (bulk insert).
   */
  async createManyStagingRows(
    rows: Array<{
      importBatchId: string;
      rowNumber: number;
      rawData: Record<string, unknown>;
      extractedCedula?: string;
      extractedRuc?: string;
      extractedFirstName?: string;
      extractedLastName?: string;
      extractedEmail?: string;
      extractedPhone?: string;
      extractedBusinessName?: string;
    }>
  ): Promise<number> {
    const result = await prisma.stagingRow.createMany({
      data: rows.map((r) => ({
        importBatchId: r.importBatchId,
        rowNumber: r.rowNumber,
        rawData: r.rawData as any,
        extractedCedula: r.extractedCedula || null,
        extractedRuc: r.extractedRuc || null,
        extractedFirstName: r.extractedFirstName || null,
        extractedLastName: r.extractedLastName || null,
        extractedEmail: r.extractedEmail || null,
        extractedPhone: r.extractedPhone || null,
        extractedBusinessName: r.extractedBusinessName || null,
      })),
    });

    return result.count;
  },

  /**
   * Actualiza una fila staging (resultado de validacion/dedup/resolucion).
   */
  async updateStagingRow(
    id: string,
    data: {
      status?: StagingRowStatus;
      validationErrors?: Record<string, string[]> | null;
      matchedEntityId?: string | null;
      matchScore?: number | null;
      matchReason?: string | null;
      processedAt?: Date;
    }
  ): Promise<StagingRowWithRelations> {
    return prisma.stagingRow.update({
      where: { id },
      data: {
        status: data.status,
        validationErrors: data.validationErrors !== undefined
          ? (data.validationErrors as any)
          : undefined,
        matchedEntityId: data.matchedEntityId,
        matchScore: data.matchScore,
        matchReason: data.matchReason,
        processedAt: data.processedAt,
      },
      include: STAGING_ROW_INCLUDES,
    });
  },

  /**
   * Obtiene todas las filas PENDING de un batch (para procesamiento).
   */
  async findPendingStagingRows(batchId: string): Promise<StagingRow[]> {
    return prisma.stagingRow.findMany({
      where: {
        importBatchId: batchId,
        status: 'PENDING',
      },
      orderBy: { rowNumber: 'asc' },
    });
  },

  /**
   * Obtiene filas VALID listas para importar.
   */
  async findValidStagingRows(batchId: string): Promise<StagingRow[]> {
    return prisma.stagingRow.findMany({
      where: {
        importBatchId: batchId,
        status: 'VALID',
      },
      orderBy: { rowNumber: 'asc' },
    });
  },

  /**
   * Cuenta filas staging por status para un batch.
   */
  async countStagingByStatus(
    batchId: string,
    status: StagingRowStatus
  ): Promise<number> {
    return prisma.stagingRow.count({
      where: { importBatchId: batchId, status },
    });
  },

  /**
   * Actualiza estadisticas del batch basandose en las filas staging.
   */
  async refreshBatchStats(batchId: string): Promise<BatchWithRelations> {
    const stats = await prisma.stagingRow.groupBy({
      by: ['status'],
      where: { importBatchId: batchId },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    stats.forEach((s) => {
      counts[s.status] = s._count.id;
    });

    const totalRows = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return prisma.importBatch.update({
      where: { id: batchId },
      data: {
        totalRows,
        validRows: counts['VALID'] || 0,
        invalidRows: (counts['INVALID'] || 0) + (counts['ERROR'] || 0),
        duplicateRows: (counts['DUPLICATE_EXACT'] || 0) + (counts['DUPLICATE_POSSIBLE'] || 0),
        importedRows: counts['IMPORTED'] || 0,
        skippedRows: counts['SKIPPED'] || 0,
      },
      include: BATCH_LIST_INCLUDES,
    });
  },

  /**
   * Verifica si un evento existe (para importaciones vinculadas).
   */
  async eventExists(eventId: string): Promise<boolean> {
    const count = await prisma.event.count({ where: { id: eventId } });
    return count > 0;
  },
};
