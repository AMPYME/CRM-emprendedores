# syntax=docker/dockerfile:1
#
# Contexto de build = este directorio (backend/), no la raíz del repo.
# Dokploy:
#   Docker File: Dockerfile
#   Docker Context Path: .
#   Docker Build Stage: runner
#   Root Directory / Base Path: backend
# o bien:
#   Docker File: backend/Dockerfile
#   Docker Context Path: backend
#   Docker Build Stage: runner

FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

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

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
