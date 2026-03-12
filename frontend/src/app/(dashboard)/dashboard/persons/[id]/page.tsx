'use client';

import { useParams } from 'next/navigation';
import { EntityDetail } from '@/components/entities/entity-detail';

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <EntityDetail
      entityId={id}
      backHref="/dashboard/persons"
      entityType="PERSON"
    />
  );
}
