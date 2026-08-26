'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  RadioTower, Plus, Copy, Check, ExternalLink, Clock, ArrowRight,
  User, Building2, QrCode, Trash2, KeyRound, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import {
  useIntakeSessions,
  useCreateIntakeSession,
  useDeleteIntakeSession,
  useRegenerateIntakeAccessCode,
} from '@/hooks/use-intake';
import { getIntakeFormUrl, intakeAccessCodeKey } from '@/services/intake.service';
import type { IntakeStatus, IntakeEntityType, IntakeCreateResult } from '@/types/intake.types';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { VerificationQueuePanel } from '@/components/verification/verification-queue';

const statusOptions = [
  { value: '', label: 'Todas' },
  { value: 'DRAFT', label: 'En progreso' },
  { value: 'SUBMITTED', label: 'Enviadas' },
];

const statusConf: Record<string, { variant: BadgeProps['variant']; label: string }> = {
  DRAFT: { variant: 'warning', label: 'En progreso' },
  SUBMITTED: { variant: 'info', label: 'Enviada' },
  VALIDATED: { variant: 'success', label: 'Validada' },
  EXPIRED: { variant: 'default', label: 'Expirada' },
};

const entityTypeOptions: Array<{
  value: IntakeEntityType;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  {
    value: 'PERSON',
    label: 'Persona',
    description: 'Emprendedor o persona natural',
    icon: User,
  },
  {
    value: 'COMPANY',
    label: 'Empresa',
    description: 'Persona jurídica o razón social',
    icon: Building2,
  },
];

const entityTypeBadge: Record<IntakeEntityType, { variant: BadgeProps['variant']; label: string }> = {
  PERSON: { variant: 'info', label: 'Persona' },
  COMPANY: { variant: 'purple', label: 'Empresa' },
};

