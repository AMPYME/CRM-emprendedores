/**
 * Repository del módulo de contactos.
 * Queries Prisma para CRUD de contactos de entidades.
 */
import { Prisma, EntityContact } from '@prisma/client';
import { prisma } from '../../config/database';
import { callProcedure } from '../../shared/db/procedures';

export const contactRepository = {
  /**
   * Lista contactos de una entidad.
   */
  async findByEntityId(entityId: string): Promise<EntityContact[]> {
    return prisma.entityContact.findMany({
      where: { entityId },
      orderBy: [{ isPrimary: 'desc' }, { contactType: 'asc' }],
    });
  },

  /**
   * Busca un contacto por ID.
   */
  async findById(id: string): Promise<EntityContact | null> {
    return prisma.entityContact.findUnique({
      where: { id },
    });
  },

  /**
   * Crea un contacto para una entidad.
   */
  async create(entityId: string, data: Prisma.EntityContactCreateWithoutEntityInput): Promise<EntityContact> {
    return prisma.entityContact.create({
      data: {
        ...data,
        entity: { connect: { id: entityId } },
      },
    });
  },

  /**
   * Actualiza un contacto.
   */
  async update(id: string, data: Prisma.EntityContactUpdateInput): Promise<EntityContact> {
    return prisma.entityContact.update({
      where: { id },
      data,
    });
  },

  /**
   * Borrado lógico del contacto. El procedimiento guarda quién lo dio de baja.
   */
  async remove(id: string, deletedById?: string | null): Promise<EntityContact> {
    const current = await prisma.entityContact.findFirst({ where: { id } });
    if (!current) {
      throw new Error('CONTACT_NOT_FOUND');
    }
    await callProcedure(prisma, 'sp_soft_delete_contact', [
      { value: id, cast: 'text' },
      { value: deletedById ?? null, cast: 'text' },
    ]);
    return current;
  },

  /**
   * Verifica si una entidad existe.
   */
  async entityExists(entityId: string): Promise<boolean> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true },
    });
    return !!entity;
  },
};
