#!/bin/sh
set -e

echo "📦 Instalando dependencias..."
npm install

echo "🔧 Generando Prisma Client..."
npx prisma generate

echo "🗄️  Aplicando migraciones..."
if ! npx prisma migrate deploy; then
  echo "❌ migrate deploy falló. No se reinicia la base: eso borraría personas, empresas y seguimientos."
  exit 1
else
  USERS=$(node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.count().then((n)=>{console.log(n)}).finally(()=>p.\$disconnect())")
  if [ "$USERS" = "0" ]; then
    echo "🌱 Base vacía: ejecutando seeds..."
    npm run prisma:seed
  else
    echo "🌱 Seed omitido: la base ya tiene datos y un reinicio no debe borrar seguimientos."
  fi
fi

echo "🚀 Iniciando servidor de desarrollo..."
npm run dev
