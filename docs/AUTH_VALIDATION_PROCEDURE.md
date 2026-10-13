# Procedimiento de validación de integración auth

Leyenda:

- **Local**: puede validarse solo con el CRM (sesión `sid`).
- **Central**: requiere ENTRA con `sessionRef` + `/api/auth/introspect` (+ webhook opcional).

| # | Caso | Tipo | Cómo validar | Resultado esperado |
|---|------|------|--------------|--------------------|
| 1 | Sesión central expirada + access CRM vigente | Central | Revocar cookie ENTRA; API CRM con Bearer tras TTL caché | `401` (introspect inactive) o antes si llega webhook |
| 2 | Sesión central revocada + refresh | Central | Logout ENTRA + `POST /auth/refresh` | `401` / `503` fail-closed |
| 3 | Logout + reutilizar tokens | Local | `POST /auth/logout` luego profile/refresh con copias | `401` |
| 4 | Reutilizar refresh consumido | Local | Dos refresh con el mismo token | Segundo → `401` + familia revocada |
| 5 | Refresh más allá de absolute | Local | Forzar `absolute_expires_at` pasado | `401` |
| 6 | ENTRA caído tras login | Local UX | Parar ENTRA; recargar CRM | `status=error`, sin datos privados, sin refresh |
| 7 | Logout central CSRF/red | Local UX | Forzar fallo CSRF | Limpieza local + aviso `centralLogoutWarning` |
| 8 | Logout con refresh pendiente | Local | Logout durante 401 refresh | Época invalida respuesta tardía |
| 9 | Multi-pestaña | Local UX | Logout en A | B recibe BroadcastChannel → login |
| 10 | WS abierto al revocar | Local | Logout CRM con WS intake | Cierre `4001` |
| 11 | Rol viewer + JWT viejo | Local | Cambiar rol BD a VIEWER; mutación | `403` (authorize lee BD) |
| 12 | Cuenta desactivada | Local | `is_active=false` | `403` / sesiones revocadas |
| 13 | Pestaña inactiva | Local UX | Sin poll 60s; cooldown 60s en recheck | `/me` no en bucle |
| 14 | Bypass frontend | Local | curl Bearer directo | Solo controles backend (sid + rol BD) |

## Tests automatizados disponibles

```bash
cd backend && npx jest src/modules/auth/__tests__/auth-session-crypto.test.ts
```

Tras aplicar migración `20261013160000_crm_auth_sessions`:

```bash
npx prisma migrate deploy
```

Pruebas de rotación/reuso requieren BD con funciones `api.fn_rotate_crm_refresh` (integración manual o e2e).
