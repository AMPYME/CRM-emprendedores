/** Vigencia del registro empresarial: más de 365 días queda expirado. */
export type RegistroEmpresarialEstado = 'ninguno' | 'valido' | 'expirado';

export function registroEmpresarialEstado(fecha: string | null | undefined): RegistroEmpresarialEstado {
  if (!fecha) return 'ninguno';
  const dia = fecha.slice(0, 10);
  const inicio = new Date(`${dia}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - inicio.getTime()) / 86_400_000);
  return dias > 365 ? 'expirado' : 'valido';
}

export function registroEmpresarialTexto(fecha: string | null | undefined): string {
  const estado = registroEmpresarialEstado(fecha);
  if (estado === 'ninguno') return 'No tiene registro empresarial';
  const dia = fecha!.slice(0, 10);
  if (estado === 'expirado') return `Tiene registro empresarial — Expirado (${dia})`;
  return `Tiene registro empresarial — Válido (${dia})`;
}
