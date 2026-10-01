'use client';

import type { EntityHistorial, EntityHistorialEvento } from '@/services/entities.service';
import { companySizeClassLabel } from '@/lib/company-size-class';
import { companyTypeLabel } from '@/lib/company-types';
import { nationalityLabel } from '@/lib/nationalities';
import { corregimientoNombre, distritoNombre, provinciaNombre } from '@/lib/division-politica';

const campoLabel: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  secondLastName: 'Segundo apellido',
  cedula: 'Cédula',
  gender: 'Género',
  birthDate: 'Fecha de nacimiento',
  nationalityCode: 'Nacionalidad',
  educationLevel: 'Escolaridad',
  occupation: 'Ocupación',
  businessName: 'Nombre del negocio',
  economicActivity: 'Actividad económica',
  hasArtisanCard: 'Carnet de artesano',
  seedCapital: 'Capital semilla',
  seedCapitalDate: 'Fecha de capital semilla',
  legalName: 'Razón social',
  tradeName: 'Nombre comercial',
  ruc: 'RUC',
  dv: 'Dígito verificador',
  companyType: 'Tipo de empresa',
  companySizeClass: 'Tamaño',
  foundedDate: 'Fecha de fundación',
  province: 'Provincia',
  district: 'Distrito',
  corregimiento: 'Corregimiento',
  address: 'Dirección',
  notes: 'Notas',
  status: 'Estado',
  origen: 'Origen',
  registroEmpresarialFecha: 'Fecha de registro empresarial',
  contactType: 'Tipo de contacto',
  contactValue: 'Contacto',
  label: 'Etiqueta',
  isPrimary: 'Contacto principal',
  contraparte: 'Entidad vinculada',
  relationshipType: 'Tipo de relación',
  role: 'Rol',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',
  isActive: 'Relación activa',
  subject: 'Asunto',
  priority: 'Prioridad',
  category: 'Categoría',
  description: 'Descripción',
  nextFollowUpDate: 'Próximo seguimiento',
  closedReason: 'Motivo de cierre',
  actionType: 'Tipo de acción',
  result: 'Resultado',
  nextSteps: 'Próximos pasos',
  actaNumber: 'Número de acta',
  amount: 'Monto',
};

interface Presentacion {
  tipo: string;
  tono: 'alta' | 'modificacion' | 'creacion';
  titulo: string;
  descripcion: string;
  modo: 'registro' | 'cambios';
}

