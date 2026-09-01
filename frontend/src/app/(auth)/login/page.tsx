'use client';

import { useEffect } from 'react';
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
  email: z.string().min(1, 'Usuario o correo requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

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
    <div className="flex min-h-screen flex-col overflow-hidden lg:flex-row">
      <div className="relative hidden lg:flex lg:h-screen lg:w-2/3">
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="/fondo-EDE2%20(1).jpg"
          alt=""
          draggable={false}
        />
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-10">
          <img
            className="w-[min(90%,56rem)] max-h-[55%] object-contain"
            src="/logo-rgb-white-GOB_AMPY_EDE.png"
            alt="AMPYME"
            draggable={false}
          />
          <h2 className="mt-6 bg-transparent text-center text-2xl font-semibold tracking-wide text-white drop-shadow-md md:text-3xl">
            Base de Datos Emprendedores
          </h2>
        </div>
      </div>

      <div className="flex min-h-screen w-full flex-col bg-white lg:h-screen lg:w-1/3">
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
          <div className="w-full max-w-[28rem] rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
          <form
            method="post"
            action="/login"
            autoComplete="on"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(onSubmit)(e);
            }}
            className="flex w-full flex-col"
          >
            <div className="mb-8 text-center">
              <img
                className="mx-auto mb-4 h-16 w-auto object-contain"
                src="/fondo-base3%20(1).jpg"
                alt=""
                draggable={false}
              />
              <p className="text-2xl font-semibold tracking-tight text-[#073B6F]">Emprendedores</p>
              <img
                className="mx-auto mt-3 h-24 w-auto object-contain"
                src="/database%20(1).gif"
                alt=""
                draggable={false}
              />
              <p className="mt-2 text-sm text-gray-500">
                Sistema de gestión de Emprendedores — AMPYME
              </p>
            </div>

            <label htmlFor="username" className="mb-2 text-sm font-semibold text-gray-800">
              Usuario
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div
              className={`group relative w-full rounded-lg border-[1.2px] bg-white transition-colors focus-within:border-[#073B6F] ${
                errors.email ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#073B6F]"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.75 6C15.75 8.07107 14.071 9.75 12 9.75C9.9289 9.75 8.24996 8.07107 8.24996 6C8.24996 3.92893 9.9289 2.25 12 2.25C14.071 2.25 15.75 3.92893 15.75 6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5011 20.1182C4.5714 16.0369 7.90184 12.75 12 12.75C16.0982 12.75 19.4287 16.0371 19.4988 20.1185C17.216 21.166 14.6764 21.75 12.0003 21.75C9.32396 21.75 6.78406 21.1659 4.5011 20.1182Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Ingresa tu usuario"
                className="w-full bg-transparent py-4 pl-16 pr-4 text-base text-gray-800 outline-none placeholder:text-gray-400"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}

            <label htmlFor="password" className="mb-2 mt-5 text-sm font-semibold text-gray-800">
              Contraseña
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div
              className={`group relative w-full rounded-lg border-[1.2px] bg-white transition-colors focus-within:border-[#073B6F] ${
                errors.password ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#073B6F]"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.5 10.5V6.75C16.5 4.26472 14.4853 2.25 12 2.25C9.51472 2.25 7.5 4.26472 7.5 6.75V10.5M6.75 21.75H17.25C18.4926 21.75 19.5 20.7426 19.5 19.5V12.75C19.5 11.5074 18.4926 10.5 17.25 10.5H6.75C5.50736 10.5 4.5 11.5074 4.5 12.75V19.5C4.5 20.7426 5.50736 21.75 6.75 21.75Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                className="w-full bg-transparent py-4 pl-16 pr-4 text-base text-gray-800 outline-none placeholder:text-gray-400"
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
            <p className="mt-3 text-sm text-gray-500">
              Use su usuario y contraseña de AMPYME
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full rounded-lg bg-[#10B981] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#059669] active:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-70"
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

            <p className="mt-6 text-center text-sm leading-relaxed text-gray-500">
              Pantalla solo para uso interno. Si no tienes una cuenta, contacta it@ampyme.gob.pa.
            </p>
          </form>
          </div>
        </div>

        <footer className="shrink-0 border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-500">
          © 2026 Autoridad de la Micro, Pequeña y Mediana Empresa. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
