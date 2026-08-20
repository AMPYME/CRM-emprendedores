/**
 * Repara una BD de producción con historial Prisma "OK" pero tablas/enums incompletos.
 * 1) Normaliza EntityType (quita ESTABLISHMENT → COMPANY)
 * 2) Aplica el SQL del baseline ignorando "already exists"
 * 3) Aplica sync de UserRole
 *
 * Uso (en contenedor):
 *   node prisma/repair-schema.js
 *   node scripts/repair-schema.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Carpeta prisma/ tanto si el script vive en prisma/ o en scripts/ */
function resolvePrismaRoot() {
  const candidates = [
    path.join(__dirname), // prisma/repair-schema.js
    path.join(__dirname, '../prisma'), // scripts/repair-schema.js
    path.join(process.cwd(), 'prisma'),
  ];
  for (const dir of candidates) {
    const marker = path.join(dir, 'schema.prisma');
    if (fs.existsSync(marker)) return dir;
  }
  throw new Error('No se encontró prisma/schema.prisma');
}

const PRISMA_ROOT = resolvePrismaRoot();

async function tableExists(name) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Nombre de tabla inválido: ${name}`);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}' LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function enumHasLabel(typeName, label) {
  if (!/^[A-Za-z0-9_]+$/.test(typeName) || !/^[A-Za-z0-9_]+$/.test(label)) {
    throw new Error('Enum/label inválido');
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = '${typeName}' AND e.enumlabel = '${label}'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

function isIgnorableError(err) {
  const msg = String(err?.message || err);
  return (
    /already exists/i.test(msg) ||
    /duplicate key/i.test(msg) ||
    /42710/.test(msg) ||
    /42P07/.test(msg) ||
    /42701/.test(msg)
  );
}

async function normalizeEntityType() {
  if (!(await enumHasLabel('EntityType', 'ESTABLISHMENT'))) {
    console.log('✓ EntityType ya sin ESTABLISHMENT');
    return;
  }

  console.log('→ Normalizando EntityType (ESTABLISHMENT → COMPANY)...');
  const tables = ['entities', 'intake_sessions', 'intake_entities', 'verification_items'];

  for (const table of tables) {
    if (!(await tableExists(table))) continue;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "entity_type" DROP DEFAULT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "entity_type" TYPE TEXT USING "entity_type"::text`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "entity_type" = 'COMPANY' WHERE "entity_type" = 'ESTABLISHMENT'`
    );
  }

  await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "EntityType_new"`);
  await prisma.$executeRawUnsafe(
    `CREATE TYPE "EntityType_new" AS ENUM ('PERSON', 'COMPANY')`
  );

  for (const table of tables) {
    if (!(await tableExists(table))) continue;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "entity_type" TYPE "EntityType_new" USING "entity_type"::"EntityType_new"`
    );
  }

  await prisma.$executeRawUnsafe(`DROP TYPE "EntityType"`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "EntityType_new" RENAME TO "EntityType"`);

  for (const table of ['intake_sessions', 'intake_entities']) {
    if (!(await tableExists(table))) continue;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "entity_type" SET DEFAULT 'PERSON'::"EntityType"`
    );
  }

  console.log('✓ EntityType normalizado');
}

function splitSqlStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function applySqlFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  No existe ${filePath}, se omite (${label})`);
    return;
  }
  console.log(`→ Aplicando ${label}`);
  const sql = fs.readFileSync(filePath, 'utf8');

  if (/DO\s+\$\$/i.test(sql)) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✓ ${label}: aplicado (archivo completo)`);
    } catch (err) {
      if (isIgnorableError(err)) {
        console.log(`✓ ${label}: ya aplicado / sin cambios`);
      } else {
        console.warn(`  ⚠️  ${label}: ${String(err.message || err).slice(0, 300)}`);
        throw err;
      }
    }
    return;
  }

  const statements = splitSqlStatements(sql);
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      ok += 1;
    } catch (err) {
      if (isIgnorableError(err)) {
        skipped += 1;
      } else {
        failed += 1;
        console.warn(`  ⚠️  SQL: ${String(err.message || err).slice(0, 200)}`);
      }
    }
  }

  console.log(`✓ ${label}: ${ok} ok, ${skipped} ya existían, ${failed} avisos`);
}

async function main() {
  console.log('🔧 Reparando esquema de producción...');
  console.log(`   prisma root: ${PRISMA_ROOT}`);
  await normalizeEntityType();

  const baseline = path.join(
    PRISMA_ROOT,
    'migrations/20260820140000_baseline/migration.sql'
  );
  const roles = path.join(
    PRISMA_ROOT,
    'migrations/20260820150000_sync_crm_user_roles/migration.sql'
  );

  await applySqlFile(baseline, 'baseline');
  await applySqlFile(roles, 'roles');

  const critical = [
    'users',
    'audit_logs',
    'entities',
    'persons',
    'companies',
    'verification_items',
  ];
  const missing = [];
  for (const t of critical) {
    if (!(await tableExists(t))) missing.push(t);
  }

  if (missing.length) {
    console.error('❌ Siguen faltando tablas:', missing.join(', '));
    process.exit(1);
  }

  console.log('✅ Esquema reparado (tablas críticas presentes)');
}

main()
  .catch((err) => {
    console.error('❌ repair-schema falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  });
