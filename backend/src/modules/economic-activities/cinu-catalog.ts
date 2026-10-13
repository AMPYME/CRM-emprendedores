/**
 * Lectura y validación del JSON jerárquico CINU 4.1.
 * No inventa códigos ni descripciones: conserva el texto original
 * y separa errores estructurales de advertencias de texto incompleto.
 */

export const CINU_VERSION_CODE = 'CINU-4.1';

export type CinuLevel = 'categoria' | 'division' | 'grupo' | 'clase' | 'subclase';

export interface CinuIssue {
  severity: 'error' | 'warning';
  level: CinuLevel;
  code: string;
  path: string;
  message: string;
  nombre: string;
}

export interface CinuNode {
  level: CinuLevel;
  code: string;
  nombre: string;
  parentCode: string | null;
}

export interface CinuPreparedCatalog {
  versionCode: string;
  versionName: string;
  source: string;
  categories: Array<{
    code: string;
    nombre: string;
    divisions: Array<{
      code: string;
      nombre: string;
      groups: Array<{
        code: string;
        nombre: string;
        classes: Array<{
          code: string;
          nombre: string;
          subclasses: Array<{ code: string; nombre: string }>;
        }>;
      }>;
    }>;
  }>;
  issues: CinuIssue[];
  counts: {
    categories: number;
    divisions: number;
    groups: number;
    classes: number;
    subclasses: number;
    errors: number;
    warnings: number;
  };
}

const CODE_PATTERN: Record<CinuLevel, RegExp> = {
  categoria: /^[A-Z]$/,
  division: /^[0-9]{2}$/,
  grupo: /^[0-9]{3}$/,
  clase: /^[0-9]{4}$/,
  subclase: /^[0-9]{5}$/,
};

const DANGLING_ENDING = /\s(?:de|del|y|al|por|en|para|con|la|el|los|las|o)$/i;
const MID_CATEGORY = /^(MENOR|CALIDAD)\b/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** Advierte textos cortados. No los corrige. */
export function incompleteNameWarnings(level: CinuLevel, code: string, nombre: string, path: string): CinuIssue[] {
  const issues: CinuIssue[] = [];
  const trimmed = nombre.trim();
  if (!trimmed) return issues;

  const open = (trimmed.match(/\(/g) || []).length;
  const close = (trimmed.match(/\)/g) || []).length;
  if (open !== close) {
    issues.push({
      severity: 'warning',
      level,
      code,
      path,
      nombre: trimmed,
      message: 'El nombre tiene paréntesis sin cerrar. Se conserva el texto original.',
    });
  }
  if (/^[a-záéíóúñü]/.test(trimmed)) {
    issues.push({
      severity: 'warning',
      level,
      code,
      path,
      nombre: trimmed,
      message: 'El nombre parece iniciar a mitad de una palabra. Se conserva el texto original.',
    });
  }
  if (DANGLING_ENDING.test(trimmed)) {
    issues.push({
      severity: 'warning',
      level,
      code,
      path,
      nombre: trimmed,
      message: 'El nombre termina en una palabra inconclusa. Se conserva el texto original.',
    });
  }
  if (level === 'categoria' && MID_CATEGORY.test(trimmed)) {
    issues.push({
      severity: 'warning',
      level,
      code,
      path,
      nombre: trimmed,
      message: 'El nombre de la categoría parece truncado al inicio. Se conserva el texto original.',
    });
  }
  return issues;
}

function pushError(
  issues: CinuIssue[],
  level: CinuLevel,
  code: string,
  path: string,
  nombre: string,
  message: string
) {
  issues.push({ severity: 'error', level, code, path, nombre, message });
}

/**
 * Valida la jerarquía y arma el plan de importación.
 * Los nodos con error estructural se omiten. Las advertencias se importan igual.
 */