function presentar(evento: EntityHistorialEvento): Presentacion {
  if (evento.confirmacion === 'CONFIRMED') {
    return {
      tipo: 'Confirmación',
      tono: 'creacion',
      titulo: evento.summary || 'Cambio confirmado',
      descripcion: 'El cambio pendiente fue confirmado y aplicado.',
      modo: 'cambios',
    };
  }
  if (evento.confirmacion === 'CANCELLED') {
    return {
      tipo: 'Cancelación',
      tono: 'alta',
      titulo: evento.summary || 'Cambio cancelado',
      descripcion: 'El cambio pendiente fue cancelado y no se aplicó.',
      modo: 'cambios',
    };
  }

  const contacto = evento.entityType === 'CONTACT';
  const relacion = evento.entityType === 'RELATIONSHIP';
  const seguimiento = evento.entityType === 'PORTFOLIO' || evento.entityType === 'PORTFOLIO_ACTION';
  const capital = evento.entityType === 'CAPITAL_SEMILLA';
  const altaSistema = evento.action === 'CREATE' && (evento.entityType === 'PERSON' || evento.entityType === 'COMPANY' || evento.entityType == null);

  if (relacion) {
    if (evento.action === 'DELETE') {
      return {
        tipo: 'Baja',
        tono: 'alta',
        titulo: 'Relación',
        descripcion: 'Se quitó la relación con otra entidad.',
        modo: 'cambios',
      };
    }
    if (evento.action === 'CREATE') {
      return {
        tipo: 'Creación',
        tono: 'creacion',
        titulo: 'Relación',
        descripcion: 'Se vinculó al emprendedor con otra entidad.',
        modo: 'cambios',
      };
    }
    return {
      tipo: 'Modificación',
      tono: 'modificacion',
      titulo: 'Relación',
      descripcion: 'Se actualizó una relación.',
      modo: 'cambios',
    };
  }

  if (seguimiento) {
    if (evento.entityType === 'PORTFOLIO_ACTION') {
      return {
        tipo: 'Creación',
        tono: 'creacion',
        titulo: 'Seguimiento',
        descripcion: 'Se registró una acción de seguimiento.',
        modo: 'cambios',
      };
    }
    if (evento.action === 'CREATE') {
      return {
        tipo: 'Creación',
        tono: 'creacion',
        titulo: 'Seguimiento',
        descripcion: 'Se abrió un seguimiento.',
        modo: 'cambios',
      };
    }
    return {
      tipo: 'Modificación',
      tono: 'modificacion',
      titulo: 'Seguimiento',
      descripcion: 'Se actualizó el seguimiento.',
      modo: 'cambios',
    };
  }

  if (capital) {
    if (evento.action === 'CREATE') {
      return {
        tipo: 'Creación',
        tono: 'creacion',
        titulo: 'Capital semilla',
        descripcion: 'Se registró el capital semilla.',
        modo: 'cambios',
      };
    }
    return {
      tipo: 'Modificación',
      tono: 'modificacion',
      titulo: 'Capital semilla',
      descripcion: 'Se actualizó el capital semilla.',
      modo: 'cambios',
    };
  }

  const registro = evento.nuevo && typeof evento.nuevo === 'object' && 'registroEmpresarialFecha' in evento.nuevo
    && Object.keys(evento.nuevo).length === 1;

  if (altaSistema) {
    return {
      tipo: 'Alta',
      tono: 'alta',
      titulo: 'Alta en el sistema',
      descripcion: 'Se registró al emprendedor en el sistema.',
      modo: 'registro',
    };
  }
  if (evento.action === 'DELETE') {
    return {
      tipo: 'Baja',
      tono: 'alta',
      titulo: contacto ? 'Información de contacto' : 'Baja del registro',
      descripcion: contacto ? 'Se eliminó un contacto.' : 'Se desactivó el registro del emprendedor.',
      modo: 'cambios',
    };
  }
  if (evento.action === 'CREATE') {
    return {
      tipo: 'Creación',
      tono: 'creacion',
      titulo: contacto ? 'Información de contacto' : 'Nuevo dato',
      descripcion: contacto ? 'Se incorporó un contacto.' : 'Se incorporó información al registro.',
      modo: 'cambios',
    };
  }
  if (registro) {
    return {
      tipo: 'Modificación',
      tono: 'modificacion',
      titulo: 'Registro empresarial',
      descripcion: 'Se actualizó la fecha del registro empresarial.',
      modo: 'cambios',
    };
  }
  return {
    tipo: 'Modificación',
    tono: 'modificacion',
    titulo: contacto ? 'Información de contacto' : 'Datos del emprendedor',
    descripcion: contacto
      ? 'Se actualizó la información de contacto.'
      : 'Se actualizó la información del emprendedor.',
    modo: 'cambios',
  };
}

const tonoClase: Record<Presentacion['tono'], string> = {
  alta: 'bg-[#FEF2F2] text-[#DC2626]',
  modificacion: 'bg-[#EFF6FF] text-[#2563EB]',
  creacion: 'bg-[#ECFDF5] text-[#047857]',
};

const puntoClase: Record<Presentacion['tono'], string> = {
  alta: 'bg-[#DC2626]',
  modificacion: 'bg-[#2563EB]',
  creacion: 'bg-[#047857]',
};

function textoPlano(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value === 'MALE') return 'Masculino';
  if (value === 'FEMALE') return 'Femenino';
  if (value === 'OTHER') return 'Otro';
  if (value === 'ACTIVE') return 'Activo';
  if (value === 'INACTIVE') return 'Inactivo';
  if (value === 1 || value === '1') return 'Sí';
  if (value === 0 || value === '0') return 'No';
  const estados: Record<string, string> = {
    NEW: 'Nuevo',
    IN_PROGRESS: 'En progreso',
    WAITING: 'En espera',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
    OWNER: 'Dueño(a)',
    EMPLOYEE: 'Empleado(a)',
    PARTNER: 'Socio(a)',
    BRANCH: 'Sucursal',
    REPRESENTATIVE: 'Representante',
    RELATED: 'Relacionado(a)',
    SUBSIDIARY: 'Subsidiaria',
    AFFILIATED: 'Afiliado(a)',
    CALL: 'Llamada',
    EMAIL_ACTION: 'Correo electrónico',
    WHATSAPP: 'WhatsApp',
    VISIT: 'Visita',
    MEETING: 'Reunión',
    NOTE: 'Nota',
    DOCUMENT: 'Documento',
    STATUS_CHANGE: 'Cambio de estado',
  };
  if (typeof value === 'string' && estados[value]) return estados[value];
  return String(value);
}

