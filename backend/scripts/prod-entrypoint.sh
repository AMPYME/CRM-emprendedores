#!/bin/sh
# Arranque producción:
# 1) migrate deploy (+ recuperación P3009 si aplica)
# 2) repair-schema.js SIEMPRE (idempotente: crea tablas faltantes, ignora "already exists")
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

run_repair() {
  if [ -f prisma/repair-schema.js ]; then
    echo "🔧 Ejecutando prisma/repair-schema.js (idempotente)..."
    node prisma/repair-schema.js
  elif [ -f scripts/repair-schema.js ]; then
    echo "🔧 Ejecutando scripts/repair-schema.js (idempotente)..."
    node scripts/repair-schema.js
  else
    echo "❌ No se encontró repair-schema.js en la imagen."
    echo "   En Dokploy: rebuild SIN caché y asegure Context Path = raíz del repo."
    ls -la prisma scripts 2>/dev/null || true
    exit 1
  fi
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

# Siempre reparar: en prod el historial puede decir "OK" y faltar audit_logs / verification_items.
run_repair

if [ "$(table_exists audit_logs)" != "1" ]; then
  echo "❌ Tras repair sigue faltando public.audit_logs"
  exit 1
fi

echo "🚀 Iniciando servidor..."
exec node dist/server.js