export function prepareCinuImport(raw: unknown): CinuPreparedCatalog {
  const root = asRecord(raw);
  const issues: CinuIssue[] = [];
  const source = textOf(root?.fuente).trim();
  const categoriesOut: CinuPreparedCatalog['categories'] = [];

  const seen = {
    categoria: new Set<string>(),
    division: new Set<string>(),
    grupo: new Set<string>(),
    clase: new Set<string>(),
    subclase: new Set<string>(),
  };

  if (!root || !Array.isArray(root.categorias)) {
    pushError(issues, 'categoria', '', 'categorias', '', 'El JSON no contiene el arreglo categorias');
  }

  for (const categoryRaw of asArray(root?.categorias)) {
    const category = asRecord(categoryRaw);
    const code = textOf(category?.codigo).trim();
    const nombre = textOf(category?.nombre);
    const path = `categoria ${code || '?'}`;
    if (!acceptNode(issues, seen, 'categoria', code, nombre, path, null)) continue;
    issues.push(...incompleteNameWarnings('categoria', code, nombre, path));

    const divisionsOut: CinuPreparedCatalog['categories'][number]['divisions'] = [];
    for (const divisionRaw of asArray(category?.divisiones)) {
      const division = asRecord(divisionRaw);
      const divisionCode = textOf(division?.codigo).trim();
      const divisionName = textOf(division?.nombre);
      const divisionPath = `${path} > division ${divisionCode || '?'}`;
      if (!acceptNode(issues, seen, 'division', divisionCode, divisionName, divisionPath, null)) continue;
      issues.push(...incompleteNameWarnings('division', divisionCode, divisionName, divisionPath));

      const groupsOut: CinuPreparedCatalog['categories'][number]['divisions'][number]['groups'] = [];
      for (const groupRaw of asArray(division?.grupos)) {
        const group = asRecord(groupRaw);
        const groupCode = textOf(group?.codigo).trim();
        const groupName = textOf(group?.nombre);
        const groupPath = `${divisionPath} > grupo ${groupCode || '?'}`;
        if (!acceptNode(issues, seen, 'grupo', groupCode, groupName, groupPath, divisionCode)) continue;
        issues.push(...incompleteNameWarnings('grupo', groupCode, groupName, groupPath));

        const classesOut: CinuPreparedCatalog['categories'][number]['divisions'][number]['groups'][number]['classes'] = [];
        for (const classRaw of asArray(group?.clases)) {
          const clase = asRecord(classRaw);
          const classCode = textOf(clase?.codigo).trim();
          const className = textOf(clase?.nombre);
          const classPath = `${groupPath} > clase ${classCode || '?'}`;
          if (!acceptNode(issues, seen, 'clase', classCode, className, classPath, groupCode)) continue;
          issues.push(...incompleteNameWarnings('clase', classCode, className, classPath));

          const subclassesOut: Array<{ code: string; nombre: string }> = [];
          for (const subclassRaw of asArray(clase?.subclases)) {
            const subclass = asRecord(subclassRaw);
            const subclassCode = textOf(subclass?.codigo).trim();
            const subclassName = textOf(subclass?.nombre);
            const subclassPath = `${classPath} > subclase ${subclassCode || '?'}`;
            if (!acceptNode(issues, seen, 'subclase', subclassCode, subclassName, subclassPath, classCode)) continue;
            issues.push(...incompleteNameWarnings('subclase', subclassCode, subclassName, subclassPath));
            subclassesOut.push({ code: subclassCode, nombre: subclassName });
          }
          classesOut.push({ code: classCode, nombre: className, subclasses: subclassesOut });
        }
        groupsOut.push({ code: groupCode, nombre: groupName, classes: classesOut });
      }
      divisionsOut.push({ code: divisionCode, nombre: divisionName, groups: groupsOut });
    }
    categoriesOut.push({ code, nombre, divisions: divisionsOut });
  }

  const counts = {
    categories: categoriesOut.length,
    divisions: categoriesOut.reduce((n, c) => n + c.divisions.length, 0),
    groups: categoriesOut.reduce((n, c) => n + c.divisions.reduce((m, d) => m + d.groups.length, 0), 0),
    classes: categoriesOut.reduce(
      (n, c) => n + c.divisions.reduce((m, d) => m + d.groups.reduce((k, g) => k + g.classes.length, 0), 0),
      0
    ),
    subclasses: categoriesOut.reduce(
      (n, c) =>
        n +
        c.divisions.reduce(
          (m, d) => m + d.groups.reduce((k, g) => k + g.classes.reduce((s, cl) => s + cl.subclasses.length, 0), 0),
          0
        ),
      0
    ),
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  };

  return {
    versionCode: CINU_VERSION_CODE,
    versionName: 'Clasificación Industrial Nacional Uniforme 4.1',
    source: source || 'CINU 4.1',
    categories: categoriesOut,
    issues,
    counts,
  };
}

function acceptNode(
  issues: CinuIssue[],
  seen: Record<CinuLevel, Set<string>>,
  level: CinuLevel,
  code: string,
  nombre: string,
  path: string,
  parentCode: string | null
): boolean {
  if (!code) {
    pushError(issues, level, code, path, nombre, 'Código vacío');
    return false;
  }
  if (!CODE_PATTERN[level].test(code)) {
    pushError(issues, level, code, path, nombre, `El código no cumple el formato de ${level}`);
    return false;
  }
  if (!nombre.trim()) {
    pushError(issues, level, code, path, nombre, 'Nombre vacío');
    return false;
  }
  if (parentCode && !code.startsWith(parentCode)) {
    pushError(
      issues,
      level,
      code,
      path,
      nombre,
      `El código ${code} no pertenece al código padre ${parentCode}`
    );
    return false;
  }
  if (seen[level].has(code)) {
    pushError(issues, level, code, path, nombre, `Código duplicado en ${level}: ${code}`);
    return false;
  }
  seen[level].add(code);
  return true;
}
