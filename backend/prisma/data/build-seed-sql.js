const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'division_politica_panama.json');
const outPath = path.join(__dirname, 'seed_division_politica.sql');
const tree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const lines = [];
lines.push('-- Catálogo división política de Panamá (códigos oficiales)');
lines.push('TRUNCATE TABLE "corregimientos", "distritos", "provincias" CASCADE;');
lines.push('');
lines.push('INSERT INTO "provincias" ("codProv", "nombre") VALUES');

const provs = [];
for (const [cod, p] of Object.entries(tree)) {
  provs.push(`  ('${cod}', '${esc(p.nombre)}')`);
}
lines.push(provs.join(',\n') + ';');
lines.push('');
lines.push('INSERT INTO "distritos" ("codDist", "nombre", "codProv") VALUES');

const dists = [];
for (const [codProv, p] of Object.entries(tree)) {
  for (const [codDist, d] of Object.entries(p.distritos || {})) {
    dists.push(`  ('${codDist}', '${esc(d.nombre)}', '${codProv}')`);
  }
}
lines.push(dists.join(',\n') + ';');
lines.push('');
lines.push('INSERT INTO "corregimientos" ("codCorr", "nombre", "codDist") VALUES');

const corrs = [];
for (const p of Object.values(tree)) {
  for (const [codDist, d] of Object.entries(p.distritos || {})) {
    for (const [codCorr, nombre] of Object.entries(d.corregimientos || {})) {
      corrs.push(`  ('${codCorr}', '${esc(nombre)}', '${codDist}')`);
    }
  }
}
lines.push(corrs.join(',\n') + ';');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'));
console.log(
  JSON.stringify({
    provincias: provs.length,
    distritos: dists.length,
    corregimientos: corrs.length,
    out: outPath,
  })
);
