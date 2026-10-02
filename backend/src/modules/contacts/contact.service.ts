/**
 * Service del módulo de contactos.
 * Lógica de negocio para CRUD de contactos de entidades.
 */
import { contactRepository } from './contact.repository';
import { CreateContactInput, UpdateContactInput } from './contact.validator';
import { NotFoundError } from '../../shared/errors/app-error';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext, cambios } from '../audit/audit-snapshot';
import { personChangeService } from '../person-changes/person-change.service';

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
  async create(entityId: string, input: CreateContactInput, actor?: AuditActor) {
    const exists = await contactRepository.entityExists(entityId);
    if (!exists) {
      throw new NotFoundError('Entidad', entityId);
    }
    await personChangeService.assertNoPendingForEntity(entityId);

    const { contactApiRepository } = await import('../../infrastructure/database');
    const id = await contactApiRepository.add(actor?.userId ?? 'system', {
      entityId,
      contactType: input.contactType,
      contactValue: input.contactValue,
      label: input.label,
      isPrimary: input.isPrimary ?? false,
    });

    const contact = await contactRepository.findById(id);
    if (!contact) throw new NotFoundError('Contacto', id);
    return contact;
  },

  /**
   * Actualiza un contacto existente.
   */
  async update(contactId: string, input: UpdateContactInput, actor?: AuditActor) {
    const contact = await contactRepository.findById(contactId);
    if (!contact) {
      throw new NotFoundError('Contacto', contactId);
    }
    await personChangeService.assertNoPendingForEntity(contact.entityId);

    const updateData: Record<string, unknown> = {};
    if (input.contactType !== undefined) updateData.contactType = input.contactType;
    if (input.contactValue !== undefined) updateData.contactValue = input.contactValue;
    if (input.label !== undefined) updateData.label = input.label;
    if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
    if (input.isVerified !== undefined) updateData.isVerified = input.isVerified;

    const updated = await contactRepository.update(contactId, updateData);
    const quien = await actorContext(actor);
    const { anterior, nuevo } = cambios(
      {
        contactType: contact.contactType,
        contactValue: contact.contactValue,
        label: contact.label,
        isPrimary: contact.isPrimary,
      },
      input as Record<string, unknown>,
    );
    await auditService.log({
      action: 'UPDATE',
      entityType: 'CONTACT',
      entityId: contact.entityId,
      entityLabel: updated.contactValue,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: { ...quien, anterior, nuevo },
    });
    return updated;
  },

  /**
   * Elimina un contacto permanentemente.
   */
  async remove(contactId: string, actor?: AuditActor) {
    const contact = await contactRepository.findById(contactId);
    if (!contact) {
      throw new NotFoundError('Contacto', contactId);
    }
    await personChangeService.assertNoPendingForEntity(contact.entityId);
    const { contactApiRepository } = await import('../../infrastructure/database');
    await contactApiRepository.softDelete(actor?.userId ?? 'system', contactId);
    return contact;
  },
};
