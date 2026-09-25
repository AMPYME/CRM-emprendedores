import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';

const departamentoSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const existing = await prisma.departamento.findFirst({
    where: {
      deletedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new BadRequestError(`Ya existe un departamento llamado "${name}"`);
  }
}

export const departamentoService = {
  async list() {
    return prisma.departamento.findMany({
      where: { deletedAt: null },
      select: departamentoSelect,
      orderBy: { name: 'asc' },
    });
  },

  async create(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('El nombre del departamento es requerido');
    await assertUniqueName(trimmed);
    return prisma.departamento.create({
      data: { name: trimmed },
      select: departamentoSelect,
    });
  },

  async update(id: string, name: string) {
    const current = await prisma.departamento.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Departamento', id);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('El nombre del departamento es requerido');
    await assertUniqueName(trimmed, id);
    return prisma.departamento.update({
      where: { id },
      data: { name: trimmed },
      select: departamentoSelect,
    });
  },

  async remove(id: string) {
    const current = await prisma.departamento.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Departamento', id);
    await prisma.departamento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
