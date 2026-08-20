#!/bin/sh
set -e

echo "📦 Instalando dependencias..."
npm install

echo "🔧 Generando Prisma Client..."
npx prisma generate

echo "🗄️  Aplicando migraciones..."
if ! npx prisma migrate deploy; then
  echo "⚠️  El historial de migraciones no coincide (baseline unificado)."
  echo "   En desarrollo se reinicia la BD para arrancar desde cero."
  if [ "${NODE_ENV:-development}" = "development" ] || [ "${PRISMA_MIGRATE_RESET_ON_FAILURE:-true}" = "true" ]; then
    npx prisma migrate reset --force
  else
    echo "❌ migrate deploy falló. Ejecute: npx prisma migrate reset --force"
    exit 1
  fi
else
  echo "🌱 Ejecutando seeds..."
  npm run prisma:seed
fi

echo "🚀 Iniciando servidor de desarrollo..."
npm run dev
