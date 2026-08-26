'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, CheckCircle2, Radio, WifiOff, Clock, AlertTriangle,
  Copy, Check, QrCode, Pencil, Trash2, KeyRound, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { getIntakeFormUrl, intakeAccessCodeKey } from '@/services/intake.service';
import { useIntakeStream } from '@/hooks/use-intake-stream';
import {
  useValidateIntakeSession,
  useDeleteIntakeSession,
  useVerifyIntakeAccess,
  useRegenerateIntakeAccessCode,
} from '@/hooks/use-intake';
import { useValidateVerification, useReleaseVerification } from '@/hooks/use-verifications';
import { IntakeEditModal } from '../intake-edit-modal';
import { IntakeSnapshotView } from '../intake-snapshot-view';

function LiveIndicator({ status, connected }: { status: string; connected: boolean }) {
  if (status === 'validated') return <Badge variant="success">Validada</Badge>;
  if (status === 'expired') return <Badge variant="default">Expirada</Badge>;
  if (connected && status === 'live') {
    return (
      <Badge variant="success">
        <Radio className="mr-1 h-3 w-3 animate-pulse" /> En vivo
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <WifiOff className="mr-1 h-3 w-3" /> Conectando…
    </Badge>
  );
}

function readStoredCode(sessionId: string): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(intakeAccessCodeKey(sessionId)) || '';
}

