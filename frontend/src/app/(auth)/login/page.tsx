'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/services/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().min(1, 'Usuario o correo requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

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
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success(`¡Bienvenido, ${result.user.firstName}!`);
      router.replace('/dashboard');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
          <span className="text-2xl font-bold">A</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Emprendedores CRM</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sistema de gestión de cartera — AMPYME
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-gray-500">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="Usuario o correo"
            type="text"
            placeholder="usuario@ampyme.gob.pa o usuario AD"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            icon={<LogIn className="h-4 w-4" />}
          >
            Iniciar sesión
          </Button>
        </form>

        {process.env.NODE_ENV !== 'production' ? (
          <div className="mt-6 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500">Credenciales de prueba:</p>
            <div className="mt-1 space-y-0.5 text-xs text-gray-500">
              <p><strong>Admin:</strong> admin@ampyme.gob.pa / Admin2026!</p>
              <p><strong>Operador:</strong> operador@ampyme.gob.pa / Operador2026!</p>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-xs text-gray-400">
            Usa tu usuario de Active Directory (AMPYME).
          </p>
        )}
      </div>
    </div>
  );
}
