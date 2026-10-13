/**
 * Importación idempotente del catálogo CINU 4.1.
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/import-cinu-4-1.ts
 *   npx ts-node --transpile-only scripts/import-cinu-4-1.ts /ruta/al/cinu.json
 *
 * Escribe un reporte de validación (errores/advertencias) sin “corregir”
 * textos incompletos del JSON fuente.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/database';
import { economicActivitiesService } from '../src/modules/economic-activities/economic-activities.service';

async function main() {
  const file =
    process.argv[2] ||
    path.join(__dirname, '../prisma/data/cinu_4_1_jerarquico.json');

  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró el archivo CINU: ${file}`);
  }

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = await economicActivitiesService.importCatalog(raw);

  const reportPath = path.join(
    path.dirname(file),
    `cinu_4_1_validation_report_${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        fuente: result.prepared.source,
        version: result.prepared.versionCode,
        counts: result.prepared.counts,
        imported: result.imported,
        issues: result.prepared.issues,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('CINU 4.1 importado (idempotente)');
  console.log(`  Categorías:  ${result.imported.categories} (nuevas ${result.imported.inserted.categories}, actualizadas ${result.imported.updated.categories})`);
  console.log(`  Divisiones:  ${result.imported.divisions} (nuevas ${result.imported.inserted.divisions}, actualizadas ${result.imported.updated.divisions})`);
  console.log(`  Grupos:      ${result.imported.groups} (nuevas ${result.imported.inserted.groups}, actualizadas ${result.imported.updated.groups})`);
  console.log(`  Clases:      ${result.imported.classes} (nuevas ${result.imported.inserted.classes}, actualizadas ${result.imported.updated.classes})`);
  console.log(`  Subclases:   ${result.imported.subclasses} (nuevas ${result.imported.inserted.subclasses}, actualizadas ${result.imported.updated.subclasses})`);
  console.log(`  Errores de validación:     ${result.prepared.counts.errors}`);
  console.log(`  Advertencias (texto):      ${result.prepared.counts.warnings}`);
  console.log(`  Reporte: ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
