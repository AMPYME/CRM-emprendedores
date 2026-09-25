import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';

const sedeSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const existing = await prisma.sede.findFirst({
    where: {
      deletedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new BadRequestError(`Ya existe una sede llamada "${name}"`);
  }
}

export const sedeService = {
  async list() {
    return prisma.sede.findMany({
      where: { deletedAt: null },
      select: sedeSelect,
      orderBy: { name: 'asc' },
    });
  },

  async create(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('El nombre de la sede es requerido');
    await assertUniqueName(trimmed);
    return prisma.sede.create({
      data: { name: trimmed },
      select: sedeSelect,
    });
  },

  async update(id: string, name: string) {
    const current = await prisma.sede.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Sede', id);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('El nombre de la sede es requerido');
    await assertUniqueName(trimmed, id);
    return prisma.sede.update({
      where: { id },
      data: { name: trimmed },
      select: sedeSelect,
    });
  },

  async remove(id: string) {
    const current = await prisma.sede.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Sede', id);
    await prisma.sede.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
