# syntax=docker/dockerfile:1
#
# Dokploy clona el repo completo: el contexto es la RAÍZ del git.
#
# En Dokploy:
#   Docker File: frontend/Dockerfile
#   Docker Context Path: .          (raíz del git, NO "frontend")
#   Docker Build Stage: runner
#   Root Directory / Base Path: vacío
#
# Build args (obligatorios en producción; Next los incrusta en el JS).
# Si el front se sirve por HTTPS, use https/wss (si no, el navegador bloquea mixed content):
#   NEXT_PUBLIC_API_URL=https://api-emprendedores.ampyme.local/api/v1
#   NEXT_PUBLIC_WS_URL=wss://api-emprendedores.ampyme.local/ws/intake
#   NEXT_PUBLIC_INTAKE_FORM_URL=https://emprendedores.ampyme.local/emprendedores/

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/tsconfig.json frontend/next.config.js frontend/next-env.d.ts ./
COPY frontend/postcss.config.js frontend/tailwind.config.ts ./
COPY frontend/public ./public
COPY frontend/src ./src

ARG NEXT_PUBLIC_API_URL=https://api-emprendedores.ampyme.local/api/v1
ARG NEXT_PUBLIC_WS_URL=wss://api-emprendedores.ampyme.local/ws/intake
ARG NEXT_PUBLIC_INTAKE_FORM_URL=https://emprendedores.ampyme.local/emprendedores/

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_INTAKE_FORM_URL=$NEXT_PUBLIC_INTAKE_FORM_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build \
  && test -d .next/standalone \
  || (echo "Falta .next/standalone. Revisa que next.config.js tenga output: 'standalone' y que ese archivo se haya copiado al build." && ls -la .next && cat next.config.js && exit 1)

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
