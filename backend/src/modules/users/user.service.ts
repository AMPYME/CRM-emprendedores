import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/app-error';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  sede: {
    select: { id: true, name: true, deletedAt: true },
  },
  departamento: {
    select: { id: true, name: true, deletedAt: true },
  },
} as const;

type OrgRef = { id: string; name: string; deletedAt: Date | null } | null;

function activeOrg(org: OrgRef) {
  return org && !org.deletedAt ? { id: org.id, name: org.name } : null;
}

function presentUser<T extends { sede: OrgRef; departamento: OrgRef }>(user: T) {
  return {
    ...user,
    sede: activeOrg(user.sede),
    departamento: activeOrg(user.departamento),
  };
}

export const userAdminService = {
  async list() {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users.map(presentUser);
  },

  async updateAssignment(
    userId: string,
    input: { sedeId: string | null; departamentoId: string | null }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError('Usuario', userId);

    if (input.sedeId) {
      const sede = await prisma.sede.findFirst({
        where: { id: input.sedeId, deletedAt: null },
        select: { id: true },
      });
      if (!sede) throw new NotFoundError('Sede', input.sedeId);
    }

    if (input.departamentoId) {
      const departamento = await prisma.departamento.findFirst({
        where: { id: input.departamentoId, deletedAt: null },
        select: { id: true },
      });
      if (!departamento) throw new NotFoundError('Departamento', input.departamentoId);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        sedeId: input.sedeId,
        departamentoId: input.departamentoId,
      },
      select: userSelect,
    });
    return presentUser(updated);
  },
};
