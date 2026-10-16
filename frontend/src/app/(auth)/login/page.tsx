'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/services/api-client';
import { entraReturnUrl } from '@/lib/entra';
import { publicApiBaseUrl } from '@/lib/public-urls';

const CENTRO_INTERNA = 'https://aplicaciones.ampyme.local/';
const CENTRO_PUBLICA = 'http://programas.ampyme.gob.pa/aplicaciones';

const loginSchema = z.object({
  email: z.string().min(1, 'Usuario o correo requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await authService.login(data);
      setAuth(result.user, result.accessToken, result.refreshToken, result.adAccessToken);
      toast.success(`¡Bienvenido, ${result.user.firstName}!`);
      router.replace('/dashboard');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

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
        toast.success(`¡Bienvenido, ${result.user.firstName}!`);
        router.replace('/dashboard');
      })
      .catch((error) => {
        sessionStorage.removeItem(guard);
        setBusy(false);
        toast.error(getApiErrorMessage(error));
      });
  }, [router, setAuth]);

  const ingresarConMicrosoft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${publicApiBaseUrl()}/auth/entra/start`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ returnUrl: entraReturnUrl() }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      const target = data.url ? new URL(data.url) : null;
      if (!res.ok || !target || target.protocol !== 'https:' || !target.hostname.endsWith('microsoftonline.com')) {
        throw new Error(data.error || 'No se pudo abrir el login de Microsoft');
      }
      window.location.assign(target.href);
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el login de Microsoft');
    }
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

            <form
              method="post"
              action="/login"
              autoComplete="on"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(onSubmit)(event);
              }}
            >
              <label htmlFor="username" className="mb-1.5 text-sm font-semibold text-slate-800">
                Usuario
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Usuario"
                className={`w-full rounded-lg border-[1.2px] bg-slate-50 px-3 py-2.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0066A1] ${
                  errors.email ? 'border-red-400' : 'border-slate-200'
                }`}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}

              <label htmlFor="password" className="mb-1.5 mt-4 text-sm font-semibold text-slate-800">
                Contraseña
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                className={`w-full rounded-lg border-[1.2px] bg-slate-50 px-3 py-2.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0066A1] ${
                  errors.password ? 'border-red-400' : 'border-slate-200'
                }`}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || busy}
                className="mt-5 w-full rounded-lg bg-[#10B981] py-3 text-base font-semibold text-white transition-colors hover:bg-[#059669] active:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </span>
                ) : (
                  'Acceder'
                )}
              </button>
            </form>

            <button
              type="button"
              disabled={busy || isSubmitting}
              onClick={() => void ingresarConMicrosoft()}
              className="mt-3 w-full rounded-lg border border-[#0066A1] bg-white py-3 text-base font-semibold text-[#0066A1] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                'Microsoft'
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
