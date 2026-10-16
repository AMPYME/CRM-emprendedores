#!/bin/sh
set -e

echo "📦 Instalando dependencias..."
npm install

echo "🔧 Generando Prisma Client..."
npx prisma generate

echo "🗄️  Aplicando migraciones..."
set +e
MIGRATE_OUT="$(npx prisma migrate deploy 2>&1)"
MIGRATE_RC=$?
set -e
printf '%s\n' "$MIGRATE_OUT"

if [ "$MIGRATE_RC" -ne 0 ]; then
  case "$MIGRATE_OUT" in
    *P3009*20261013170000_crm_session_entra_ref*|*20261013170000_crm_session_entra_ref*)
      echo "⚠️  La migración 20261013170000_crm_session_entra_ref quedó fallida. Se marca como revertida y se vuelve a aplicar. No se borra la base."
      npx prisma migrate resolve --rolled-back "20261013170000_crm_session_entra_ref"
      if ! npx prisma migrate deploy; then
        echo "❌ migrate deploy falló otra vez. No se reinicia la base: eso borraría personas, empresas y seguimientos."
        exit 1
      fi
      ;;
    *)
      echo "❌ migrate deploy falló. No se reinicia la base: eso borraría personas, empresas y seguimientos."
      exit 1
      ;;
  esac
fi

USERS=$(node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.count().then((n)=>{console.log(n)}).finally(()=>p.\$disconnect())")
if [ "$USERS" = "0" ]; then
  echo "🌱 Base vacía: ejecutando seeds..."
  npm run prisma:seed
else
  echo "🌱 Seed omitido: la base ya tiene datos y un reinicio no debe borrar seguimientos."
fi

echo "🚀 Iniciando servidor de desarrollo..."
npm run dev
