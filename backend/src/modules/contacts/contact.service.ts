/**
 * Service del módulo de contactos.
 * Lógica de negocio para CRUD de contactos de entidades.
 */
import { contactRepository } from './contact.repository';
import { CreateContactInput, UpdateContactInput } from './contact.validator';
import { NotFoundError } from '../../shared/errors/app-error';

export const contactService = {
  /**
   * Lista todos los contactos de una entidad.
   */
  async listByEntity(entityId: string) {
    const exists = await contactRepository.entityExists(entityId);
    if (!exists) {
      throw new NotFoundError('Entidad', entityId);
    }
    return contactRepository.findByEntityId(entityId);
  },

  /**
   * Crea un contacto para una entidad.
   */
  async create(entityId: string, input: CreateContactInput) {
    const exists = await contactRepository.entityExists(entityId);
    if (!exists) {
      throw new NotFoundError('Entidad', entityId);
    }

    return contactRepository.create(entityId, {
      contactType: input.contactType as any,
      contactValue: input.contactValue,
      label: input.label,
      isPrimary: input.isPrimary ?? false,
      isVerified: input.isVerified ?? false,
    });
  },

  /**
   * Actualiza un contacto existente.
   */
  async update(contactId: string, input: UpdateContactInput) {
    const contact = await contactRepository.findById(contactId);
    if (!contact) {
      throw new NotFoundError('Contacto', contactId);
    }

    const updateData: Record<string, unknown> = {};
    if (input.contactType !== undefined) updateData.contactType = input.contactType;
    if (input.contactValue !== undefined) updateData.contactValue = input.contactValue;
    if (input.label !== undefined) updateData.label = input.label;
    if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
    if (input.isVerified !== undefined) updateData.isVerified = input.isVerified;

    return contactRepository.update(contactId, updateData);
  },

  /**
   * Elimina un contacto permanentemente.
   */
  async remove(contactId: string) {
    const contact = await contactRepository.findById(contactId);
    if (!contact) {
      throw new NotFoundError('Contacto', contactId);
    }
    return contactRepository.remove(contactId);
  },
};
