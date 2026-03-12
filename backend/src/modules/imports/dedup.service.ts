/**
 * Servicio de deduplicacion.
 * Busca entidades existentes que coincidan con una fila de staging.
 *
 * Estrategias (en orden de confianza):
 * 1. Cedula exacta       → score 1.0  (DUPLICATE_EXACT)
 * 2. RUC exacto          → score 1.0  (DUPLICATE_EXACT)
 * 3. Email exacto        → score 0.85 (DUPLICATE_POSSIBLE)
 * 4. Telefono exacto     → score 0.75 (DUPLICATE_POSSIBLE)
 * 5. Nombre fuzzy        → score 0.6  (DUPLICATE_POSSIBLE)
 *
 * Nunca se hace merge automatico agresivo: toda coincidencia se marca
 * para revision humana (excepto cedula/RUC exacto).
 */
import { prisma } from '../../config/database';
import { ExtractedFields, DeduplicationMatch, DeduplicationResult } from './import.types';
import { normalizeText } from '../../shared/utils/string.utils';
import { logger } from '../../shared/logger/logger';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Calcula similitud simple entre dos strings (Dice coefficient).
 * Retorna 0–1 donde 1 = identicos.
 */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const na = normalizeText(a);
  const nb = normalizeText(b);

  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  // Bigrams
  const bigramsA = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) {
    bigramsA.add(na.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < nb.length - 1; i++) {
    bigramsB.add(nb.substring(i, i + 2));
  }

  let intersection = 0;
  bigramsA.forEach((bg) => {
    if (bigramsB.has(bg)) intersection++;
  });

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// ── Busquedas individuales ───────────────────────────────────────

async function findByCedula(cedula: string): Promise<DeduplicationMatch[]> {
  if (!cedula) return [];

  const persons = await prisma.person.findMany({
    where: { cedula },
    include: {
      entity: {
        select: { id: true, displayName: true, entityType: true, status: true },
      },
    },
  });

  return persons.map((p) => ({
    entityId: p.entity.id,
    displayName: p.entity.displayName,
    entityType: p.entity.entityType,
    score: 1.0,
    reason: `cedula_exacta: ${cedula}`,
  }));
}

async function findByRuc(ruc: string): Promise<DeduplicationMatch[]> {
  if (!ruc) return [];

  const companies = await prisma.company.findMany({
    where: { ruc },
    include: {
      entity: {
        select: { id: true, displayName: true, entityType: true, status: true },
      },
    },
  });

  return companies.map((c) => ({
    entityId: c.entity.id,
    displayName: c.entity.displayName,
    entityType: c.entity.entityType,
    score: 1.0,
    reason: `ruc_exacto: ${ruc}`,
  }));
}

async function findByEmail(email: string): Promise<DeduplicationMatch[]> {
  if (!email) return [];

  const contacts = await prisma.entityContact.findMany({
    where: {
      contactType: 'EMAIL',
      contactValue: { equals: email, mode: 'insensitive' },
    },
    include: {
      entity: {
        select: { id: true, displayName: true, entityType: true, status: true },
      },
    },
  });

  return contacts.map((c) => ({
    entityId: c.entity.id,
    displayName: c.entity.displayName,
    entityType: c.entity.entityType,
    score: 0.85,
    reason: `email_exacto: ${email}`,
  }));
}

async function findByPhone(phone: string): Promise<DeduplicationMatch[]> {
  if (!phone || phone.length < 7) return [];

  const contacts = await prisma.entityContact.findMany({
    where: {
      contactType: { in: ['PHONE', 'MOBILE', 'WHATSAPP'] },
      contactValue: { contains: phone },
    },
    include: {
      entity: {
        select: { id: true, displayName: true, entityType: true, status: true },
      },
    },
  });

  return contacts.map((c) => ({
    entityId: c.entity.id,
    displayName: c.entity.displayName,
    entityType: c.entity.entityType,
    score: 0.75,
    reason: `telefono: ${phone}`,
  }));
}

async function findByName(
  firstName: string,
  lastName: string
): Promise<DeduplicationMatch[]> {
  if (!firstName || !lastName) return [];

  // Busqueda por nombre + apellido (case insensitive, contains)
  const persons = await prisma.person.findMany({
    where: {
      AND: [
        { firstName: { contains: firstName, mode: 'insensitive' } },
        { lastName: { contains: lastName, mode: 'insensitive' } },
      ],
    },
    include: {
      entity: {
        select: { id: true, displayName: true, entityType: true, status: true },
      },
    },
    take: 10, // Limitar resultados para fuzzy matching
  });

  return persons
    .map((p) => {
      const fullNameDb = `${p.firstName} ${p.lastName}`;
      const fullNameRow = `${firstName} ${lastName}`;
      const score = stringSimilarity(fullNameDb, fullNameRow);

      return {
        entityId: p.entity.id,
        displayName: p.entity.displayName,
        entityType: p.entity.entityType,
        score: Math.round(score * 100) / 100,
        reason: `nombre_similar: "${fullNameDb}" ~ "${fullNameRow}"`,
      };
    })
    .filter((m) => m.score >= 0.6); // Solo matches con score >= 0.6
}

// ── Servicio principal ───────────────────────────────────────────

/**
 * Ejecuta todas las estrategias de deduplicacion para una fila de staging.
 * Retorna el mejor match encontrado y todos los candidatos.
 */
export async function deduplicateRow(
  rowId: string,
  fields: ExtractedFields
): Promise<DeduplicationResult> {
  const allMatches: DeduplicationMatch[] = [];
  const seenEntityIds = new Set<string>();

  // 1. Cedula exacta (maxima prioridad)
  if (fields.extractedCedula) {
    const matches = await findByCedula(fields.extractedCedula);
    for (const m of matches) {
      if (!seenEntityIds.has(m.entityId)) {
        allMatches.push(m);
        seenEntityIds.add(m.entityId);
      }
    }
  }

  // 2. RUC exacto
  if (fields.extractedRuc) {
    const matches = await findByRuc(fields.extractedRuc);
    for (const m of matches) {
      if (!seenEntityIds.has(m.entityId)) {
        allMatches.push(m);
        seenEntityIds.add(m.entityId);
      }
    }
  }

  // 3. Email exacto
  if (fields.extractedEmail) {
    const matches = await findByEmail(fields.extractedEmail);
    for (const m of matches) {
      if (!seenEntityIds.has(m.entityId)) {
        allMatches.push(m);
        seenEntityIds.add(m.entityId);
      }
    }
  }

  // 4. Telefono
  if (fields.extractedPhone) {
    const matches = await findByPhone(fields.extractedPhone);
    for (const m of matches) {
      if (!seenEntityIds.has(m.entityId)) {
        allMatches.push(m);
        seenEntityIds.add(m.entityId);
      }
    }
  }

  // 5. Nombre fuzzy (solo si no hay match exacto por identificador)
  if (allMatches.length === 0 && fields.extractedFirstName && fields.extractedLastName) {
    const matches = await findByName(fields.extractedFirstName, fields.extractedLastName);
    for (const m of matches) {
      if (!seenEntityIds.has(m.entityId)) {
        allMatches.push(m);
        seenEntityIds.add(m.entityId);
      }
    }
  }

  // Ordenar por score descendente
  allMatches.sort((a, b) => b.score - a.score);

  const bestMatch = allMatches.length > 0 ? allMatches[0] : null;

  logger.debug('Deduplicacion completada', {
    rowId,
    totalMatches: allMatches.length,
    bestScore: bestMatch?.score,
    bestReason: bestMatch?.reason,
  });

  return {
    rowId,
    matches: allMatches,
    bestMatch,
  };
}
