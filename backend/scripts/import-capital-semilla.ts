/**
 * Carga el CSV de capital semilla. Conserva cédula y el resto de datos,
 * sin nombre ni apellido. Se puede ejecutar de nuevo: reemplaza la tabla.
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function cedulaKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function text(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return raw || null;
}

function amount(value: unknown): Prisma.Decimal | null {
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') && !raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Prisma.Decimal(parsed.toFixed(2));
}

async function main() {
  const file = process.argv[2]
    || path.join(__dirname, '../data/capital_semilla_migracion.csv');
  const csv = fs.readFileSync(file, 'utf8');
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  const data: Prisma.CapitalSemillaCreateManyInput[] = [];
  let skipped = 0;
  for (const row of rows) {
    const cedula = text(row['Cédula'] ?? row.Cedula);
    const key = cedula ? cedulaKey(cedula) : '';
    if (!cedula || !key) {
      skipped += 1;
      continue;
    }
    const externalRaw = text(row.ID);
    const externalId = externalRaw && /^\d+$/.test(externalRaw) ? Number(externalRaw) : null;
    data.push({
      externalId,
      cedula,
      cedulaKey: key,
      province: text(row.Provincia),
      businessName: text(row['Nombre del Negocio']),
      actaNumber: text(row['No. de Acta de Capital Semilla']),
      amount: amount(row['Monto de Capital Semilla']),
    });
  }

  await prisma.capitalSemilla.deleteMany();
  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    await prisma.capitalSemilla.createMany({ data: data.slice(i, i + batchSize) });
  }

  console.log(`Importados ${data.length} registros. Omitidos sin cédula: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
