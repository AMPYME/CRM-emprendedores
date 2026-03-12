'use client';

import { useQuery } from '@tanstack/react-query';
import { relationshipsService, type RelationshipListParams } from '@/services/relationships.service';

const RELATIONSHIPS_KEY = 'relationships';

export function useEntityRelationships(
  entityId: string | undefined,
  params: RelationshipListParams = { direction: 'both', isActive: true }
) {
  return useQuery({
    queryKey: [RELATIONSHIPS_KEY, entityId, params],
    queryFn: () => relationshipsService.listByEntity(entityId!, params),
    enabled: !!entityId,
  });
}

