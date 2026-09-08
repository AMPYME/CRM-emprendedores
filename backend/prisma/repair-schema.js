/**
 * Repara una BD de producción con historial Prisma "OK" pero tablas/enums/columnas incompletos.
 * 1) Normaliza EntityType (quita ESTABLISHMENT → COMPANY)
 * 2) Aplica el SQL del baseline ignorando "already exists"
 * 3) Aplica sync de UserRole
 * 4) Añade columnas del baseline que faltan en tablas ya existentes
 *    (p. ej. persons.has_artisan_card si el baseline se marcó applied sobre BD vieja)
 *
 * Uso (en contenedor):
 *   node prisma/repair-schema.js
 *   node scripts/repair-schema.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Identificadores PostgreSQL citados (p. ej. provincias."codProv"). */
const SQL_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSqlIdent(name, kind) {
  if (!SQL_IDENT_RE.test(name)) {
    throw new Error(`Nombre de ${kind} inválido: ${name}`);
  }
}

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
  assertSqlIdent(name, 'tabla');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}' LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(table, column) {
  assertSqlIdent(table, 'tabla');
  assertSqlIdent(column, 'columna');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Extrae columnas de cada CREATE TABLE del baseline (CREATE se omite si la tabla ya existe). */
function parseCreateTableColumns(sql) {
  const result = [];
  const tableRe = /CREATE TABLE\s+"([A-Za-z0-9_]+)"\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = tableRe.exec(sql))) {
    const table = match[1];
    const columns = [];
    for (const rawLine of match[2].split('\n')) {
      const line = rawLine.trim().replace(/,\s*$/, '');
      if (!line || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line)) continue;
      const col = line.match(/^"([A-Za-z0-9_]+)"\s+(.+)$/);
      if (!col) continue;
      columns.push({ name: col[1], ddl: col[2].trim() });
    }
    result.push({ table, columns });
  }
  return result;
}

function ddlForAddColumn(ddl) {
  let out = ddl.replace(/\bUNIQUE\b/gi, '').replace(/\s+/g, ' ').trim();
  if (/\bNOT NULL\b/i.test(out) && !/\bDEFAULT\b/i.test(out)) {
    out = out.replace(/\s+NOT NULL\b/i, '');
  }
  return out.trim();
}

/**
 * La BD de prod puede tener `persons` de un esquema viejo y el baseline marcado
 * como aplicado: CREATE TABLE se ignora y faltan columnas como has_artisan_card.
 */
async function ensureMissingColumnsFromBaseline() {
  const baseline = path.join(PRISMA_ROOT, 'migrations/20260820140000_baseline/migration.sql');
  if (!fs.existsSync(baseline)) {
    console.warn('⚠️  No hay baseline para sincronizar columnas');
    return;
  }

  console.log('→ Sincronizando columnas faltantes en tablas existentes');
  const tables = parseCreateTableColumns(fs.readFileSync(baseline, 'utf8'));
  let added = 0;
  let skipped = 0;

  for (const { table, columns } of tables) {
    if (!(await tableExists(table))) continue;
    for (const { name, ddl } of columns) {
      if (await columnExists(table, name)) {
        skipped += 1;
        continue;
      }
      const addDdl = ddlForAddColumn(ddl);
      if (!addDdl) continue;
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${addDdl}`
        );
        console.log(`  + ${table}.${name}`);
        added += 1;
      } catch (err) {
        console.warn(`  ⚠️  ${table}.${name}: ${String(err.message || err).slice(0, 200)}`);
      }
    }
  }

  const extras = [
    { table: 'persons', column: 'has_artisan_card', ddl: 'BOOLEAN' },
    { table: 'intake_persons', column: 'has_artisan_card', ddl: 'BOOLEAN' },
  ];
  for (const { table, column, ddl } of extras) {
    if (!(await tableExists(table))) continue;
    if (await columnExists(table, column)) continue;
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${ddl}`
      );
      console.log(`  + ${table}.${column}`);
      added += 1;
    } catch (err) {
      console.warn(`  ⚠️  ${table}.${column}: ${String(err.message || err).slice(0, 200)}`);
    }
  }

  console.log(`✓ columnas: ${added} añadidas, ${skipped} ya existían`);
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
  const personCols = path.join(
    PRISMA_ROOT,
    'migrations/20260821180000_add_missing_person_columns/migration.sql'
  );

  await applySqlFile(baseline, 'baseline');
  await applySqlFile(roles, 'roles');
  await applySqlFile(personCols, 'person-columns');
  await ensureMissingColumnsFromBaseline();

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

  const criticalColumns = [
    ['persons', 'has_artisan_card'],
    ['persons', 'cedula'],
    ['persons', 'first_name'],
  ];
  const missingCols = [];
  for (const [table, column] of criticalColumns) {
    if ((await tableExists(table)) && !(await columnExists(table, column))) {
      missingCols.push(`${table}.${column}`);
    }
  }
  if (missingCols.length) {
    console.error('❌ Siguen faltando columnas:', missingCols.join(', '));
    process.exit(1);
  }

  await seedDivisionPolitica();

  console.log('✅ Esquema reparado (tablas críticas presentes)');
}

async function seedDivisionPolitica() {
  if (!(await tableExists('provincias'))) return;
  const jsonPath = path.join(PRISMA_ROOT, 'data/division_politica_panama.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('⚠️  Falta prisma/data/division_politica_panama.json; no se siembra división política');
    return;
  }

  const tree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const expectedProv = Object.keys(tree).length;
  const current = await prisma.provincia.count();
  if (current >= expectedProv) {
    console.log(`✓ División política: ${current} provincias`);
    return;
  }

  console.log(`🌱 Sembrando división política (${current} → ${expectedProv} provincias)...`);
  let provCount = 0;
  let distCount = 0;
  let corrCount = 0;

  for (const [codProv, provincia] of Object.entries(tree)) {
    await prisma.provincia.upsert({
      where: { codProv },
      create: { codProv, nombre: provincia.nombre },
      update: { nombre: provincia.nombre },
    });
    provCount += 1;

    for (const [codDist, distrito] of Object.entries(provincia.distritos || {})) {
      await prisma.distrito.upsert({
        where: { codDist },
        create: { codDist, nombre: distrito.nombre, codProv },
        update: { nombre: distrito.nombre, codProv },
      });
      distCount += 1;

      for (const [codCorr, nombre] of Object.entries(distrito.corregimientos || {})) {
        await prisma.corregimiento.upsert({
          where: { codCorr },
          create: { codCorr, nombre, codDist },
          update: { nombre, codDist },
        });
        corrCount += 1;
      }
    }
  }

  console.log(
    `✓ División política sembrada: ${provCount} provincias, ${distCount} distritos, ${corrCount} corregimientos`
  );
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
