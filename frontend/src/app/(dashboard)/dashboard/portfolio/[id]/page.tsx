'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FolderKanban, Plus, Clock, AlertTriangle, User,
  Phone, Mail, MessageSquare, FileText, Eye, Edit, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  usePortfolio, useUpdatePortfolio, usePortfolioActions, useAddPortfolioAction,
} from '@/hooks/use-portfolio';
import { formatDate, formatDateOnly, toDateOnlyString, cn } from '@/lib/utils';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import { provinciaNombre } from '@/lib/division-politica';
import type { PortfolioAction, ActionType } from '@/types/entities.types';

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'primary', IN_PROGRESS: 'warning', WAITING: 'default',
  RESOLVED: 'success', CLOSED: 'default',
};
const statusLabel: Record<string, string> = {
  NEW: 'Nuevo', IN_PROGRESS: 'En progreso', WAITING: 'En espera',
  RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
};
const actionTypeIcons: Record<string, React.ElementType> = {
  CALL: Phone, EMAIL_ACTION: Mail, WHATSAPP: MessageSquare,
  VISIT: Eye, MEETING: User, NOTE: FileText, DOCUMENT: FileText,
  STATUS_CHANGE: Activity, OTHER: Activity,
};
const actionTypeLabel: Record<string, string> = {
  CALL: 'Llamada', EMAIL_ACTION: 'Correo', WHATSAPP: 'WhatsApp',
  VISIT: 'Visita', MEETING: 'Reunión', NOTE: 'Nota', DOCUMENT: 'Documento',
  STATUS_CHANGE: 'Cambio de estado', OTHER: 'Otro',
};
const statusOptions = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'WAITING', label: 'En espera' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'CLOSED', label: 'Cerrado' },
];
const actionTypeOptions = [
  { value: 'CALL', label: 'Llamada' },
  { value: 'EMAIL_ACTION', label: 'Correo electrónico' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISIT', label: 'Visita' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'NOTE', label: 'Nota' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'OTHER', label: 'Otro' },
];

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const readOnly = isReadOnlyRole(useAuthStore((state) => state.user?.role));

  const { data: record, isLoading, error } = usePortfolio(id);
  const actions = usePortfolioActions(id);
  const updateMutation = useUpdatePortfolio();
  const addAction = useAddPortfolioAction();

  const [activeTab, setActiveTab] = useState('info');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', nextFollowUpDate: '' });

  // Add action modal
  const [actionOpen, setActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState({
    actionType: 'NOTE' as string,
    description: '',
    result: '',
    nextSteps: '',
    actionDate: new Date().toISOString().slice(0, 10),
  });

  const openEdit = () => {
    if (!record) return;
    setEditForm({
      status: record.status,
      nextFollowUpDate: record.nextFollowUpDate ? toDateOnlyString(record.nextFollowUpDate) : '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!record) return;
    try {
      await updateMutation.mutateAsync({
        id: record.id,
        data: {
          status: editForm.status as any,
          nextFollowUpDate: editForm.nextFollowUpDate || undefined,
        },
      });
      setEditOpen(false);
    } catch { /* toast */ }
  };

  const handleAddAction = async () => {
    if (!actionForm.description.trim() || !id) return;
    try {
      await addAction.mutateAsync({
        portfolioId: id,
        data: {
          actionType: actionForm.actionType as ActionType,
          description: actionForm.description,
          result: actionForm.result || undefined,
          nextSteps: actionForm.nextSteps || undefined,
          actionDate: actionForm.actionDate,
        },
      });
      setActionOpen(false);
      setActionForm({
        actionType: 'NOTE', description: '', result: '', nextSteps: '',
        actionDate: new Date().toISOString().slice(0, 10),
      });
    } catch { /* toast */ }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" text="Cargando registro..." /></div>;
  }

  if (error || !record) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-red-500">No se pudo cargar el registro.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/portfolio')}>Volver</Button>
      </div>
    );
  }

  const todayYmd = toDateOnlyString(new Date());
  const followUpYmd = record.nextFollowUpDate ? toDateOnlyString(record.nextFollowUpDate) : '';
  const isOverdue = Boolean(followUpYmd && followUpYmd < todayYmd);
  const actionsData: PortfolioAction[] = actions.data ?? [];

  const tabs = [
    { id: 'info', label: 'Información', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'actions', label: 'Historial de acciones', icon: <Activity className="h-4 w-4" />, count: actionsData.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/portfolio')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{record.subject}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={statusBadge[record.status] || 'default'}>
              {statusLabel[record.status] || record.status}
            </Badge>
            {record.category && <span className="text-xs text-gray-400">{record.category}</span>}
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle className="h-3 w-3" /> Vencido
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!readOnly && record.status !== 'RESOLVED' && record.status !== 'CLOSED' && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                updateMutation.mutate({ id: record.id, data: { status: 'RESOLVED' } });
              }}
              isLoading={updateMutation.isPending}
            >
              Marcar como resuelto
            </Button>
          )}
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" icon={<Edit className="h-4 w-4" />} onClick={openEdit}>
              Editar
            </Button>
          )}
          {!readOnly && (
            <Button type="button" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setActionOpen(true)}>
              Acción
            </Button>
          )}
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── INFO TAB ─────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Detalles del caso">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <InfoRow label="Asunto" value={record.subject} span2 />
                <InfoRow label="Descripción" value={record.description} span2 />
                <InfoRow label="Categoría" value={record.category} />
                <InfoRow label="Estado" value={statusLabel[record.status]} />
                <InfoRow label="Próximo seguimiento" value={record.nextFollowUpDate ? formatDateOnly(record.nextFollowUpDate) : null} />
                {record.closedAt && (
                  <>
                    <InfoRow label="Cerrado el" value={formatDate(record.closedAt)} />
                    <InfoRow label="Motivo de cierre" value={record.closedReason} />
                  </>
                )}
                <InfoRow label="Creado" value={formatDate(record.createdAt)} />
              </dl>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Entity info */}
            <Card title="Entidad">
              {record.entity ? (
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">{record.entity.displayName}</p>
                  <p className="text-xs text-gray-400">{record.entity.entityType === 'COMPANY' ? 'Empresa' : 'Persona'}</p>
                  {record.entity.province && (
                    <p className="text-xs text-gray-500">{provinciaNombre(record.entity.province)}</p>
                  )}
                  <Button
                    variant="outline" size="sm" className="mt-2 w-full"
                    onClick={() => {
                      const type = record.entity?.entityType?.toLowerCase();
                      const routes: Record<string, string> = {
                        person: 'persons', company: 'companies',
                      };
                      router.push(`/dashboard/${routes[type ?? ''] ?? 'persons'}/${record.entity?.id}`);
                    }}
                  >
                    Ver entidad
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin entidad asociada</p>
              )}
            </Card>

            {/* Assigned to */}
            <Card title="Asignado a">
              {record.assignedTo ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-gray-900">{record.assignedTo.username || '—'}</p>
                  {record.departamento?.name && (
                    <p className="text-gray-500">{record.departamento.name}</p>
                  )}
                  {record.sede?.name && (
                    <p className="text-gray-500">{record.sede.name}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin asignar</p>
              )}
            </Card>

            {/* Next follow-up */}
            {record.nextFollowUpDate && (
              <Card>
                <div className="flex items-center gap-3">
                  <Clock className={cn('h-5 w-5', isOverdue ? 'text-red-500' : 'text-blue-500')} />
                  <div>
                    <p className="text-xs text-gray-400">Próximo seguimiento</p>
                    <p className={cn('font-medium', isOverdue ? 'text-red-600' : 'text-gray-900')}>
                      {formatDateOnly(record.nextFollowUpDate)}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIONS TAB ──────────────────────────── */}
      {activeTab === 'actions' && (
        <Card title="Historial de acciones">
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setActionOpen(true)}>
              Registrar acción
            </Button>
          </div>

          {actions.isLoading ? (
            <LoadingSpinner text="Cargando acciones..." />
          ) : actionsData.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Sin acciones registradas"
              description="Registra la primera acción de seguimiento."
              action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setActionOpen(true)}>Registrar</Button>}
            />
          ) : (
            <div className="relative">
              {/* Timeline */}
              <div className="absolute left-5 top-0 h-full w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {actionsData.map((action) => {
                  const Icon = actionTypeIcons[action.actionType] || Activity;
                  return (
                    <div key={action.id} className="relative flex gap-4 pl-2">
                      <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white border-2 border-gray-200">
                        <Icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default" className="text-[10px]">
                            {actionTypeLabel[action.actionType] || action.actionType}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatDate(action.actionDate)}
                          </span>
                          {action.performedBy?.username && (
                            <span className="text-xs text-gray-500">
                              por {action.performedBy.username}
                            </span>
                          )}
                          {action.sede?.name && (
                            <span className="text-xs text-gray-500">Sede: {action.sede.name}</span>
                          )}
                          {action.departamento?.name && (
                            <span className="text-xs text-gray-500">Departamento: {action.departamento.name}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900">{action.description}</p>
                        {action.result && (
                          <p className="mt-1 text-xs text-gray-500">
                            <strong>Resultado:</strong> {action.result}
                          </p>
                        )}
                        {action.nextSteps && (
                          <p className="mt-1 text-xs text-blue-600">
                            <strong>Próximos pasos:</strong> {action.nextSteps}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Edit Modal ───────────────────────────── */}
      <Modal
        isOpen={editOpen} onClose={() => setEditOpen(false)}
        title="Editar registro" size="sm"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleUpdate} isLoading={updateMutation.isPending}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Estado"
            options={statusOptions}
            value={editForm.status}
            onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
          />
          <Input
            label="Próximo seguimiento"
            type="date"
            value={editForm.nextFollowUpDate}
            onChange={(e) => setEditForm((p) => ({ ...p, nextFollowUpDate: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ── Add Action Modal ─────────────────────── */}
      <Modal
        isOpen={actionOpen} onClose={() => setActionOpen(false)}
        title="Registrar acción" size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddAction} isLoading={addAction.isPending}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo de acción"
              options={actionTypeOptions}
              value={actionForm.actionType}
              onChange={(e) => setActionForm((p) => ({ ...p, actionType: e.target.value }))}
            />
            <Input
              label="Fecha"
              type="date"
              value={actionForm.actionDate}
              onChange={(e) => setActionForm((p) => ({ ...p, actionDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              rows={3}
              value={actionForm.description}
              onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe la acción realizada..."
            />
          </div>
          <Input
            label="Resultado"
            placeholder="Resultado de la acción..."
            value={actionForm.result}
            onChange={(e) => setActionForm((p) => ({ ...p, result: e.target.value }))}
          />
          <Input
            label="Próximos pasos"
            placeholder="Siguientes acciones planificadas..."
            value={actionForm.nextSteps}
            onChange={(e) => setActionForm((p) => ({ ...p, nextSteps: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, span2 }: { label: string; value: string | number | null | undefined; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {value !== null && value !== undefined && value !== '' ? value : <span className="text-gray-300">—</span>}
      </dd>
    </div>
  );
}
