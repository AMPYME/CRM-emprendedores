/**
 * Repository del módulo de contactos.
 * Queries Prisma para CRUD de contactos de entidades.
 */
import { Prisma, EntityContact } from '@prisma/client';
import { prisma } from '../../config/database';

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
   * Elimina un contacto permanentemente.
   */
  async remove(id: string): Promise<EntityContact> {
    return prisma.entityContact.delete({
      where: { id },
    });
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
