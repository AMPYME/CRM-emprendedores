import { Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import type { VerificationQueryInput } from './verification.validator';

const LIST_INCLUDE = {
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  importBatch: { select: { id: true, originalFileName: true } },
  intakeSession: { select: { id: true, expiresAt: true, lastActivityAt: true } },
} satisfies Prisma.VerificationItemInclude;

function buildWhere(
  filters: VerificationQueryInput,
  currentUserId?: string
): Prisma.VerificationItemWhereInput {
  const where: Prisma.VerificationItemWhereInput = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.source) where.source = filters.source;
  if (filters.status) where.status = filters.status;
  if (filters.importId) where.importBatchId = filters.importId;

  if (filters.provinceId) where.province = filters.provinceId.padStart(2, '0').slice(-2);
  if (filters.districtId) where.district = filters.districtId.padStart(4, '0').slice(-4);
  if (filters.corregimientoId) {
    where.corregimiento = filters.corregimientoId.padStart(6, '0').slice(-6);
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { searchText: { contains: q, mode: 'insensitive' } },
      { searchCedula: { contains: q, mode: 'insensitive' } },
      { searchRuc: { contains: q, mode: 'insensitive' } },
    ];
  }

  switch (filters.assignment) {
    case 'unassigned':
      where.assignedToId = null;
      where.status = filters.status ?? { in: ['PENDING', 'ASSIGNED'] };
      break;
    case 'mine':
      if (currentUserId) where.assignedToId = currentUserId;
      break;
    case 'others':
      if (currentUserId) {
        where.assignedToId = { not: null, notIn: [currentUserId] };
      } else {
        where.assignedToId = { not: null };
      }
      break;
    default:
      break;
  }

  return where;
}

export const verificationRepository = {
  async findAll(filters: VerificationQueryInput, currentUserId?: string) {
    const where = buildWhere(filters, currentUserId);
    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      prisma.verificationItem.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.verificationItem.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  async findById(id: string) {
    return prisma.verificationItem.findUnique({
      where: { id },
      include: LIST_INCLUDE,
    });
  },

  async createMany(items: Prisma.VerificationItemCreateManyInput[]) {
    if (items.length === 0) return { count: 0 };
    return prisma.verificationItem.createMany({ data: items, skipDuplicates: true });
  },

  /**
   * Claim atómico: solo si assigned_to_id IS NULL.
   */
  async claimAtomic(id: string, userId: string): Promise<{ count: number }> {
    return prisma.verificationItem.updateMany({
      where: { id, assignedToId: null, status: { in: ['PENDING', 'ASSIGNED'] } },
      data: {
        assignedToId: userId,
        assignedAt: new Date(),
        status: 'ASSIGNED',
      },
    });
  },

  async update(
    id: string,
    data: Prisma.VerificationItemUpdateInput
  ) {
    return prisma.verificationItem.update({ where: { id }, data, include: LIST_INCLUDE });
  },

  async updateStatus(id: string, status: VerificationStatus, extra?: Prisma.VerificationItemUpdateInput) {
    return prisma.verificationItem.update({
      where: { id },
      data: { status, ...extra },
      include: LIST_INCLUDE,
    });
  },

  async linkIntakeSession(id: string, intakeSessionId: string, userId: string) {
    return prisma.verificationItem.update({
      where: { id },
      data: {
        intakeSessionId,
        status: 'IN_REVIEW',
        assignedToId: userId,
        assignedAt: new Date(),
      },
      include: LIST_INCLUDE,
    });
  },

  async release(id: string, userId: string) {
    return prisma.verificationItem.updateMany({
      where: {
        id,
        assignedToId: userId,
        status: { in: ['ASSIGNED', 'IN_REVIEW'] },
      },
      data: {
        assignedToId: null,
        assignedAt: null,
        intakeSessionId: null,
        status: 'PENDING',
      },
    });
  },

  async releaseAny(id: string) {
    return prisma.verificationItem.updateMany({
      where: {
        id,
        status: { in: ['ASSIGNED', 'IN_REVIEW'] },
      },
      data: {
        assignedToId: null,
        assignedAt: null,
        intakeSessionId: null,
        status: 'PENDING',
      },
    });
  },

  async findAssignedForRelease() {
    return prisma.verificationItem.findMany({
      where: { status: { in: ['ASSIGNED', 'IN_REVIEW'] } },
      select: { id: true, intakeSessionId: true, displayName: true },
    });
  },

  async releaseAllAssigned() {
    return prisma.verificationItem.updateMany({
      where: { status: { in: ['ASSIGNED', 'IN_REVIEW'] } },
      data: {
        assignedToId: null,
        assignedAt: null,
        intakeSessionId: null,
        status: 'PENDING',
      },
    });
  },

  /** Borra ítems no validados de un lote (cancelar importación en curso). */
  async deleteUnvalidatedByImportBatch(importBatchId: string) {
    const items = await prisma.verificationItem.findMany({
      where: { importBatchId, status: { not: 'VALIDATED' } },
      select: { id: true, intakeSessionId: true },
    });
    const sessionIds = items
      .map((i) => i.intakeSessionId)
      .filter((id): id is string => !!id);
    if (items.length === 0) {
      return { deleted: 0, sessionIds };
    }
    const result = await prisma.verificationItem.deleteMany({
      where: { id: { in: items.map((i) => i.id) } },
    });
    return { deleted: result.count, sessionIds };
  },
};
