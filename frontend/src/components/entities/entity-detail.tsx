'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Building, Briefcase, Mail, Phone, Globe,
  FolderKanban, Link2, Plus, Trash2, CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useEntity, useEntityContacts } from '@/hooks/use-entities';
import { useEntityRelationships } from '@/hooks/use-relationships';
import { useEntityPortfolios } from '@/hooks/use-portfolio';
import { formatDate, formatDateShort, cn } from '@/lib/utils';
import type {
  EntityContact,
  EntityRelationship,
  EntityType,
  RelationshipType,
} from '@/types/entities.types';
import { contactsService } from '@/services/contacts.service';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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
const statusVariant: Record<string, 'success' | 'default' | 'warning' | 'danger'> = {
  ACTIVE: 'success', INACTIVE: 'default', DUPLICATE: 'warning', MERGED: 'danger',
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
  OTHER: 'Otra',
};
const relationshipTypeOptions = [
  { value: 'OWNER', label: relationshipTypeLabel.OWNER },
  { value: 'EMPLOYEE', label: relationshipTypeLabel.EMPLOYEE },
  { value: 'PARTNER', label: relationshipTypeLabel.PARTNER },
  { value: 'BRANCH', label: relationshipTypeLabel.BRANCH },
  { value: 'REPRESENTATIVE', label: relationshipTypeLabel.REPRESENTATIVE },
  { value: 'OTHER', label: relationshipTypeLabel.OTHER },
];
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

  // Data
  const { data: entity, isLoading, error } = useEntity(entityId);
  const contacts = useEntityContacts(entityId);
  const portfolios = useEntityPortfolios(entityId);
  const relationships = useEntityRelationships(entityId, { direction: 'both', isActive: true });

  // State
  const [activeTab, setActiveTab] = useState('info');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ contactType: 'EMAIL', contactValue: '', label: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState<{
    toEntityId: string;
    relationshipType: RelationshipType;
    role: string;
  }>({
    toEntityId: '',
    relationshipType: 'OWNER',
    role: '',
  });
  const [savingRelationship, setSavingRelationship] = useState(false);

  // ── Handlers ─────────────────────────────────
  const handleAddContact = async () => {
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
    if (!relationshipForm.toEntityId.trim()) return;
    setSavingRelationship(true);
    try {
      const { relationshipsService } = await import('@/services/relationships.service');
      await relationshipsService.create(entityId, {
        toEntityId: relationshipForm.toEntityId.trim(),
        relationshipType: relationshipForm.relationshipType,
        role: relationshipForm.role || undefined,
      });
      qc.invalidateQueries({ queryKey: ['relationships', entityId] });
      toast.success('Relación creada');
      setAddRelationshipOpen(false);
      setRelationshipForm({ toEntityId: '', relationshipType: 'OWNER', role: '' });
    } catch {
      toast.error('Error al crear relación');
    } finally {
      setSavingRelationship(false);
    }
  };

  const handleDeleteRelationship = async (rel: EntityRelationship) => {
    if (!window.confirm('¿Eliminar (desactivar) esta relación?')) return;
    try {
      const { relationshipsService } = await import('@/services/relationships.service');
      await relationshipsService.remove(rel.id);
      qc.invalidateQueries({ queryKey: ['relationships', entityId] });
      toast.success('Relación eliminada');
    } catch {
      toast.error('Error al eliminar relación');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
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
  const establishment = (entity as any).establishment;

  const entityIcon = entityType === 'PERSON' ? User : entityType === 'COMPANY' ? Building : Briefcase;
  const EntityIcon = entityIcon;

  // ── Tabs ──────────────────────────────────────
  const tabs = [
    { id: 'info', label: 'Información', icon: <EntityIcon className="h-4 w-4" /> },
    { id: 'contacts', label: 'Contactos', icon: <Mail className="h-4 w-4" />, count: contacts.data?.length },
    {
      id: 'relationships',
      label: 'Relaciones',
      icon: <Link2 className="h-4 w-4" />,
      count: relationships.data?.length,
    },
    {
      id: 'portfolio',
      label: 'Cartera',
      icon: <FolderKanban className="h-4 w-4" />,
      count: portfolios.data?.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-100 p-2.5">
              <EntityIcon className="h-6 w-6 text-primary-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{entity.displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusVariant[entity.status] || 'default'}>
                  {statusLabel[entity.status] || entity.status}
                </Badge>
                <span className="text-xs text-gray-400">
                  Creado {formatDate(entity.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB: INFO ──────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Entity-specific info */}
          <Card title={entityType === 'PERSON' ? 'Datos personales' : entityType === 'COMPANY' ? 'Datos de empresa' : 'Datos del establecimiento'}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {entityType === 'PERSON' && person && (
                <>
                  <InfoRow label="Nombre" value={`${person.firstName} ${person.lastName}${person.secondLastName ? ' ' + person.secondLastName : ''}`} />
                  <InfoRow label="Cédula" value={person.cedula} mono />
                  <InfoRow label="Género" value={person.gender === 'MALE' ? 'Masculino' : person.gender === 'FEMALE' ? 'Femenino' : person.gender} />
                  <InfoRow label="Fecha de nacimiento" value={person.birthDate ? formatDateShort(person.birthDate) : null} />
                  <InfoRow label="Nacionalidad" value={person.nationality} />
                  <InfoRow label="Nivel educativo" value={person.educationLevel} />
                </>
              )}
              {entityType === 'COMPANY' && company && (
                <>
                  <InfoRow label="Nombre legal" value={company.legalName} />
                  <InfoRow label="Nombre comercial" value={company.tradeName} />
                  <InfoRow label="RUC" value={company.ruc} mono />
                  <InfoRow label="DV" value={company.dv} />
                  <InfoRow label="Tipo de empresa" value={company.companyType} />
                  <InfoRow label="Actividad económica" value={company.economicActivity} />
                  <InfoRow label="Fecha de fundación" value={company.foundedDate ? formatDateShort(company.foundedDate) : null} />
                  <InfoRow label="# Empleados" value={company.employeeCount} />
                </>
              )}
              {entityType === 'ESTABLISHMENT' && establishment && (
                <>
                  <InfoRow label="Nombre" value={establishment.establishmentName} />
                  <InfoRow label="Tipo" value={establishment.establishmentType} />
                  <InfoRow label="Actividad económica" value={establishment.economicActivity} />
                  <InfoRow label="Aviso de operación" value={establishment.noticeOfOperation} mono />
                </>
              )}
            </dl>
          </Card>

          {/* Location / General info */}
          <Card title="Ubicación y notas">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Provincia" value={entity.province} />
              <InfoRow label="Distrito" value={entity.district} />
              <InfoRow label="Corregimiento" value={entity.corregimiento} />
              <InfoRow label="Dirección" value={entity.address} span2 />
              <InfoRow label="Origen de datos" value={entity.sourceOrigin} />
              <InfoRow label="Notas" value={entity.notes} span2 />
            </dl>
          </Card>
        </div>
      )}

      {/* ── TAB: CONTACTS ──────────────────────────── */}
      {activeTab === 'contacts' && (
        <Card
          title="Contactos"
          description="Información de contacto de la entidad"
        >
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddContactOpen(true)}>
              Agregar contacto
            </Button>
          </div>

          {contacts.isLoading ? (
            <LoadingSpinner text="Cargando contactos..." />
          ) : !contacts.data || contacts.data.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Sin contactos"
              description="Agrega un contacto para esta entidad."
              action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddContactOpen(true)}>Agregar</Button>}
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
                        <p className="text-sm font-medium text-gray-900">{c.contactValue}</p>
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
                    <Button
                      variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteContact(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
        <Card title="Cartera de Seguimiento" description="Registros de seguimiento asociados a esta entidad">
          {portfolios.isLoading ? (
            <LoadingSpinner text="Cargando cartera..." />
          ) : !portfolios.data || portfolios.data.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="Sin registros en cartera"
              description="No hay registros de seguimiento para esta entidad."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Asunto</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Prioridad</TableHeaderCell>
                  <TableHeaderCell>Próximo seguimiento</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
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
                      <Badge variant={portfolioStatusBadge[rec.status] || 'default'}>
                        {portfolioStatusLabel[rec.status] || rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{rec.priority}</TableCell>
                    <TableCell>
                      {rec.nextFollowUpDate ? formatDateShort(rec.nextFollowUpDate) : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{rec._count?.actions ?? 0}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── TAB: RELATIONSHIPS ─────────────────────── */}
      {activeTab === 'relationships' && (
        <Card
          title="Relaciones"
          description="Vinculaciones de esta entidad con otras (personas, empresas, establecimientos)"
        >
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setAddRelationshipOpen(true)}
            >
              Agregar relación
            </Button>
          </div>

          {relationships.isLoading ? (
            <LoadingSpinner text="Cargando relaciones..." />
          ) : !relationships.data || relationships.data.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Sin relaciones"
              description="No hay relaciones registradas para esta entidad."
            />
          ) : (
            <div className="space-y-2">
              {relationships.data.map((rel) => {
                const isFrom = rel.fromEntityId === entity.id;
                const other = isFrom ? rel.toEntity : rel.fromEntity;
                if (!other) return null;
                const OtherIcon =
                  other.entityType === 'PERSON'
                    ? User
                    : other.entityType === 'COMPANY'
                    ? Building
                    : Briefcase;

                return (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gray-100 p-2">
                        <OtherIcon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {other.displayName}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>
                            {relationshipTypeLabel[rel.relationshipType] ?? rel.relationshipType}
                          </span>
                          {rel.role && <span>· {rel.role}</span>}
                          {rel.startDate && (
                            <span>
                              · Desde {formatDateShort(rel.startDate)}
                            </span>
                          )}
                          {rel.endDate && (
                            <span>
                              · Hasta {formatDateShort(rel.endDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteRelationship(rel)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Relationship Modal */}
          <Modal
            isOpen={addRelationshipOpen}
            onClose={() => setAddRelationshipOpen(false)}
            title="Agregar relación"
            size="sm"
            footer={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAddRelationshipOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddRelationship} isLoading={savingRelationship}>
                  Guardar
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
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
                label="Rol"
                placeholder="Ej: Propietario, Gerente, Representante legal"
                value={relationshipForm.role}
                onChange={(e) =>
                  setRelationshipForm((p) => ({ ...p, role: e.target.value }))
                }
              />
              <Input
                label="ID de entidad destino *"
                placeholder="UUID de la empresa o establecimiento"
                value={relationshipForm.toEntityId}
                onChange={(e) =>
                  setRelationshipForm((p) => ({ ...p, toEntityId: e.target.value }))
                }
              />
              <p className="text-xs text-gray-500">
                Para esta primera versión, debes pegar el ID de la entidad destino
                (lo puedes copiar de la URL de detalle).
              </p>
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
