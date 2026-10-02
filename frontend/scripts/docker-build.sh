#!/bin/sh
# Carga frontend/.env y ejecuta `next build` (usado por Dockerfile).
set -eu
cd /app

if [ ! -f .env ]; then
  echo "ERROR: falta /app/.env en el contexto de build."
  echo "El Dockerfile lee NEXT_PUBLIC_* y API_PROXY_TARGET desde frontend/.env"
  exit 1
fi

# Exporta variables del .env (ignora comentarios y líneas vacías)
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo "ERROR: NEXT_PUBLIC_API_URL no está definido en .env"
  exit 1
fi
if [ -z "${NEXT_PUBLIC_WS_URL:-}" ]; then
  echo "ERROR: NEXT_PUBLIC_WS_URL no está definido en .env"
  exit 1
fi

# Destino del rewrite /backend-api (alcanzable desde el contenedor Next)
export API_PROXY_TARGET="${API_PROXY_TARGET:-$NEXT_PUBLIC_API_URL}"
export NEXT_PUBLIC_INTAKE_FORM_URL="${NEXT_PUBLIC_INTAKE_FORM_URL:-}"
export NEXT_TELEMETRY_DISABLED=1

echo "[docker-build] NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
echo "[docker-build] NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}"
echo "[docker-build] API_PROXY_TARGET=${API_PROXY_TARGET}"
echo "[docker-build] NEXT_PUBLIC_INTAKE_FORM_URL=${NEXT_PUBLIC_INTAKE_FORM_URL:-<empty>}"

npm run build

test -d .next/standalone \
  || (echo "Falta .next/standalone. Revisa next.config.js output: 'standalone'." && ls -la .next && exit 1)

# Persiste los valores horneados para el stage runner / entrypoint
{
  echo "BAKE_NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
  echo "BAKE_NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}"
  echo "BAKE_NEXT_PUBLIC_INTAKE_FORM_URL=${NEXT_PUBLIC_INTAKE_FORM_URL}"
} > /app/.bake-env
