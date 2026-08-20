#!/bin/sh
# Uso puntual en Dokploy (Run Command / shell). NO dejar permanente.
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
  echo "→ marcando baseline como aplicada..."
  npx prisma migrate resolve --applied "20260820140000_baseline" || true
fi

echo "→ migrate deploy..."
npx prisma migrate deploy || true

if [ -f prisma/repair-schema.js ]; then
  echo "→ node prisma/repair-schema.js"
  node prisma/repair-schema.js
elif [ -f scripts/repair-schema.js ]; then
  echo "→ node scripts/repair-schema.js"
  node scripts/repair-schema.js
else
  echo "❌ repair-schema.js no está en la imagen. Redeploy con rebuild sin caché."
  exit 1
fi

echo "✅ Listo. Reinicie el servicio backend."