export default function IntakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verificationId = searchParams.get('verificationId');
  const id = params?.id as string;

  const [accessCode, setAccessCode] = useState('');
  const [draftCode, setDraftCode] = useState('');
  const [accessOpen, setAccessOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visibleCode, setVisibleCode] = useState<string>('');

  useEffect(() => {
    const stored = readStoredCode(id);
    if (stored) {
      setAccessCode(stored);
      setDraftCode(stored);
      setAccessOpen(false);
    }
  }, [id]);

  const { snapshot, status, connected, errorMessage } = useIntakeStream(id, accessCode || undefined);
  const validateMutation = useValidateIntakeSession();
  const validateVerificationMutation = useValidateVerification();
  const releaseMutation = useReleaseVerification();
  const deleteMutation = useDeleteIntakeSession();
  const verifyMutation = useVerifyIntakeAccess();
  const regenerateMutation = useRegenerateIntakeAccessCode();

  const formUrl = getIntakeFormUrl(id);

  useEffect(() => {
    if (status === 'access_denied') {
      setAccessOpen(true);
      setAccessCode('');
      setDraftCode('');
    }
  }, [status]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const submitAccessCode = async () => {
    await verifyMutation.mutateAsync({ id, accessCode: draftCode });
    sessionStorage.setItem(intakeAccessCodeKey(id), draftCode);
    setAccessCode(draftCode);
    setAccessOpen(false);
  };

  const handleValidate = async () => {
    try {
      if (verificationId) {
        await validateVerificationMutation.mutateAsync(verificationId);
      } else {
        await validateMutation.mutateAsync({ id, accessCode });
      }
      setConfirmOpen(false);
      router.push('/dashboard/intake');
    } catch {
      setConfirmOpen(false);
      // El toast de error lo emiten las mutaciones (onError).
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteOpen(false);
      router.push('/dashboard/intake');
    } catch {
      setDeleteOpen(false);
    }
  };

  const handleGenerateNewCode = async () => {
    const result = await regenerateMutation.mutateAsync(id);
    setVisibleCode(result.accessCode);
    setAccessCode(result.accessCode);
    setDraftCode(result.accessCode);
    sessionStorage.setItem(intakeAccessCodeKey(id), result.accessCode);
  };

  const canValidate =
    status === 'live' &&
    !!snapshot &&
    snapshot.status === 'SUBMITTED' &&
    (!!accessCode || !!verificationId);
  const canDelete = !!snapshot && status !== 'validated' && status !== 'expired' && !!accessCode;
  const canEdit = canDelete && snapshot?.status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{snapshot?.displayName || 'Sesión de verificación'}</h1>
              <LiveIndicator status={status} connected={connected} />
            </div>
            {verificationId && snapshot?.expiresAt && (
              <p className="mt-1 text-xs text-amber-800">
                Asignación de importación: 30 minutos sin guardar cambios. Ver la sesión en vivo no renueva el plazo.
                Expira {new Date(snapshot.expiresAt).toLocaleTimeString('es-PA')}.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/intake')} icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
            <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} icon={<QrCode className="h-4 w-4" />}>
              Enlace / QR
            </Button>
            {canEdit && (
              <>
                <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} icon={<Pencil className="h-4 w-4" />}>
                  Editar
                </Button>
              </>
            )}
            {verificationId && (
              <>
                <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm('¿Liberar esta asignación para que otro funcionario pueda tomarla?')) return;
                    await releaseMutation.mutateAsync(verificationId);
                    router.push('/dashboard/intake');
                  }}
                  isLoading={releaseMutation.isPending}
                  className="text-amber-700"
                >
                  Liberar asignación
                </Button>
              </>
            )}
            {canDelete && (
              <>
                {!canEdit && <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  icon={<Trash2 className="h-4 w-4" />}
                  className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setConfirmOpen(true)}
            disabled={!canValidate || (!accessCode && !verificationId)}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Validar y guardar
          </Button>
        </div>
      </div>

          {status === 'expired' ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="La sesión expiró"
            description={
              verificationId
                ? 'Pasaron 30 minutos sin cambios. El registro volvió a la cola de verificación para que otro funcionario lo tome.'
                : 'El emprendedor no completó el registro a tiempo. Crea una nueva sesión.'
            }
            action={<Button onClick={() => router.push('/dashboard/intake')}>Volver al listado</Button>}
          />
        </Card>
      ) : status === 'validated' ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Datos validados"
            description="La información ya quedó guardada en el padrón."
            action={<Button onClick={() => router.push('/dashboard/intake')}>Volver al listado</Button>}
          />
        </Card>
      ) : !accessCode ? (
        <Card>
          <EmptyState
            icon={KeyRound}
            title="Código de acceso requerido"
            description="Ingresa el código temporal para ver o editar este borrador."
            action={<Button onClick={() => setAccessOpen(true)}>Ingresar código</Button>}
          />
        </Card>
      ) : !snapshot ? (
        <Card>
          <EmptyState
            icon={Radio}
            title="Esperando datos del emprendedor"
            description="Cuando el emprendedor empiece a escribir, verás sus datos aquí en tiempo real."
          />
        </Card>
      ) : (
        <>
          {snapshot.status === 'SUBMITTED' && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <AlertTriangle className="h-4 w-4" />
              El emprendedor envió el formulario. Revisa y valida los datos.
            </div>
          )}
          <IntakeSnapshotView snapshot={snapshot} />
        </>
      )}

      <Modal
        isOpen={accessOpen}
        onClose={() => setAccessOpen(false)}
        title="Código de acceso"
        description="Ingresa el código temporal de 6 dígitos para ver y editar este borrador."
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Código"
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="text-center font-mono tracking-[0.35em]"
          />
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push('/dashboard/intake')}>
              Cancelar
            </Button>
            <Button onClick={submitAccessCode} isLoading={verifyMutation.isPending}>
              Ver borrador
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleValidate}
        title="Validar y guardar"
        message="¿Está seguro de que desea finalizar el registro? La información se guardará de forma permanente y el borrador será eliminado."
        confirmLabel="Validar y guardar"
        variant="primary"
        isLoading={validateMutation.isPending || validateVerificationMutation.isPending}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar sesión"
        message="Se eliminará esta sesión. Los datos ya guardados en el padrón no se tocan. ¿Continuar?"
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {snapshot && accessCode && (
        <IntakeEditModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          sessionId={id}
          snapshot={snapshot}
          accessCode={accessCode}
        />
      )}

      <Modal
        isOpen={shareOpen}
        onClose={() => {
          setShareOpen(false);
          setVisibleCode('');
        }}
        title="Enlace de la sesión"
        description="Comparte este enlace o código QR con el emprendedor."
        size="md"
      >
        <div className="space-y-5">
          <div className="flex justify-center rounded-xl bg-gray-50 p-6">
            <QRCodeSVG value={formUrl} size={180} includeMargin />
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

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <KeyRound className="h-4 w-4" />
              Código temporal de acceso
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Una vez cerrada esta ventana, el código no volverá a mostrarse, anota el código. Si lo necesitas otra vez, genera uno nuevo.
            </p>
            {visibleCode ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.35em] text-amber-950">
                {visibleCode}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-amber-300 px-3 py-3 text-sm text-amber-900">
                Genera un código nuevo para volver a mostrarlo.
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                onClick={handleGenerateNewCode}
                isLoading={regenerateMutation.isPending}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Generar código nuevo
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
