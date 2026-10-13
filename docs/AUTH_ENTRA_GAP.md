# Integración S2S CRM ↔ ENTRA-userAPI

## Estado actual (implementado)

| Capacidad | Estado |
|-----------|--------|
| `sessionRef` + `sessionAbsoluteExpiresAt` en `POST /api/auth/exchange` | ENTRA + CRM |
| `POST /api/auth/introspect` (sin renovar idle) | ENTRA + CRM (`protect` / `refresh`) |
| Caché positiva de introspección | CRM (`ENTRA_INTROSPECT_CACHE_TTL_MS`, default 45s) |
| Webhook `session.revoked` | ENTRA (`SESSION_REVOKE_HOOKS`) → CRM (`POST /auth/entra-revoke`) |
| Sesiones locales revocables (`sid`) | CRM |

## Ventana residual

- **Con introspección y sin caché:** ~0 (cada request consulta ENTRA).
- **Con caché positiva:** máximo `ENTRA_INTROSPECT_CACHE_TTL_MS` (p. ej. 45s) si no llega el webhook.
- **Con webhook:** revocación casi inmediata; la caché se invalida al recibir el evento.

Si ENTRA no está disponible (`503` / red): el CRM responde **503** y **no** autoriza (fail-closed).

## Variables CRM

```
ENTRA_API_BASE_URL=http://localhost:8080
EMPRENDEDORES_CLIENT_ID=XXXXXXXXXX
EMPRENDEDORES_APP_SECRET=XXXXXXXXXX
ENTRA_REQUIRE_INTROSPECT=true
ENTRA_INTROSPECT_CACHE_TTL_MS=45000
ENTRA_REVOKE_WEBHOOK_SECRET=XXXXXXXXXX
```

## Variables ENTRA

```
SESSION_REVOKE_HOOKS=00000000-0000-4000-8000-000000000004=http://host.docker.internal:4000/api/v1/auth/entra-revoke
SESSION_REVOKE_HOOK_SECRET=XXXXXXXXXX
```

El secreto debe coincidir en ambos lados. Cabecera: `X-Ampyme-Signature: sha256=<hmac-hex>`.

## Notas

- `sessionRef` es el hash SHA-256 del id de cookie; **no** es la cookie HttpOnly.
- No se comparte Redis entre aplicaciones.
- Sesiones CRM creadas antes de este cambio (sin `entra_session_ref`) exigen nuevo login.
