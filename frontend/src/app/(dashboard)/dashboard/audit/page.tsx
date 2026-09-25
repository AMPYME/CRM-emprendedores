import { redirect } from 'next/navigation';

export default function LegacyAuditPage() {
  redirect('/settings/audit');
}
