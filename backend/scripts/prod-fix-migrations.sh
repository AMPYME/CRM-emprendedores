#!/bin/sh
# Uso puntual en Dokploy (Run Command / shell) si faltan tablas o hay P3009.
# NO dejar como comando permanente de cada deploy.
set -e

echo "→ rolled-back baseline fallido (si aplica)..."
npx prisma migrate resolve --rolled-back "20260820140000_baseline" || true

EXISTS="$(CHECK_TABLE=users node <<'NODE'
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
  echo "→ marcando baseline como aplicada (BD ya tenía tablas)..."
  npx prisma migrate resolve --applied "20260820140000_baseline" || true
fi

echo "→ apply migraciones pendientes..."
npx prisma migrate deploy || true

echo "→ reparando esquema (crea audit_logs, verification_items, etc.)..."
node scripts/repair-schema.js

echo "✅ Listo. Reinicie el servicio backend."
