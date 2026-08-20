#!/bin/sh
# Arranque producción: aplica el baseline de Prisma y levanta el API.
set -e

echo "🗄️  Aplicando migraciones..."
npx prisma migrate deploy

echo "🚀 Iniciando servidor..."
exec node dist/server.js
