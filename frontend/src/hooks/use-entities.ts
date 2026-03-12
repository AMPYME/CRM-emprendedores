'use client';

import { useQuery } from '@tanstack/react-query';
import { entitiesService, type EntityFilters } from '@/services/entities.service';
import { contactsService } from '@/services/contacts.service';

const ENTITIES_KEY = 'entities';
const CONTACTS_KEY = 'contacts';

export function useEntities(filters: EntityFilters = {}) {
  return useQuery({
    queryKey: [ENTITIES_KEY, filters],
    queryFn: () => entitiesService.list(filters),
  });
}

export function useEntity(id: string | undefined) {
  return useQuery({
    queryKey: [ENTITIES_KEY, id],
    queryFn: () => entitiesService.getById(id!),
    enabled: !!id,
  });
}

export function useEntityContacts(entityId: string | undefined) {
  return useQuery({
    queryKey: [CONTACTS_KEY, entityId],
    queryFn: () => contactsService.listByEntity(entityId!),
    enabled: !!entityId,
  });
}
