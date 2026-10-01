#!/bin/sh
set -e

echo "📦 Instalando dependencias del frontend..."
npm install

echo "🚀 Iniciando Next.js en 0.0.0.0:3000..."
exec npm run dev
