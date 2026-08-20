# syntax=docker/dockerfile:1
#
# Dokploy clona el repo completo: el contexto de build es la RAÍZ,
# no la carpeta backend/. Por eso los COPY van con el prefijo backend/.
#
# En Dokploy:
#   Docker File: backend/Dockerfile
#   Docker Context Path: .          (raíz del git, NO "backend")
#   Docker Build Stage: runner
#   Root Directory / Base Path: vacío (no pongas "backend")

FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src

# prisma generate lee DATABASE_URL del schema; no se conecta a PostgreSQL
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/emprendedores_db?schema=public"
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/scripts/prod-entrypoint.sh ./scripts/prod-entrypoint.sh
RUN chmod +x ./scripts/prod-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./scripts/prod-entrypoint.sh"]