function StatusBadge({ status }: { status: IntakeStatus }) {
  const c = statusConf[status] || { variant: 'default' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function EntityTypeBadge({ type }: { type: IntakeEntityType }) {
  const c = entityTypeBadge[type] || { variant: 'default' as const, label: type };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function expiresIn(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expirada';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

interface ShareSession {
  sessionId: string;
  entityType: IntakeEntityType;
  accessCode?: string;
}

function persistAccessCode(sessionId: string, accessCode: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(intakeAccessCodeKey(sessionId), accessCode);
}

function SessionShareModal({
  session,
  onClose,
  onViewLive,
}: {
  session: ShareSession | null;
  onClose: () => void;
  onViewLive?: (sessionId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const regenMutation = useRegenerateIntakeAccessCode();
  const formUrl = session ? getIntakeFormUrl(session.sessionId) : '';
  const typeLabel = session ? entityTypeBadge[session.entityType]?.label : '';

  const copyLink = async () => {
    if (!formUrl) return;
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const copyCode = async () => {
    if (!session?.accessCode) return;
    try {
      await navigator.clipboard.writeText(session.accessCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      /* noop */
    }
  };

  const regenerateCode = async () => {
    if (!session) return;
    const result = await regenMutation.mutateAsync(session.sessionId);
    session.accessCode = result.accessCode;
    persistAccessCode(session.sessionId, result.accessCode);
  };

  return (
    <Modal
      isOpen={!!session}
      onClose={onClose}
      title="Enlace de la sesión"
      description={typeLabel ? `Tipo: ${typeLabel}. Comparte este enlace, el QR y el código temporal.` : undefined}
      size="md"
    >
      {session && (
        <div className="space-y-5">
          <div className="flex justify-center rounded-xl bg-gray-50 p-6">
            <QRCodeSVG value={formUrl} size={180} includeMargin />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <KeyRound className="h-4 w-4" />
              Código temporal de acceso
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Una vez cerrada esta ventana, el código no volverá a mostrarse, anota el código. Si lo necesitas otra vez, genera uno nuevo.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={session.accessCode || ''}
                className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.35em] text-amber-950"
              />
              <Button variant="outline" onClick={copyCode} icon={copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}>
                {copiedCode ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={formUrl}
              className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outline"
              onClick={copyLink}
              icon={copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            El enlace expira tras 20 minutos de inactividad y para ver o editar el borrador será necesario este código.
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={regenerateCode}
              isLoading={regenMutation.isPending}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Generar otro código
            </Button>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              {onViewLive && (
                <Button
                  onClick={() => onViewLive(session.sessionId)}
                  icon={<ExternalLink className="h-4 w-4" />}
                >
                  Ver en vivo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function IntakeListPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'queue' | 'field'>('queue');
  const [status, setStatus] = useState<IntakeStatus | ''>('');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [entityType, setEntityType] = useState<IntakeEntityType>('PERSON');
  const [shareSession, setShareSession] = useState<ShareSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShareSession | null>(null);

  useEffect(() => {
    if (!createdBy && currentUser?.email) {
      setCreatedBy(currentUser.email);
    }
  }, [createdBy, currentUser?.email]);

  const { data, isLoading } = useIntakeSessions(status || undefined, createdBy || undefined);
  const sessions = data?.sessions ?? [];
  const createMutation = useCreateIntakeSession();
  const deleteMutation = useDeleteIntakeSession();

  const creatorOptions = useMemo(
    () => [
      { value: '', label: 'Todos los usuarios' },
      ...((data?.creators ?? []).map((creator) => ({
        value: creator,
        label: creator === currentUser?.email ? `${creator} (mi sesión)` : creator,
      }))),
    ],
    [data?.creators, currentUser?.email]
  );

  const openCreate = () => {
    setEntityType('PERSON');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync(entityType);
    persistAccessCode(result.sessionId, result.accessCode);
    setCreateOpen(false);
    setShareSession({ sessionId: result.sessionId, entityType: result.entityType, accessCode: result.accessCode });
  };

  const openShare = (e: React.MouseEvent, s: { sessionId: string; entityType: IntakeEntityType }) => {
    e.stopPropagation();
    setShareSession({ ...s });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.sessionId);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificación"
        description="Cola de registros importados y captura en campo, con revisión antes de crear personas o empresas."
        actions={
          activeTab === 'field' ? (
            <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
              Crear sesión
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'queue'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          )}
        >
          Cola de verificación
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('field')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'field'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          )}
        >
          Captura en campo
        </button>
      </div>

      {activeTab === 'queue' ? (
        <VerificationQueuePanel />
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Select
          label="Estado"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as IntakeStatus | '')}
        />
        <Select
          label="Creado por"
          options={creatorOptions}
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={RadioTower}
            title="No hay sesiones activas"
            description="Crea una sesión para generar un enlace y compartirlo con el emprendedor."
            action={
              <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                Crear sesión
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <li key={s.sessionId}>
                <div className="flex w-full flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/intake/${s.sessionId}`)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-gray-900">{s.displayName}</p>
                        <EntityTypeBadge type={s.entityType} />
                      </div>
                      <p className="truncate text-xs text-gray-400">{s.sessionId}</p>
                      <p className="truncate text-xs text-gray-500">
                        Creado por: <span className="font-medium text-gray-700">{s.createdBy || 'Sin usuario'}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
                        <Clock className="h-3.5 w-3.5" />
                        {expiresIn(s.expiresAt)}
                      </span>
                      <StatusBadge status={s.status} />
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </button>
                  <div className="flex items-center gap-2 lg:ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Ver enlace, QR y código"
                      onClick={(e) => openShare(e, s)}
                      icon={<QrCode className="h-4 w-4" />}
                    >
                      <span className="hidden sm:inline">Enlace</span>
                    </Button>
                    {s.status !== 'VALIDATED' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Eliminar sesión"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(s);
                        }}
                        icon={<Trash2 className="h-4 w-4 text-red-600" />}
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva sesión de verificación"
        description="¿Qué tipo de registro completará el emprendedor?"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid gap-3">
            {entityTypeOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = entityType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEntityType(opt.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                    selected
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      selected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{opt.label}</p>
                    <p className="text-sm text-gray-500">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={createMutation.isPending}
              icon={<Plus className="h-4 w-4" />}
            >
              Crear y generar enlace
            </Button>
          </div>
        </div>
      </Modal>

      <SessionShareModal
        session={shareSession}
        onClose={() => setShareSession(null)}
        onViewLive={(id) => {
          setShareSession(null);
          router.push(`/dashboard/intake/${id}`);
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar sesión"
        message="Se eliminará esta sesión. Los datos ya guardados en el padrón no se tocan. ¿Continuar?"
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
        </>
      )}
    </div>
  );
}
