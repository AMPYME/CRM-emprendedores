'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/services/api-client';

const loginSchema = z.object({
  email: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const APLICACIONES_INTERNA = 'https://aplicaciones.ampyme.local/';
const APLICACIONES_PUBLICA = 'http://programas.ampyme.gob.pa/aplicaciones';

async function resolveAplicacionesHubUrl(timeoutMs = 2000): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(APLICACIONES_INTERNA, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return APLICACIONES_INTERNA;
  } catch {
    return APLICACIONES_PUBLICA;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [aplicacionesHref, setAplicacionesHref] = useState(APLICACIONES_INTERNA);
  const [abriendoCentro, setAbriendoCentro] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    let cancelado = false;
    void resolveAplicacionesHubUrl().then((url) => {
      if (!cancelado) setAplicacionesHref(url);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get('email');
    const hadSecrets = params.has('password') || params.has('email');

    if (emailFromQuery && !params.has('password')) {
      setValue('email', emailFromQuery);
    }

    if (hadSecrets) {
      window.history.replaceState(null, '', '/login');
    }
  }, [setValue]);

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

  return (
    <div className="flex min-h-screen flex-col overflow-hidden lg:h-screen lg:flex-row">
      <div
        className="relative hidden overflow-hidden bg-[#0066a1] lg:flex lg:h-screen lg:w-2/3 lg:items-center lg:justify-center lg:p-10"
        style={{
          backgroundImage: 'url(/emprendedores-bg.webp)',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-slate-50 p-6 sm:p-10 lg:h-screen lg:w-1/3">
        <form
          className="my-auto w-full rounded-lg bg-white p-8 shadow-sm"
          method="post"
          action="/login"
          autoComplete="on"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(onSubmit)(e);
          }}
        >
          <a
            href={aplicacionesHref}
            onClick={async (e) => {
              e.preventDefault();
              if (abriendoCentro) return;
              setAbriendoCentro(true);
              try {
                window.location.assign(await resolveAplicacionesHubUrl());
              } finally {
                setAbriendoCentro(false);
              }
            }}
            className="mb-6 inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold no-underline"
            style={{
              color: '#16A34A',
              background:
                'linear-gradient(135deg, color-mix(in srgb, #16A34A 10%, #ffffff) 0%, color-mix(in srgb, #16A34A 18%, #ffffff) 100%)',
              border: '1px solid color-mix(in srgb, #16A34A 22%, #ffffff)',
              opacity: abriendoCentro ? 0.75 : 1,
              pointerEvents: abriendoCentro ? 'none' : 'auto',
            }}
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

          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-20 w-20">
              <img
                src="/emprendedores-icon.svg"
                alt="Emprendedores"
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-[#073b6f]">Emprendedores</h1>
            <p className="mt-0.5 text-base font-semibold text-slate-800">Base de datos</p>
            <p className="mt-1.5 text-sm leading-snug text-slate-500">
              Consulta y administra la información de personas y empresas atendidas.
            </p>
          </div>

          <header className="mb-6 text-xl font-semibold text-slate-800">Acceso Usuario</header>

          <div className="mb-4">
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Usuario"
              className={`w-full rounded-lg border-[1.2px] bg-slate-50 px-3 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0066a1] ${
                errors.email ? 'border-red-400' : 'border-slate-200'
              }`}
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>

          <div className="mb-4">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              className={`w-full rounded-lg border-[1.2px] bg-slate-50 px-3 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0066a1] ${
                errors.password ? 'border-red-400' : 'border-slate-200'
              }`}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Si no tiene una cuenta, contacte <strong className="text-slate-800">tecnologia@ampyme.gob.pa</strong>.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg bg-[#10b981] py-3 text-lg font-semibold text-white transition-colors hover:bg-[#059669] active:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Acceder
              </span>
            ) : (
              'Acceder'
            )}
          </button>
        </form>

        <footer className="mt-auto pt-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Autoridad de la Micro, Pequeña y Mediana Empresa. Todos los
          derechos reservados.
        </footer>
      </div>
    </div>
  );
}
