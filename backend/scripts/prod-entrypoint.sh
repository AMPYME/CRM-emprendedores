#!/bin/sh
# Arranque producción:
# 1) migrate deploy
# 2) si falló el baseline unificado sobre una BD ya existente (P3009), recuperar y continuar
# 3) levantar API
set -e

echo "🗄️  Aplicando migraciones..."

if npx prisma migrate deploy; then
  echo "✅ Migraciones aplicadas"
else
  echo "⚠️  migrate deploy falló (posible baseline fallido P3009 en BD existente)."
  echo "   Recuperando registro de migración fallida..."

  npx prisma migrate resolve --rolled-back "20260820140000_baseline" || true

  EXISTS="$(node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1"
    );
    process.stdout.write(Array.isArray(rows) && rows.length ? '1' : '0');
  } catch {
    process.stdout.write('0');
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
NODE
)"

  if [ "$EXISTS" = "1" ]; then
    echo "📦 BD existente detectada: marcando baseline como aplicada (sin re-ejecutar CREATE)..."
    npx prisma migrate resolve --applied "20260820140000_baseline" || true
  else
    echo "🆕 BD vacía: se reintentará aplicar el baseline completo..."
  fi

  echo "🗄️  Reintentando migrate deploy..."
  npx prisma migrate deploy
  echo "✅ Migraciones aplicadas tras recuperación"
fi

echo "🚀 Iniciando servidor..."
exec node dist/server.js
