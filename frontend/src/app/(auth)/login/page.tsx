'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { entraSessionService } from '@/services/entra-session.service';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/services/api-client';
import { entraReturnUrl } from '@/lib/entra';

const CENTRO_INTERNA = 'https://aplicaciones.ampyme.local/';
const CENTRO_PUBLICA = 'http://programas.ampyme.gob.pa/aplicaciones';

async function resolverUrlCentro(timeoutMs = 2000): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(CENTRO_INTERNA, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return CENTRO_INTERNA;
  } catch {
    return CENTRO_PUBLICA;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [centroHref, setCentroHref] = useState(CENTRO_PUBLICA);
  const [volviendo, setVolviendo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void resolverUrlCentro().then(setCentroHref);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const guard = `entra-exchange:${code}`;
    if (sessionStorage.getItem(guard)) return;
    sessionStorage.setItem(guard, '1');
    window.history.replaceState(null, '', '/login');

    setBusy(true);
    authService
      .exchange(code)
      .then(async (result) => {
        setAuth(result.user, result.accessToken, result.refreshToken);
        // Captura csrfToken de la sesión central (misma cookie del login Entra).
        const me = await entraSessionService.me();
        if (me.kind === 'ok') {
          useAuthStore.getState().setCsrfToken(me.data.csrfToken ?? null);
        }
        toast.success(`¡Bienvenido, ${result.user.firstName}!`);
        router.replace('/dashboard');
      })
      .catch((error) => {
        sessionStorage.removeItem(guard);
        setBusy(false);
        toast.error(getApiErrorMessage(error));
      });
  }, [router, setAuth]);

  const ingresarConMicrosoft = () => {
    if (busy) return;
    setBusy(true);
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL || 'http://10.14.80.245/api/v1'
    ).replace(/\/$/, '');
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${apiBase}/auth/entra/start`;
    for (const [name, value] of Object.entries({
      returnUrl: entraReturnUrl(),
    })) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };

  const volverAlCentro = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (volviendo) return;
    setVolviendo(true);
    try {
      const url = await resolverUrlCentro();
      window.location.assign(url);
    } finally {
      setVolviendo(false);
    }
  };

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Panel visual (desktop) */}
      <div className="relative hidden min-h-0 lg:flex lg:w-2/3 lg:items-center lg:justify-center lg:overflow-hidden lg:bg-[#0066A1]">
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="/emprendedores-bg.webp"
          alt=""
          draggable={false}
        />
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center px-10 py-8">
          <img
            className="h-auto w-[min(90%,42rem)] max-h-[50vh] object-contain"
            src="/logo-rgb-white-GOB_AMPY_EDE.png"
            alt="AMPYME"
            draggable={false}
          />
          <h2 className="mt-6 text-center text-2xl font-semibold tracking-wide text-white drop-shadow-md md:text-3xl">
            Base de Datos Emprendedores
          </h2>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-slate-50 lg:w-1/3">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-6 sm:px-8">
          <div className="flex w-full flex-col rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
            <a
              href={centroHref}
              onClick={volverAlCentro}
              aria-busy={volviendo}
              className="mb-5 inline-flex w-fit items-center gap-2 rounded-md bg-gradient-to-r from-[#073B6F] to-[#0B5FA5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#073B6F] aria-[busy=true]:opacity-70"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M.88,14.09,4.75,18a1,1,0,0,0,1.42,0h0a1,1,0,0,0,0-1.42L2.61,13H23a1,1,0,0,0,1-1h0a1,1,0,0,0,-1-1H2.55L6.17,7.38A1,1,0,0,0,6.17,6h0A1,1,0,0,0,4.75,6L.88,9.85A3,3,0,0,0,.88,14.09Z" />
              </svg>
              Volver al Centro de Aplicaciones
            </a>

            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 h-20 w-20">
                <img
                  className="h-full w-full object-contain"
                  src="/emprendedores-icon.svg"
                  alt="Emprendedores"
                  draggable={false}
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#073B6F]">Emprendedores</h1>
              <p className="mt-1 text-sm font-semibold text-slate-800">Base de datos</p>
              <p className="mt-1.5 text-sm leading-snug text-slate-500">
                Sistema de gestión de Emprendedores — AMPYME
              </p>
            </div>

            <p className="mb-4 text-lg font-semibold text-slate-800">Acceso Usuario</p>

            <p className="text-sm text-slate-500">
              El ingreso usa la cuenta institucional de Microsoft. No se pide contraseña en esta pantalla.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() => void ingresarConMicrosoft()}
              className="mt-5 w-full rounded-lg bg-[#10B981] py-3 text-base font-semibold text-white transition-colors hover:bg-[#059669] active:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                'Ingresar con Microsoft'
              )}
            </button>

            <p className="mt-3 text-sm text-slate-500">
              Pantalla solo para uso interno. Si no tienes acceso, contacta it@ampyme.gob.pa.
            </p>
          </div>

          <footer className="mt-4 shrink-0 pb-2 text-center text-xs text-slate-500">
            © 2026 Autoridad de la Micro, Pequeña y Mediana Empresa. Todos los derechos reservados.
          </footer>
        </div>
      </div>
    </div>
  );
}
