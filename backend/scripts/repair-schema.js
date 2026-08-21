/**
 * Delegado: la lógica vive en prisma/repair-schema.js (única fuente de verdad).
 * El entrypoint de producción prefiere prisma/; este archivo es el fallback.
 */
require('../prisma/repair-schema.js');
