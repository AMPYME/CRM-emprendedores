import { Suspense } from 'react';
import { PublicIntakeForm } from './public-intake-form';

export default function PublicIntakePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
          Cargando formulario…
        </div>
      }
    >
      <PublicIntakeForm />
    </Suspense>
  );
}
