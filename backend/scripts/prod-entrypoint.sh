#!/bin/sh
# Arranque producción:
# 1) migrate deploy (+ recuperación P3009 si aplica)
# 2) si faltan tablas críticas, reparar con scripts/repair-schema.js
#    (no usa db push: falla con enums legacy como ESTABLISHMENT / P1014)
# 3) levanta API
set -e

table_exists() {
  CHECK_TABLE="$1" node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const name = process.env.CHECK_TABLE;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}' LIMIT 1`
    );
    process.stdout.write(Array.isArray(rows) && rows.length ? '1' : '0');
  } catch {
    process.stdout.write('0');
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
NODE
}

echo "🗄️  Aplicando migraciones..."

if npx prisma migrate deploy; then
  echo "✅ Migraciones aplicadas"
else
  echo "⚠️  migrate deploy falló (posible baseline fallido P3009 en BD existente)."
  echo "   Recuperando registro de migración fallida..."

  npx prisma migrate resolve --rolled-back "20260820140000_baseline" || true

  if [ "$(table_exists users)" = "1" ]; then
    echo "📦 BD existente detectada: marcando baseline como aplicada..."
    npx prisma migrate resolve --applied "20260820140000_baseline" || true
  else
    echo "🆕 BD vacía: se reintentará aplicar el baseline completo..."
  fi

  echo "🗄️  Reintentando migrate deploy..."
  npx prisma migrate deploy
  echo "✅ Migraciones aplicadas tras recuperación"
fi

NEED_REPAIR=0
for t in users audit_logs entities persons companies verification_items; do
  if [ "$(table_exists "$t")" != "1" ]; then
    echo "⚠️  Falta la tabla public.$t"
    NEED_REPAIR=1
  fi
done

if [ "$NEED_REPAIR" = "1" ]; then
  echo "🔧 Reparando esquema incompleto (baseline + roles, idempotente)..."
  node scripts/repair-schema.js
fi

echo "🚀 Iniciando servidor..."
exec node dist/server.js
