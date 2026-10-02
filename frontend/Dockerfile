# syntax=docker/dockerfile:1
#
# PRODUCCIÓN — frontend Emprendedores
# Contexto = carpeta frontend/
#
#   cd frontend && docker build -t emprendedores-frontend:v1.1.0 .
#
# Las URLs salen de frontend/.env (NO van hardcodeadas aquí):
#   NEXT_PUBLIC_API_URL=http://10.14.80.245/api/v1
#   NEXT_PUBLIC_WS_URL=ws://10.14.80.245/ws/intake
#   NEXT_PUBLIC_INTAKE_FORM_URL=
#   API_PROXY_TARGET=...   (opcional; por defecto = NEXT_PUBLIC_API_URL)
#
# En runtime Dokploy puede volver a pasar esas vars; el entrypoint reescribe el JS.
# El navegador llama siempre a /backend-api (same-origin → sin CORS).

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
  && npm cache clean --force

COPY tsconfig.json next.config.js next-env.d.ts ./
COPY postcss.config.js tailwind.config.ts ./
COPY public ./public
COPY src ./src
COPY scripts/docker-build.sh ./scripts/docker-build.sh
COPY .env ./.env

RUN chmod +x ./scripts/docker-build.sh \
  && ./scripts/docker-build.sh

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/.bake-env ./.bake-env
COPY --chown=nextjs:nodejs scripts/prod-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
