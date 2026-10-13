/**
 * Validación del JSON jerárquico CINU 4.1 (sin base de datos).
 */
import fs from 'fs';
import path from 'path';
import { prepareCinuImport, incompleteNameWarnings } from '../cinu-catalog';

const JSON_PATH = path.join(__dirname, '../../../../prisma/data/cinu_4_1_jerarquico.json');

describe('prepareCinuImport', () => {
  it('rechaza JSON sin categorías', () => {
    const prepared = prepareCinuImport({});
    expect(prepared.counts.errors).toBeGreaterThan(0);
    expect(prepared.categories).toHaveLength(0);
  });

  it('detecta códigos duplicados', () => {
    const prepared = prepareCinuImport({
      fuente: 'test',
      categorias: [
        {
          codigo: 'A',
          nombre: 'Cat A',
          divisiones: [
            {
              codigo: '01',
              nombre: 'Div 01',
              grupos: [
                {
                  codigo: '011',
                  nombre: 'Grp',
                  clases: [
                    { codigo: '0111', nombre: 'Clase 1' },
                    { codigo: '0111', nombre: 'Clase duplicada' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(prepared.counts.errors).toBeGreaterThan(0);
    expect(prepared.counts.classes).toBe(1);
  });

  it('exige prefijo padre-hijo', () => {
    const prepared = prepareCinuImport({
      categorias: [
        {
          codigo: 'A',
          nombre: 'Cat',
          divisiones: [
            {
              codigo: '01',
              nombre: 'Div',
              grupos: [
                {
                  codigo: '021',
                  nombre: 'Grupo incorrecto',
                  clases: [],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(prepared.issues.some((i) => i.message.includes('no pertenece'))).toBe(true);
  });

  it('carga el catálogo oficial completo con jerarquía de 5 niveles', () => {
    if (!fs.existsSync(JSON_PATH)) {
      console.warn('Omitido: no está el JSON CINU en prisma/data');
      return;
    }
    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    const prepared = prepareCinuImport(raw);

    expect(prepared.versionCode).toBe('CINU-4.1');
    expect(prepared.counts.categories).toBeGreaterThan(10);
    expect(prepared.counts.divisions).toBeGreaterThan(50);
    expect(prepared.counts.groups).toBeGreaterThan(100);
    expect(prepared.counts.classes).toBeGreaterThan(200);
    expect(prepared.counts.errors).toBe(0);

    const withSubclass = prepared.categories
      .flatMap((c) => c.divisions)
      .flatMap((d) => d.groups)
      .flatMap((g) => g.classes)
      .find((cl) => cl.subclasses.length > 0);
    expect(withSubclass).toBeDefined();
    expect(withSubclass!.subclasses[0].code).toHaveLength(5);
  });

  it('reporta advertencias de texto incompleto sin alterar el nombre', () => {
    const warnings = incompleteNameWarnings(
      'categoria',
      'T',
      'ACTIVIDADES DE',
      'categoria T'
    );
    expect(warnings.some((w) => w.severity === 'warning')).toBe(true);
    expect(warnings[0].nombre).toBe('ACTIVIDADES DE');
  });
});
