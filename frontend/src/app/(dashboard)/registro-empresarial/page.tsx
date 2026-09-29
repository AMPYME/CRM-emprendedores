'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { entitiesService } from '@/services/entities.service';
import { getApiErrorMessage } from '@/services/api-client';
import { isReadOnlyRole } from '@/lib/roles';
import { registroEmpresarialTexto } from '@/lib/registro-empresarial';
import { useAuthStore } from '@/stores/auth.store';

interface Coincidencia {
  id: string;
  displayName: string;
  entityType: 'PERSON' | 'COMPANY';
  registroEmpresarialFecha: string | null;
}

export default function RegistroEmpresarialPage() {
  const role = useAuthStore((state) => state.user?.role);
  const soloLectura = isReadOnlyRole(role);
  const [documento, setDocumento] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [entidad, setEntidad] = useState<Coincidencia | null>(null);
  const [fecha, setFecha] = useState('');
  const [fechaGuardada, setFechaGuardada] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function aplicar(match: Coincidencia) {
    const valor = match.registroEmpresarialFecha?.slice(0, 10) ?? '';
    setEntidad(match);
    setFecha(valor);
    setFechaGuardada(valor || null);
  }

  async function verificar() {
    const value = documento.trim();
    if (!value) {
      toast.error('Indique una cédula o un RUC.');
      return;
    }
    setVerificando(true);
    setCoincidencias([]);
    setEntidad(null);
    try {
      const matches = await entitiesService.verificar(value);
      if (matches.length === 0) {
        toast.error('No hay una persona ni una empresa con ese documento.');
        return;
      }
      setCoincidencias(matches);
      if (matches.length === 1) aplicar(matches[0]);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setVerificando(false);
    }
  }

  async function guardar(siguiente: string | null) {
    if (!entidad) return;
    setGuardando(true);
    try {
      const actualizada = await entitiesService.setRegistroEmpresarial(entidad.id, siguiente);
      const valor = actualizada.registroEmpresarialFecha?.slice(0, 10) ?? '';
      setFecha(valor);
      setFechaGuardada(valor || null);
      setEntidad({ ...entidad, registroEmpresarialFecha: valor || null });
      toast.success(registroEmpresarialTexto(valor || null));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro empresarial"
        description="Escriba la cédula o el RUC y verifique antes de asignar la fecha."
      />

      <Card title="Verificar documento">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void verificar();
          }}
        >
          <div className="flex-1">
            <Input
              label="Cédula o RUC"
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              placeholder="8-123-456 o 155772663-2-2025"
              autoComplete="off"
            />
          </div>
          <Button type="submit" isLoading={verificando}>
            Verificar
          </Button>
        </form>
      </Card>

      {coincidencias.length > 1 && (
        <Card title="Varias coincidencias">
          <div className="flex flex-col gap-2">
            {coincidencias.map((match) => (
              <Button
                key={match.id}
                type="button"
                variant={entidad?.id === match.id ? 'primary' : 'outline'}
                onClick={() => aplicar(match)}
              >
                {match.displayName} · {match.entityType === 'PERSON' ? 'Persona' : 'Empresa'}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {entidad && (
        <Card title={entidad.displayName}>
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">
              {registroEmpresarialTexto(fechaGuardada)}
            </p>
            <Input
              label="Fecha del registro empresarial"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              disabled={soloLectura || guardando}
            />
            {!soloLectura && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => guardar(fecha || null)}
                  disabled={guardando || fecha === (fechaGuardada ?? '')}
                  isLoading={guardando}
                >
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => guardar(null)}
                  disabled={guardando || fechaGuardada === null}
                >
                  Quitar registro
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