function textoCampo(clave: string, value: unknown, contexto?: Record<string, unknown> | null): string {
  if (value == null || value === '') return '—';
  if (clave === 'province') return provinciaNombre(String(value)) || textoPlano(value);
  if (clave === 'district') {
    const provincia = contexto?.province ? String(contexto.province) : null;
    return distritoNombre(provincia, String(value)) || textoPlano(value);
  }
  if (clave === 'corregimiento') {
    const provincia = contexto?.province ? String(contexto.province) : null;
    const distrito = contexto?.district ? String(contexto.district) : null;
    return corregimientoNombre(provincia, distrito, String(value)) || textoPlano(value);
  }
  if (clave === 'nationalityCode') return nationalityLabel(String(value));
  if (clave === 'companyType') return companyTypeLabel(String(value));
  if (clave === 'companySizeClass') return companySizeClassLabel(String(value));
  if (clave === 'relationshipType') {
    const tipos: Record<string, string> = {
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
    return tipos[String(value)] || textoPlano(value);
  }
  if (clave === 'contactType') {
    const tipos: Record<string, string> = {
      EMAIL: 'Correo electrónico',
      PHONE: 'Teléfono',
      MOBILE: 'Celular',
      WHATSAPP: 'WhatsApp',
      WEBSITE: 'Sitio web',
      SOCIAL_MEDIA: 'Red social',
      OTHER: 'Otro',
    };
    return tipos[String(value)] || textoPlano(value);
  }
  return textoPlano(value);
}

function comoRegistro(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fechaLarga(value: string): string {
  return new Intl.DateTimeFormat('es-PA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function fechaHora(value: string): string {
  const fecha = new Date(value);
  const dia = new Intl.DateTimeFormat('es-PA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
  const hora = new Intl.DateTimeFormat('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  return `${dia} · ${hora}`;
}

function RealizadoPor({
  usuario,
  sede,
  departamento,
  confirmacion,
}: {
  usuario: string | null;
  sede: string | null;
  departamento: string | null;
  confirmacion?: 'CONFIRMED' | 'CANCELLED' | null;
}) {
  const etiquetaUsuario =
    confirmacion === 'CONFIRMED'
      ? 'Confirmado por'
      : confirmacion === 'CANCELLED'
        ? 'Cancelado por'
        : 'Usuario';
  const datos = [
    { etiqueta: etiquetaUsuario, valor: usuario },
    { etiqueta: 'Sede', valor: sede },
    { etiqueta: 'Departamento', valor: departamento },
  ];

  return (
    <div className="mt-6 border-t border-[#E2E8F0] pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Realizado por</p>
      <dl className="mt-3 grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 min-[1201px]:grid-cols-3">
        {datos.map((dato) => (
          <div key={dato.etiqueta}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{dato.etiqueta}</dt>
            <dd className="mt-1 text-sm text-[#0F172A]">{dato.valor || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TablaCambios({
  anterior,
  nuevo,
}: {
  anterior: Record<string, unknown> | null;
  nuevo: Record<string, unknown> | null;
}) {
  const claves = Array.from(new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo ?? {})]));
  if (claves.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Datos modificados</p>
      <div className="mt-3 hidden min-[769px]:grid min-[769px]:grid-cols-[minmax(8rem,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] min-[769px]:gap-3 border-b border-[#E2E8F0] pb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        <span>Campo</span>
        <span>Anterior</span>
        <span>Nuevo</span>
      </div>
      <div className="divide-y divide-[#E2E8F0]">
        {claves.map((clave) => (
          <div
            key={clave}
            className="grid grid-cols-1 gap-2 py-3 min-[769px]:grid-cols-[minmax(8rem,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] min-[769px]:items-start min-[769px]:gap-3"
          >
            <p className="text-sm font-medium text-[#0F172A]">{campoLabel[clave] || clave}</p>
            <p className="text-sm text-[#64748B]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide min-[769px]:hidden">Anterior</span>
              {textoCampo(clave, anterior?.[clave], anterior)}
            </p>
            <p className="rounded-md bg-[#ECFDF5] px-2 py-1 text-sm text-[#047857]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B] min-[769px]:hidden">Nuevo</span>
              {textoCampo(clave, nuevo?.[clave], nuevo)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatosRegistro({
  origen,
  nuevo,
}: {
  origen: string | null;
  nuevo: Record<string, unknown> | null;
}) {
  const filas: Array<{ etiqueta: string; valor: string }> = [];
  if (origen) filas.push({ etiqueta: 'Origen', valor: origen });
  for (const [clave, valor] of Object.entries(nuevo ?? {})) {
    if (clave === 'origen') continue;
    const texto = textoCampo(clave, valor, nuevo);
    if (texto === '—') continue;
    filas.push({ etiqueta: campoLabel[clave] || clave, valor: texto });
  }
  if (filas.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Datos del registro</p>
      <dl className="mt-3 grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 min-[1201px]:grid-cols-3">
        {filas.map((fila) => (
          <div key={fila.etiqueta}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{fila.etiqueta}</dt>
            <dd className="mt-1 text-sm text-[#0F172A]">{fila.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EntityHistorialPanel({
  historial,
  page,
  onPageChange,
}: {
  historial: EntityHistorial;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const ultimaPagina = Math.max(historial.meta.totalPages, 1);
  const mostrarAlta = !historial.resumen.tieneAlta && page >= ultimaPagina;
  const eventos: EntityHistorialEvento[] = mostrarAlta
    ? [
        ...historial.data,
        {
          id: 'alta-sistema',
          action: 'CREATE',
          entityType: 'PERSON',
          createdAt: historial.introduccion.fecha,
          usuario: historial.introduccion.usuario,
          sede: historial.introduccion.sede,
          departamento: historial.introduccion.departamento,
          anterior: null,
          nuevo: historial.introduccion.origen ? { origen: historial.introduccion.origen } : null,
          campos: null,
        },
      ]
    : historial.data;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-6 rounded-xl border border-[#E2E8F0] bg-white p-6 min-[769px]:flex-row min-[769px]:items-start min-[769px]:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-[#0F172A]">Historial de cambios</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Todas las modificaciones registradas en el sistema para este emprendedor.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 min-[481px]:gap-8">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Total de cambios</dt>
            <dd className="mt-1 text-2xl font-bold text-[#0F172A]">{historial.resumen.total}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Rango de fechas</dt>
            <dd className="mt-1 text-sm text-[#0F172A]">{fechaLarga(historial.resumen.desde)}</dd>
            <dd className="text-sm text-[#64748B]">al {fechaLarga(historial.resumen.hasta)}</dd>
          </div>
        </dl>
      </section>

      {eventos.length === 0 ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-sm text-[#64748B]">
          Todavía no hay cambios registrados para este emprendedor.
        </p>
      ) : (
        <ol className="relative m-0 list-none space-y-4 border-l border-[#E2E8F0] pl-6">
          {eventos.map((evento) => {
            const vista = presentar(evento);
            const anterior = comoRegistro(evento.anterior);
            const nuevo = comoRegistro(evento.nuevo);
            return (
              <li key={evento.id} className="relative">
                <span
                  className={`absolute -left-[1.95rem] top-7 h-2.5 w-2.5 rounded-full ring-4 ring-[#F8FAFC] ${puntoClase[vista.tono]}`}
                  aria-hidden
                />
                <article className="rounded-xl border border-[#E2E8F0] bg-white p-4 min-[769px]:p-6">
                  <div className="flex flex-col gap-1 min-[769px]:flex-row min-[769px]:items-center min-[769px]:gap-3">
                    <p className={`w-fit rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tonoClase[vista.tono]}`}>
                      {vista.tipo}
                    </p>
                    <p className="text-sm text-[#64748B]">{fechaHora(evento.createdAt)}</p>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[#0F172A]">{vista.titulo}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{vista.descripcion}</p>
                  {vista.modo === 'registro' ? (
                    <DatosRegistro
                      origen={nuevo?.origen ? String(nuevo.origen) : historial.introduccion.origen}
                      nuevo={nuevo}
                    />
                  ) : (
                    <TablaCambios anterior={anterior} nuevo={nuevo} />
                  )}
                  {!nuevo && !anterior && evento.campos?.length ? (
                    <p className="mt-4 text-sm text-[#64748B]">
                      Campos modificados: {evento.campos.map((campo) => campoLabel[campo] || campo).join(', ')}.
                      El valor anterior y el nuevo no quedaron guardados en ese momento.
                    </p>
                  ) : null}
                  <RealizadoPor
                    usuario={evento.usuario}
                    sede={evento.sede}
                    departamento={evento.departamento}
                    confirmacion={evento.confirmacion}
                  />
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {historial.meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-[#64748B]">
            Página {historial.meta.page} de {historial.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[#2563EB] disabled:text-[#94A3B8]"
              disabled={!historial.meta.hasPrevPage}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[#2563EB] disabled:text-[#94A3B8]"
              disabled={!historial.meta.hasNextPage}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
