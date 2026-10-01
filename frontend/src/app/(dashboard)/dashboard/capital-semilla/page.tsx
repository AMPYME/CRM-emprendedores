'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { capitalSemillaService } from '@/services/capital-semilla.service';
import { getApiErrorMessage } from '@/services/api-client';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';

interface Coincidencia {
  id: string;
  personId: string;
  displayName: string;
  entityType: 'PERSON';
  cedula: string | null;
  linkedAt: string | null;
  capitalSemillaId: string | null;
}

export default function CapitalSemillaPage() {
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
    const valor = match.linkedAt?.slice(0, 10) ?? '';
    setEntidad(match);
    setFecha(valor);
    setFechaGuardada(valor || null);
  }

  async function verificar() {
    const value = documento.trim();
    if (!value) {
      toast.error('Indique una cédula.');
      return;
    }
    setVerificando(true);
    setCoincidencias([]);
    setEntidad(null);
    try {
      const matches = await capitalSemillaService.verificar(value);
      if (matches.length === 0) {
        toast.error('No hay una persona con esa cédula.');
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
      await capitalSemillaService.setFecha(entidad.id, siguiente);
      toast.success('Cambio pendiente de confirmación. Revise Confirmación.');
      setFecha(siguiente ?? '');
      setFechaGuardada(siguiente);
      setEntidad({ ...entidad, linkedAt: siguiente });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  }

  function textoEstado(valor: string | null): string {
    if (!valor) return 'No tiene capital semilla';
    return `Capital semilla registrado (${valor})`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital Semilla"
        description="Escriba la cédula y verifique antes de asignar la fecha. Sin vencimiento."
      />

      <Card title="Verificar cédula">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void verificar();
          }}
        >
          <div className="flex-1">
            <Input
              label="Cédula"
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              placeholder="8-123-456"
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
                {match.displayName}
                {match.cedula ? ` · ${match.cedula}` : ''}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {entidad && (
        <Card title={entidad.displayName}>
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">{textoEstado(fechaGuardada)}</p>
            <Input
              label="Fecha de capital semilla"
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
                  Quitar capital semilla
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
