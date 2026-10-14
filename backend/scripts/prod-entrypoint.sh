#!/bin/sh
# Arranque producción:
# 0) esperar PostgreSQL (evita P1001 en Dokploy)
# 1) migrate deploy (+ recuperación P3009 si aplica; NUNCA si es P1001)
# 2) repair-schema.js SIEMPRE (idempotente: crea tablas faltantes, ignora "already exists")
# 3) levanta API
set -e

URL_FILE="${DB_URL_FILE:-/tmp/emprendedores-database-url}"

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
  } catch (err) {
    const msg = err && err.message ? String(err.message) : '';
    if (msg.includes("Can't reach database") || msg.includes('P1001')) {
      process.stdout.write('err');
    } else {
      process.stdout.write('0');
    }
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

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL no está definida en el entorno del contenedor."
  exit 1
fi

echo "⏳ Comprobando PostgreSQL..."
node ./scripts/wait-for-db.js "$URL_FILE"
export DATABASE_URL="$(cat "$URL_FILE")"

echo "🗄️  Aplicando migraciones..."

set +e
MIGRATE_OUT="$(npx prisma migrate deploy 2>&1)"
MIGRATE_RC=$?
set -e
printf '%s\n' "$MIGRATE_OUT"

if [ "$MIGRATE_RC" -eq 0 ]; then
  echo "✅ Migraciones aplicadas"
else
  case "$MIGRATE_OUT" in
    *P1001*)
      echo "❌ migrate deploy no alcanzó PostgreSQL (P1001) tras esperar."
      echo "   Revisa DATABASE_URL y que el backend esté enlazado a la BD en Dokploy."
      exit 1
      ;;
  esac

  echo "⚠️  migrate deploy falló."
  echo "   Recuperando registro de migración fallida..."

  case "$MIGRATE_OUT" in
    *20261013170000_crm_session_entra_ref*)
      echo "   Marcando 20261013170000_crm_session_entra_ref como revertida para reintentarla..."
      npx prisma migrate resolve --rolled-back "20261013170000_crm_session_entra_ref" || true
      ;;
    *)
      npx prisma migrate resolve --rolled-back "20260820140000_baseline" || true
      ;;
  esac

  USERS_STATE="$(table_exists users)"
  if [ "$USERS_STATE" = "err" ]; then
    echo "❌ No hay conexión a PostgreSQL; no se marcará el baseline."
    exit 1
  elif [ "$USERS_STATE" = "1" ]; then
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
