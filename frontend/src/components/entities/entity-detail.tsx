'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Building, Mail, Phone, Globe,
  FolderKanban, Link2, Plus, Trash2, CheckCircle, ArrowRight, Eye, Sprout,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { nationalityLabel } from '@/lib/nationalities';
import { companyTypeLabel } from '@/lib/company-types';
import { companySizeClassLabel } from '@/lib/company-size-class';
import { EntitySearchSelect, type EntityOption } from '@/components/ui/entity-search-select';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useEntity, useEntityContacts } from '@/hooks/use-entities';
import { useEntityRelationships } from '@/hooks/use-relationships';
import { useCreatePortfolio, useEntityPortfolios } from '@/hooks/use-portfolio';
import { portfolioCategoryOptions } from '@/lib/portfolio.constants';
import { formatDate, formatDateShort, cn } from '@/lib/utils';
import {
  provinciaNombre,
  distritoNombre,
  corregimientoNombre,
} from '@/lib/division-politica';
import {
  relationshipTargetsBySource,
  relationshipTargetPlaceholder,
} from '@/lib/relationship-rules';
import type {
  EntityContact,
  EntityRelationship,
  EntityType,
  RelationshipType,
} from '@/types/entities.types';
import { contactsService } from '@/services/contacts.service';
import { entitiesService } from '@/services/entities.service';
import { EntityHistorialPanel } from '@/components/entities/entity-historial';
import { personsService, type CapitalSemillaRecord } from '@/services/persons.service';
import { isReadOnlyRole } from '@/lib/roles';
import { registroEmpresarialTexto } from '@/lib/registro-empresarial';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/services/api-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { personChangesService } from '@/services/person-changes.service';
import { useDeletePerson } from '@/hooks/use-persons';
import { useDeleteCompany } from '@/hooks/use-companies';

/* ──────────────────────────────────────────────── */
/* Types                                            */
/* ──────────────────────────────────────────────── */
interface EntityDetailProps {
  entityId: string;
  backHref: string;
  entityType: EntityType;
}

/* ──────────────────────────────────────────────── */
/* Helper labels                                    */
/* ──────────────────────────────────────────────── */
const statusLabel: Record<string, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', DUPLICATE: 'Duplicado', MERGED: 'Fusionado',
};
const contactIcons: Record<string, React.ElementType> = {
  EMAIL: Mail, PHONE: Phone, MOBILE: Phone, WHATSAPP: Phone,
  WEBSITE: Globe, SOCIAL_MEDIA: Link2, OTHER: Link2,
};
const portfolioStatusLabel: Record<string, string> = {
  NEW: 'Nuevo', IN_PROGRESS: 'En progreso', WAITING: 'En espera',
  RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
};
const portfolioStatusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'primary', IN_PROGRESS: 'warning', WAITING: 'default',
  RESOLVED: 'success', CLOSED: 'default',
};
const relationshipTypeLabel: Record<RelationshipType, string> = {
  OWNER: 'Dueño(a)',
  EMPLOYEE: 'Empleado(a)',
  PARTNER: 'Socio(a)',
  BRANCH: 'Sucursal',
  REPRESENTATIVE: 'Representante',
  RELATED: 'Relacionado(a)',
  SUBSIDIARY: 'Subsidiaria',
  AFFILIATED: 'Afiliado(a)',
  OTHER: 'Otra',
};
const relationshipTypeOptions = [
  { value: 'OWNER', label: relationshipTypeLabel.OWNER },
  { value: 'EMPLOYEE', label: relationshipTypeLabel.EMPLOYEE },
  { value: 'PARTNER', label: relationshipTypeLabel.PARTNER },
  { value: 'BRANCH', label: relationshipTypeLabel.BRANCH },
  { value: 'REPRESENTATIVE', label: relationshipTypeLabel.REPRESENTATIVE },
  { value: 'RELATED', label: relationshipTypeLabel.RELATED },
  { value: 'SUBSIDIARY', label: relationshipTypeLabel.SUBSIDIARY },
  { value: 'AFFILIATED', label: relationshipTypeLabel.AFFILIATED },
  { value: 'OTHER', label: relationshipTypeLabel.OTHER },
];

