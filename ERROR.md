# Informe de error - Login 500 por Prisma/OpenSSL

## Resumen ejecutivo

El `POST /api/v1/auth/login` devuelve `500` porque Prisma no puede inicializar su query engine dentro del contenedor backend.  
La falla no ocurre en la consulta de negocio (`findUnique`) sino antes, al cargar la libreria nativa de Prisma.

## Evidencia

- Backend log:
  - `Unable to require(/app/node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node)`
  - `Prisma cannot find the required libssl system library`
  - `Details: libssl.so.1.1: cannot open shared object file`
- Frontend solo refleja el error backend como `500 Internal Server Error` al hacer login.

## Posibles causas (ordenadas por probabilidad)

1. **Deteccion incorrecta del target de Prisma en runtime**
   - Prisma genero engine para `debian-openssl-1.1.x` en lugar de OpenSSL 3.
   - Esto pasa cuando el contenedor no detecta correctamente OpenSSL durante `prisma generate`.

2. **Dependencia del sistema faltante en el contenedor**
   - El contenedor backend no garantizaba instalacion explicita de `openssl`.
   - Sin OpenSSL accesible, Prisma puede caer en target no compatible.

3. **Artefactos persistidos en volumen (`backend_node_modules`)**
   - Si se reutiliza `node_modules` viejo, puede quedar engine binario incompatible con la imagen actual.

## Correccion aplicada

1. **Se fijo el target de Prisma a OpenSSL 3**
   - Archivo: `backend/prisma/schema.prisma`
   - Cambio:
     - `binaryTargets = ["native", "debian-openssl-3.0.x"]`

2. **Se creo una imagen de desarrollo del backend con OpenSSL instalado**
   - Archivo: `backend/Dockerfile.dev`
   - Base: `node:20-bookworm-slim`
   - Instala: `openssl` y `ca-certificates`

3. **Compose del backend ahora usa build local**
   - Archivo: `docker-compose.dev.yml`
   - Cambio:
     - de `image: node:20-bookworm-slim`
     - a `build: { context: ./backend, dockerfile: Dockerfile.dev }`

## Por que esto corrige el login

Al tener OpenSSL presente y forzar `debian-openssl-3.0.x`, Prisma genera/carga un engine compatible con la base Debian actual.  
Una vez Prisma inicializa correctamente, `auth.repository.findByEmail()` vuelve a ejecutar la consulta normal y el endpoint de login deja de caer por error de infraestructura.

## Pasos para aplicar en tu entorno

Desde `CRM-EMPRENDEDORES`:

```bash
docker compose -f docker-compose.dev.yml down -v --remove-orphans
docker compose -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.dev.yml up
```

## Verificacion esperada

- En logs backend no debe aparecer `libquery_engine-...openssl-1.1.x`.
- Login debe responder `200/401` segun credenciales, pero no `500` por Prisma initialization.
