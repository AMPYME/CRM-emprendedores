'use client';

import { useParams } from 'next/navigation';
import { EntityDetail } from '@/components/entities/entity-detail';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <EntityDetail
      entityId={id}
      backHref="/dashboard/companies"
      entityType="COMPANY"
    />
  );
}