/** Mapa de tipo de entidad → segmento de ruta para navegación */
const entityRouteMap: Record<EntityType, string> = {
  PERSON: 'persons',
  COMPANY: 'companies',
};
/** Etiqueta amigable del tipo de entidad */
const entityTypeDisplayLabel: Record<EntityType, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
};
/** Color de badge según tipo de entidad */
const entityTypeBadgeVariant: Record<EntityType, 'primary' | 'success'> = {
  PERSON: 'primary',
  COMPANY: 'success',
};
const contactTypeOptions = [
  { value: 'EMAIL', label: 'Correo electrónico' },
  { value: 'PHONE', label: 'Teléfono' },
  { value: 'MOBILE', label: 'Celular' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WEBSITE', label: 'Sitio web' },
  { value: 'SOCIAL_MEDIA', label: 'Red social' },
  { value: 'OTHER', label: 'Otro' },
];

/* ──────────────────────────────────────────────── */
/* Component                                        */
/* ──────────────────────────────────────────────── */
export function EntityDetail({ entityId, backHref, entityType }: EntityDetailProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const readOnly = isReadOnlyRole(user?.role);

  // Data
  const { data: entity, isLoading, error } = useEntity(entityId);
  const contacts = useEntityContacts(entityId);
  const portfolios = useEntityPortfolios(entityId);
  const relationships = useEntityRelationships(entityId, { direction: 'both', isActive: true });
  const capitalSemilla = useQuery({
    queryKey: ['capital-semilla', entityId],
    queryFn: () => personsService.listCapitalSemilla(entityId),
    enabled: entityType === 'PERSON',
  });
  const pendingQuery = useQuery({
    queryKey: ['person-change-pending', entityId],
    queryFn: () => personChangesService.hasPending(entityId),
    enabled: !!entityId,
  });
  const hasPending = Boolean(pendingQuery.data);
  const deletePersonMutation = useDeletePerson();
  const deleteCompanyMutation = useDeleteCompany();
  const editBlocked = readOnly || hasPending;

  // State
  const [activeTab, setActiveTab] = useState('info');
  const [historialPage, setHistorialPage] = useState(1);
  const historial = useQuery({
    queryKey: ['entity-historial', entityId, historialPage],
    queryFn: () => entitiesService.historial(entityId, historialPage),
    enabled: activeTab === 'historial' && !!entityId,
  });
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ contactType: 'EMAIL', contactValue: '', label: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [relationshipForm, setRelationshipForm] = useState<{
    relationshipType: RelationshipType;
    role: string;
  }>({
    relationshipType: 'OWNER',
    role: '',
  });
  const [savingRelationship, setSavingRelationship] = useState(false);
  const [seedEditor, setSeedEditor] = useState<{
    recordId?: string;
    province: string;
    businessName: string;
    actaNumber: string;
    amount: string;
  } | null>(null);
  const [savingSeed, setSavingSeed] = useState(false);
  const createPortfolio = useCreatePortfolio();
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({
    subject: '',
    category: '',
    description: '',
    nextFollowUpDate: '',
  });

  const openPortfolioModal = () => {
    setPortfolioForm({
      subject: '',
      category: '',
      description: '',
      nextFollowUpDate: '',
    });
    setPortfolioOpen(true);
  };

  const submitPortfolio = async () => {
    if (!portfolioForm.subject.trim()) {
      toast.error('El asunto es obligatorio');
      return;
    }
    try {
      const record = await createPortfolio.mutateAsync({
        entityId,
        subject: portfolioForm.subject.trim(),
        category: portfolioForm.category || undefined,
        description: portfolioForm.description.trim() || undefined,
        nextFollowUpDate: portfolioForm.nextFollowUpDate || undefined,
      });
      setPortfolioOpen(false);
      router.push(`/dashboard/portfolio/${record.id}`);
    } catch {
      /* el hook ya muestra el error */
    }
  };

  const portfolioCreateButton = !readOnly ? (
    <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openPortfolioModal}>
      Nuevo registro
    </Button>
  ) : null;

  const openSeedEditor = (row?: CapitalSemillaRecord) => {
    setSeedEditor({
      recordId: row?.id,
      province: row?.province ?? '',
      businessName: row?.businessName ?? '',
      actaNumber: row?.actaNumber ?? '',
      amount: row?.amount ?? '',
    });
  };

  const saveSeed = async () => {
    if (!seedEditor) return;
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de editar.');
      return;
    }
    setSavingSeed(true);
    try {
      await personsService.saveCapitalSemilla(entityId, seedEditor);
      toast.success(seedEditor.recordId ? 'Capital semilla actualizado' : 'Capital semilla registrado');
      setSeedEditor(null);
      await qc.invalidateQueries({ queryKey: ['capital-semilla', entityId] });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSavingSeed(false);
    }
  };

  // ── Handlers ─────────────────────────────────
  const handleAddContact = async () => {
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de editar.');
      return;
    }
    if (!contactForm.contactValue.trim()) return;
    setSavingContact(true);
    try {
      await contactsService.create(entityId, {
        contactType: contactForm.contactType,
        contactValue: contactForm.contactValue,
        label: contactForm.label || undefined,
      });
      qc.invalidateQueries({ queryKey: ['contacts', entityId] });
      toast.success('Contacto agregado');
      setAddContactOpen(false);
      setContactForm({ contactType: 'EMAIL', contactValue: '', label: '' });
    } catch {
      toast.error('Error al agregar contacto');
    } finally {
      setSavingContact(false);
    }
  };

  const handleAddRelationship = async () => {
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de editar.');
      return;
    }
    if (!selectedEntity) return;
    setSavingRelationship(true);
    try {
      const { relationshipsService } = await import('@/services/relationships.service');
      await relationshipsService.create(entityId, {
        toEntityId: selectedEntity.id,
        relationshipType: relationshipForm.relationshipType,
        role: relationshipForm.role || undefined,
      });
      qc.invalidateQueries({ queryKey: ['relationships', entityId] });
      if (selectedEntity?.id) {
        qc.invalidateQueries({ queryKey: ['relationships', selectedEntity.id] });
      }
      toast.success('Relación creada');
      setAddRelationshipOpen(false);
      setSelectedEntity(null);
      setRelationshipForm({ relationshipType: 'OWNER', role: '' });
    } catch (err) {
      const { getApiErrorMessage } = await import('@/services/api-client');
      toast.error(getApiErrorMessage(err) || 'Error al crear relación');
    } finally {
      setSavingRelationship(false);
    }
  };

  const handleDeleteRelationship = async (rel: EntityRelationship) => {
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de editar.');
      return;
    }
    if (!window.confirm('¿Eliminar (desactivar) esta relación?')) return;
    try {
      const { relationshipsService } = await import('@/services/relationships.service');
      await relationshipsService.remove(rel.id);
      qc.invalidateQueries({ queryKey: ['relationships', entityId] });
      const otherId = rel.fromEntityId === entityId ? rel.toEntityId : rel.fromEntityId;
      if (otherId) {
        qc.invalidateQueries({ queryKey: ['relationships', otherId] });
      }
      toast.success('Relación eliminada');
    } catch {
      toast.error('Error al eliminar relación');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de editar.');
      return;
    }
    if (!window.confirm('¿Eliminar este contacto?')) return;
    try {
      await contactsService.remove(contactId);
      qc.invalidateQueries({ queryKey: ['contacts', entityId] });
      toast.success('Contacto eliminado');
    } catch {
      toast.error('Error al eliminar contacto');
    }
  };

  // ── Loading / Error ──────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" text="Cargando entidad..." />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-red-500">No se pudo cargar la entidad.</p>
        <Button variant="outline" onClick={() => router.push(backHref)}>Volver</Button>
      </div>
    );
  }

  // ── Entity meta ──────────────────────────────
  const person = (entity as any).person;
  const company = (entity as any).company;

  const handleDeleteEntity = () => {
    if (hasPending) {
      toast.error('Hay cambios pendientes de confirmación. Confírmelos o cancele antes de eliminar.');
      return;
    }
    if (entityType === 'PERSON') {
      if (
        !window.confirm(
          `¿Encolar eliminación de "${entity.displayName}"? Deberá confirmarla en Confirmación antes de aplicarse.`
        )
      ) {
        return;
      }
      deletePersonMutation.mutate(entityId, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['person-change-pending', entityId] });
          router.push(backHref);
        },
      });
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar "${entity.displayName}"?`)) return;
    deleteCompanyMutation.mutate(entityId, {
      onSuccess: () => {
        router.push(backHref);
      },
    });
  };

  // ── Tabs ──────────────────────────────────────
  const tabs = [
    { id: 'info', label: 'Información' },
    { id: 'historial', label: 'Historial' },
    { id: 'contacts', label: 'Contactos', count: contacts.data?.length },
    { id: 'relationships', label: 'Relaciones', count: relationships.data?.length },
    { id: 'portfolio', label: 'Seguimiento', count: portfolios.data?.length },
    ...(entityType === 'PERSON'
      ? [{
          id: 'capital-semilla',
          label: 'Capital Semilla',
          count: capitalSemilla.data?.records.length,
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-[#0F172A]">{entity.displayName}</h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Estado: {statusLabel[entity.status] || entity.status}
              </p>
              <p className="text-sm text-[#64748B]">
                Creado el {formatDate(entity.createdAt)}
              </p>
              {hasPending && (
                <p className="mt-2 text-sm font-medium text-amber-700">
                  Hay cambios pendientes de confirmación. No se puede editar hasta confirmar o cancelar.
                </p>
              )}
            </div>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={hasPending || deletePersonMutation.isPending || deleteCompanyMutation.isPending}
                onClick={handleDeleteEntity}
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB: INFO ──────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Entity-specific info */}
          <Card title={entityType === 'PERSON' ? 'Datos personales' : 'Datos de empresa'}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {entityType === 'PERSON' && person && (
                <>
                  <InfoRow label="Nombre" value={`${person.firstName} ${person.lastName}${person.secondLastName ? ' ' + person.secondLastName : ''}`} />
                  <InfoRow
                    label="Tipo de documento"
                    value={
                      person.documentType === 'CEDULA_NUMERO'
                        ? 'Cédula Número'
                        : person.documentType === 'CEDULA_LETRA'
                          ? 'Cédula Letra'
                          : person.documentType === 'PASAPORTE'
                            ? 'Pasaporte'
                            : null
                    }
                  />
                  <InfoRow
                    label="Número de documento"
                    value={person.documentNumber || person.cedula}
                    mono
                  />
                  <InfoRow
                    label="Género"
                    value={
                      person.gender === 'MALE'
                        ? 'Masculino'
                        : person.gender === 'FEMALE'
                          ? 'Femenino'
                          : person.gender === 'OTHER'
                            ? 'Otro'
                            : null
                    }
                  />
                  <InfoRow label="Fecha de nacimiento" value={person.birthDate ? formatDateShort(person.birthDate) : null} />
                  <InfoRow label="Nacionalidad" value={nationalityLabel(person.nationalityCode)} />
                  <InfoRow label="Nivel educativo" value={person.educationLevel} />
                  <InfoRow
                    label="Carnet de artesano"
                    value={person.hasArtisanCard === true ? 'Sí' : person.hasArtisanCard === false ? 'No' : null}
                  />
                  <InfoRow label="Registro empresarial" value={registroEmpresarialTexto(entity.registroEmpresarialFecha)} span2 />
                  <InfoRow
                    label="Actividad económica"
                    value={entity.actEc || person?.economicActivity}
                    span2
                  />
                </>
              )}
              {entityType === 'COMPANY' && company && (
                <>
                  <InfoRow label="Razón Social" value={company.legalName} />
                  <InfoRow label="Nombre comercial" value={company.tradeName} />
                  <InfoRow label="RUC" value={company.ruc} mono />
                  <InfoRow label="DV" value={company.dv} />
                  <InfoRow label="Tipo de Sociedad" value={companyTypeLabel(company.companyType) || company.companyType} />
                  <InfoRow label="Clasificación por tamaño" value={companySizeClassLabel(company.companySizeClass)} />
                  <InfoRow label="Fecha de Inscripción" value={company.foundedDate ? formatDateShort(company.foundedDate) : null} />
                  <InfoRow label="Registro empresarial" value={registroEmpresarialTexto(entity.registroEmpresarialFecha)} span2 />
                  <InfoRow
                    label="Actividad económica"
                    value={entity.actEc || company?.economicActivity}
                    span2
                  />
                </>
              )}
            </dl>
          </Card>

          {/* Location / General info */}
          <Card title="Ubicación y notas">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Provincia" value={provinciaNombre(entity.province)} />
              <InfoRow label="Distrito" value={distritoNombre(entity.province, entity.district)} />
              <InfoRow
                label="Corregimiento"
                value={corregimientoNombre(entity.province, entity.district, entity.corregimiento)}
              />
              <InfoRow label="Dirección" value={entity.address} span2 />
              <InfoRow label="Origen de datos" value={entity.sourceOrigin} />
              <InfoRow label="Notas" value={entity.notes} span2 />
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'historial' && (
        historial.isLoading ? (
          <p className="py-10 text-sm text-[#64748B]">Cargando historial...</p>
        ) : historial.isError || !historial.data ? (
          <p className="py-10 text-sm text-[#DC2626]">No se pudo cargar el historial.</p>
        ) : (
          <EntityHistorialPanel
            historial={historial.data}
            page={historialPage}
            onPageChange={setHistorialPage}
          />
        )
      )}

      {activeTab === 'capital-semilla' && entityType === 'PERSON' && (
        <Card
          title="Capital Semilla"
          description="Registros vinculados por la cédula de la persona"
        >
          {capitalSemilla.isLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner text="Buscando capital semilla..." /></div>
          ) : capitalSemilla.isError ? (
            <p className="py-12 text-center text-sm text-red-500">No se pudo consultar el capital semilla.</p>
          ) : !capitalSemilla.data?.cedula ? (
            <EmptyState
              icon={Sprout}
              title="Sin cédula"
              description="Esta persona no tiene cédula, así que no se puede vincular su capital semilla."
            />
          ) : (capitalSemilla.data.records.length === 0) ? (
            <div className="space-y-4">
              <EmptyState
                icon={Sprout}
                title="Sin registros"
                description={`No hay capital semilla vinculado a la cédula ${capitalSemilla.data.cedula}.`}
              />
              {!editBlocked && !seedEditor && (
                <div className="flex justify-center">
                  <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => openSeedEditor()}>
                    Agregar capital semilla
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Cédula</TableHeaderCell>
                  <TableHeaderCell>Provincia</TableHeaderCell>
                  <TableHeaderCell>Nombre del negocio</TableHeaderCell>
                  <TableHeaderCell>No. de acta</TableHeaderCell>
                  <TableHeaderCell>Monto</TableHeaderCell>
                  {!editBlocked && <TableHeaderCell align="right">Acciones</TableHeaderCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {capitalSemilla.data.records.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.externalId ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{row.cedula}</TableCell>
                    <TableCell>{row.province || '—'}</TableCell>
                    <TableCell>{row.businessName || '—'}</TableCell>
                    <TableCell>{row.actaNumber || '—'}</TableCell>
                    <TableCell>
                      {row.amount != null
                        ? `B/. ${Number(row.amount).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </TableCell>
                    {!editBlocked && (
                      <TableCell align="right">
                        <Button variant="ghost" size="sm" onClick={() => openSeedEditor(row)}>
                          Editar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {seedEditor && !editBlocked && (
            <div className="mt-6 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <Input
                label="Provincia"
                value={seedEditor.province}
                onChange={(e) => setSeedEditor({ ...seedEditor, province: e.target.value })}
              />
              <Input
                label="Nombre del negocio"
                value={seedEditor.businessName}
                onChange={(e) => setSeedEditor({ ...seedEditor, businessName: e.target.value })}
              />
              <Input
                label="No. de acta"
                value={seedEditor.actaNumber}
                onChange={(e) => setSeedEditor({ ...seedEditor, actaNumber: e.target.value })}
              />
              <Input
                label="Monto"
                value={seedEditor.amount}
                onChange={(e) => setSeedEditor({ ...seedEditor, amount: e.target.value })}
              />
              <div className="flex gap-2 sm:col-span-2">
                <Button size="sm" onClick={saveSeed} disabled={savingSeed}>
                  {savingSeed ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSeedEditor(null)} disabled={savingSeed}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: CONTACTS ──────────────────────────── */}
      {activeTab === 'contacts' && (
        <Card
          title="Contactos"
          description="Información de contacto de la entidad"
        >
          {!editBlocked && (
            <div className="mb-4 flex justify-end">
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddContactOpen(true)}>
                Agregar contacto
              </Button>
            </div>
          )}

          {contacts.isLoading ? (
            <LoadingSpinner text="Cargando contactos..." />
          ) : !contacts.data || contacts.data.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Sin contactos"
              description="Agrega un contacto para esta entidad."
              action={
                !editBlocked ? (
                  <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddContactOpen(true)}>Agregar</Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {contacts.data.map((c: EntityContact) => {
                const Icon = contactIcons[c.contactType] || Link2;
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gray-100 p-2">
                        <Icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.contactType === 'EMAIL' ? 'Correo registrado' : c.contactValue}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{c.contactType}</span>
                          {c.label && <span className="text-xs text-gray-400">· {c.label}</span>}
                          {c.isPrimary && (
                            <Badge variant="primary" className="text-[10px] px-1.5 py-0">Principal</Badge>
                          )}
                          {c.isVerified && <CheckCircle className="h-3 w-3 text-green-500" />}
                        </div>
                      </div>
                    </div>
                    {!editBlocked && (
                      <Button
                        variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteContact(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Contact Modal */}
          <Modal
            isOpen={addContactOpen} onClose={() => setAddContactOpen(false)}
            title="Agregar contacto" size="sm"
            footer={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAddContactOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddContact} isLoading={savingContact}>Guardar</Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Select
                label="Tipo"
                options={contactTypeOptions}
                value={contactForm.contactType}
                onChange={(e) => setContactForm((p) => ({ ...p, contactType: e.target.value }))}
              />
              <Input
                label="Valor *"
                placeholder="correo@ejemplo.com / +507 6..."
                value={contactForm.contactValue}
                onChange={(e) => setContactForm((p) => ({ ...p, contactValue: e.target.value }))}
              />
              <Input
                label="Etiqueta"
                placeholder="Personal, Trabajo, etc."
                value={contactForm.label}
                onChange={(e) => setContactForm((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
          </Modal>
        </Card>
      )}

      {/* ── TAB: PORTFOLIO ─────────────────────────── */}
      {activeTab === 'portfolio' && (
        <Card title="Seguimiento" description="Registros de seguimiento asociados a esta entidad">
          {portfolios.isLoading ? (
            <LoadingSpinner text="Cargando seguimiento..." />
          ) : !portfolios.data || portfolios.data.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="Sin registros de seguimiento"
              description="No hay registros de seguimiento para esta entidad."
              action={portfolioCreateButton}
            />
          ) : (
            <>
            {portfolioCreateButton && (
              <div className="mb-4 flex justify-end">{portfolioCreateButton}</div>
            )}
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Asunto</TableHeaderCell>
                  <TableHeaderCell>Fecha de creación</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Próximo seguimiento</TableHeaderCell>
                  <TableHeaderCell align="right">Ver</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolios.data.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{rec.subject}</p>
                      {rec.category && <p className="text-xs text-gray-400">{rec.category}</p>}
                    </TableCell>
                    <TableCell>
                      {rec.createdAt ? formatDateShort(rec.createdAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={portfolioStatusBadge[rec.status] || 'default'}>
                        {portfolioStatusLabel[rec.status] || rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rec.nextFollowUpDate ? formatDateShort(rec.nextFollowUpDate) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/portfolio/${rec.id}`)}
                        aria-label="Ver seguimiento"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
          <Modal
            isOpen={portfolioOpen}
            onClose={() => setPortfolioOpen(false)}
            title="Nuevo seguimiento"
            description={`Caso de seguimiento para ${entity?.displayName || 'esta entidad'}`}
            size="lg"
            footer={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPortfolioOpen(false)}>Cancelar</Button>
                <Button onClick={submitPortfolio} isLoading={createPortfolio.isPending}>
                  Crear registro
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Input
                label="Asunto *"
                placeholder="Motivo del seguimiento..."
                value={portfolioForm.subject}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, subject: event.target.value }))}
              />
              <Select
                label="Categoría"
                options={portfolioCategoryOptions}
                value={portfolioForm.category}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, category: event.target.value }))}
              />
              <Input
                label="Próximo seguimiento"
                type="date"
                value={portfolioForm.nextFollowUpDate}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, nextFollowUpDate: event.target.value }))}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  rows={3}
                  placeholder="Detalles del caso..."
                  value={portfolioForm.description}
                  onChange={(event) => setPortfolioForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>
          </Modal>
        </Card>
      )}

      {/* ── TAB: RELATIONSHIPS ─────────────────────── */}
      {activeTab === 'relationships' && (
        <Card
          title="Relaciones"
          description="Vinculaciones de esta entidad con otras (personas, empresas)"
        >
          {!editBlocked && (
            <div className="mb-4 flex justify-end">
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setAddRelationshipOpen(true)}
              >
                Agregar relación
              </Button>
            </div>
          )}

          {relationships.isLoading ? (
            <LoadingSpinner text="Cargando relaciones..." />
          ) : !relationships.data || relationships.data.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Sin relaciones"
              description="No hay relaciones registradas para esta entidad."
              action={
                !editBlocked ? (
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setAddRelationshipOpen(true)}
                  >
                    Agregar relación
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {relationships.data.map((rel) => {
                const isFrom = rel.fromEntityId === entity.id;
                const other = isFrom ? rel.toEntity : rel.fromEntity;
                if (!other) return null;
                const OtherIcon = other.entityType === 'PERSON' ? User : Building;

                const otherHref = `/dashboard/${entityRouteMap[other.entityType as EntityType]}/${other.id}`;
                const directionLabel = isFrom ? 'Es' : 'Tiene como';

                return (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'rounded-lg p-2 shrink-0',
                        other.entityType === 'PERSON' ? 'bg-blue-50' : 'bg-emerald-50'
                      )}>
                        <OtherIcon className={cn(
                          'h-4 w-4',
                          other.entityType === 'PERSON' ? 'text-blue-600' : 'text-emerald-600'
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={otherHref}
                            className="text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline truncate"
                          >
                          {other.displayName}
                          </Link>
                          <Badge variant={entityTypeBadgeVariant[other.entityType as EntityType] ?? 'default'} className="text-[10px] px-1.5 py-0 shrink-0">
                            {entityTypeDisplayLabel[other.entityType as EntityType]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {directionLabel}{' '}
                            <span className="font-medium text-gray-700">
                            {relationshipTypeLabel[rel.relationshipType] ?? rel.relationshipType}
                            </span>
                            {isFrom ? ` de ${other.displayName}` : ''}
                          </span>
                          {rel.role && (
                            <span className="text-gray-400">· Rol: {rel.role}</span>
                          )}
                          {rel.startDate && (
                            <span className="text-gray-400">
                              · Desde {formatDateShort(rel.startDate)}
                            </span>
                          )}
                          {rel.endDate && (
                            <span className="text-gray-400">
                              · Hasta {formatDateShort(rel.endDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!editBlocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 shrink-0 ml-2"
                        onClick={() => handleDeleteRelationship(rel)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Relationship Modal */}
          <Modal
            isOpen={addRelationshipOpen}
            onClose={() => {
              setAddRelationshipOpen(false);
              setSelectedEntity(null);
              setRelationshipForm({ relationshipType: 'OWNER', role: '' });
            }}
            title="Agregar relación"
            description="Vincula esta ficha con otra entidad ya creada en el CRM."
            size="md"
            footer={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddRelationshipOpen(false);
                    setSelectedEntity(null);
                    setRelationshipForm({ relationshipType: 'OWNER', role: '' });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddRelationship}
                  isLoading={savingRelationship}
                  disabled={!selectedEntity}
                >
                  Guardar
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <EntitySearchSelect
                label="Entidad destino *"
                placeholder={relationshipTargetPlaceholder[entityType]}
                value={selectedEntity}
                onSelect={setSelectedEntity}
                allowedEntityTypes={relationshipTargetsBySource[entityType]}
                excludeEntityId={entityId}
                excludeEntityIds={(relationships.data ?? []).flatMap((rel) =>
                  [rel.fromEntityId, rel.toEntityId].filter((id) => id !== entityId)
                )}
                error={!selectedEntity && savingRelationship ? 'Selecciona una entidad' : undefined}
              />
              <Select
                label="Tipo de relación"
                options={relationshipTypeOptions}
                value={relationshipForm.relationshipType}
                onChange={(e) =>
                  setRelationshipForm((p) => ({
                    ...p,
                    relationshipType: e.target.value as RelationshipType,
                  }))
                }
              />
              <Input
                label="Rol (opcional)"
                placeholder="Ej: Propietario, Gerente, Representante legal"
                value={relationshipForm.role}
                onChange={(e) =>
                  setRelationshipForm((p) => ({ ...p, role: e.target.value }))
                }
              />
            </div>
          </Modal>
        </Card>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────── */
/* Info Row helper                                  */
/* ──────────────────────────────────────────────── */
function InfoRow({ label, value, mono, span2 }: { label: string; value: string | number | null | undefined; mono?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className={cn('mt-0.5 text-gray-900', mono && 'font-mono text-sm')}>
        {value !== null && value !== undefined && value !== '' ? value : <span className="text-gray-300">—</span>}
      </dd>
    </div>
  );
}
