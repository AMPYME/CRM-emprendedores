/**
 * Seed de base de datos.
 * Crea catálogo de división política, usuarios iniciales y datos de ejemplo.
 */
import { EntityType, PrismaClient, RelationshipType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { isAllowedRelationshipPair } from '../src/modules/relationships/relationship.rules';

const prisma = new PrismaClient();

type SeedEntity = {
  id: string;
  entityType: EntityType;
  displayName: string;
};

/**
 * Crea relaciones de semilla usando la misma matriz que el backend.
 * Así el seed falla inmediatamente si se agrega un par no permitido.
 */
async function createSeedRelationship(
  fromEntity: SeedEntity,
  toEntity: SeedEntity,
  relationshipType: RelationshipType,
  role?: string
): Promise<void> {
  if (!isAllowedRelationshipPair(fromEntity.entityType, toEntity.entityType)) {
    throw new Error(
      `Relación seed no permitida: ${fromEntity.entityType} → ${toEntity.entityType}`
    );
  }

  await prisma.entityRelationship.create({
    data: {
      fromEntityId: fromEntity.id,
      toEntityId: toEntity.id,
      relationshipType,
      role,
      isActive: true,
    },
  });
}

/** Códigos de ubicación para entidades de ejemplo (catálogo oficial). */
const LOC = {
  PANAMA: '08',
  PANAMA_DIST: '0808',
  BETANIA: '080806',
  BELLA_VISTA: '080807',
  CHIRIQUI: '04',
  DAVID: '0406',
  DAVID_CORR: '040601',
  VERAGUAS: '09',
  SANTIAGO: '0910',
  SANTIAGO_CORR: '091001',
} as const;

type DivisionTree = Record<
  string,
  {
    nombre: string;
    distritos: Record<string, { nombre: string; corregimientos: Record<string, string> }>;
  }
>;

async function seedDivisionPolitica(client: PrismaClient = prisma): Promise<void> {
  const filePath = path.join(__dirname, 'data', 'division_politica_panama.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró ${filePath}`);
  }

  const tree = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DivisionTree;

  let provCount = 0;
  let distCount = 0;
  let corrCount = 0;

  for (const [codProv, provincia] of Object.entries(tree)) {
    await client.provincia.upsert({
      where: { codProv },
      create: { codProv, nombre: provincia.nombre },
      update: { nombre: provincia.nombre },
    });
    provCount += 1;

    for (const [codDist, distrito] of Object.entries(provincia.distritos || {})) {
      await client.distrito.upsert({
        where: { codDist },
        create: { codDist, nombre: distrito.nombre, codProv },
        update: { nombre: distrito.nombre, codProv },
      });
      distCount += 1;

      for (const [codCorr, nombre] of Object.entries(distrito.corregimientos || {})) {
        await client.corregimiento.upsert({
          where: { codCorr },
          create: { codCorr, nombre, codDist },
          update: { nombre, codDist },
        });
        corrCount += 1;
      }
    }
  }

  console.log(
    `  ✅ División política: ${provCount} provincias, ${distCount} distritos, ${corrCount} corregimientos`
  );
}

/** Slugs de eventos creados por este seed (para poder borrarlos al re-ejecutar). */
const SEED_EVENT_SLUGS = [
  'feria-del-emprendedor-2026',
  'capacitacion-marketing-digital',
  'cumbre-pyme-chiriqui-2026',
] as const;

/**
 * Elimina datos de ejecuciones previas del mismo seed (misma marca `sourceOrigin: 'SEED'`).
 * Permite correr `npm run prisma:seed` varias veces sin error de slug único ni duplicados.
 */
const SEED_PORTFOLIO_SUBJECTS = [
  'Solicitud de crédito para ampliación de taller',
  'Asesoría en buenas prácticas agrícolas',
  'Actualización de datos de RUC en sistema',
  'Programa de capacitación grupal pendiente',
  'Apoyo para registro de aviso de operación',
];

async function clearPreviousSeed(): Promise<void> {
  await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SELECT set_config('app.allow_physical_delete', 'on', true)`);
  await tx.portfolioAction.deleteMany({
    where: {
      portfolio: {
        subject: { in: SEED_PORTFOLIO_SUBJECTS },
        entity: { sourceOrigin: 'SEED' },
      },
    },
  });
  await tx.portfolioRecord.deleteMany({
    where: {
      subject: { in: SEED_PORTFOLIO_SUBJECTS },
      entity: { sourceOrigin: 'SEED' },
    },
  });
  await tx.eventRegistration.deleteMany({
    where: { entity: { sourceOrigin: 'SEED' } },
  });
  await tx.entityRelationship.deleteMany({
    where: {
      OR: [
        { fromEntity: { sourceOrigin: 'SEED' } },
        { toEntity: { sourceOrigin: 'SEED' } },
      ],
    },
  });
  await tx.entity.deleteMany({
    where: { sourceOrigin: 'SEED', portfolioRecords: { none: {} } },
  });
  await tx.event.deleteMany({ where: { slug: { in: [...SEED_EVENT_SLUGS] } } });
  }, { timeout: 120000 });
}

async function main() {
  console.log('🌱 Ejecutando seeds...\n');

  console.log('── División política ─────────────────────────────────');
  await seedDivisionPolitica(prisma);

  await clearPreviousSeed();

  // ── Usuarios (roles CRM actuales) ───────────────────────────────
  const adminHash = await bcrypt.hash('Admin2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ampyme.gob.pa' },
    update: {
      passwordHash: adminHash,
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: 'admin@ampyme.gob.pa',
      passwordHash: adminHash,
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`  ✅ Usuario admin: ${admin.email} (${admin.role})`);

  const emprendAdminHash = await bcrypt.hash('EmprendAdmin2026!', 12);
  const emprendAdmin = await prisma.user.upsert({
    where: { email: 'emprend.admin@ampyme.gob.pa' },
    update: {
      passwordHash: emprendAdminHash,
      firstName: 'Admin',
      lastName: 'Emprendedores',
      role: 'EMPREND_ADMIN',
      isActive: true,
    },
    create: {
      email: 'emprend.admin@ampyme.gob.pa',
      passwordHash: emprendAdminHash,
      firstName: 'Admin',
      lastName: 'Emprendedores',
      role: 'EMPREND_ADMIN',
      isActive: true,
    },
  });
  console.log(`  ✅ Usuario EMPREND_ADMIN: ${emprendAdmin.email}`);

  const operatorHash = await bcrypt.hash('Operador2026!', 12);
  const operator = await prisma.user.upsert({
    where: { email: 'operador@ampyme.gob.pa' },
    update: {
      passwordHash: operatorHash,
      firstName: 'Operador',
      lastName: 'Demo',
      role: 'EMPREND_OPERADOR',
      isActive: true,
    },
    create: {
      email: 'operador@ampyme.gob.pa',
      passwordHash: operatorHash,
      firstName: 'Operador',
      lastName: 'Demo',
      role: 'EMPREND_OPERADOR',
      isActive: true,
    },
  });
  console.log(`  ✅ Usuario operador: ${operator.email} (${operator.role})`);

  const viewerHash = await bcrypt.hash('Viewer2026!', 12);
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@ampyme.gob.pa' },
    update: {
      passwordHash: viewerHash,
      firstName: 'Consulta',
      lastName: 'Demo',
      role: 'EMPREND_VIEWER',
      isActive: true,
    },
    create: {
      email: 'viewer@ampyme.gob.pa',
      passwordHash: viewerHash,
      firstName: 'Consulta',
      lastName: 'Demo',
      role: 'EMPREND_VIEWER',
      isActive: true,
    },
  });
  console.log(`  ✅ Usuario viewer: ${viewer.email} (${viewer.role})`);

  // ── Persona 1 ───────────────────────────────────────────────────
  const person1 = await prisma.entity.create({
    data: {
      entityType: 'PERSON',
      status: 'ACTIVE',
      displayName: 'María González Rodríguez',
      province: LOC.PANAMA,
      district: LOC.PANAMA_DIST,
      corregimiento: LOC.BETANIA,
      sourceOrigin: 'SEED',
      person: {
        create: {
          firstName: 'María',
          lastName: 'González',
          secondLastName: 'Rodríguez',
          cedula: '8-900-1234',
          gender: 'FEMALE',
          nationalityCode: 'PAN',
          occupation: 'Emprendedora',
          businessName: 'Artesanías María',
          economicActivity: 'Artesanías y manualidades',
        },
      },
      contacts: {
        create: [
          { contactType: 'EMAIL', contactValue: 'maria.gonzalez@example.com', isPrimary: true },
          { contactType: 'MOBILE', contactValue: '6700-0001', isPrimary: true },
        ],
      },
    },
  });
  console.log(`  ✅ Persona: ${person1.displayName}`);

  // ── Persona 2 ───────────────────────────────────────────────────
  const person2 = await prisma.entity.create({
    data: {
      entityType: 'PERSON',
      status: 'ACTIVE',
      displayName: 'Carlos Mendoza',
      province: LOC.CHIRIQUI,
      district: LOC.DAVID,
      corregimiento: LOC.DAVID_CORR,
      sourceOrigin: 'SEED',
      person: {
        create: {
          firstName: 'Carlos',
          lastName: 'Mendoza',
          cedula: '4-200-5678',
          gender: 'MALE',
          occupation: 'Agricultor',
          businessName: 'Finca Mendoza',
          economicActivity: 'Agricultura',
        },
      },
      contacts: {
        create: [
          { contactType: 'MOBILE', contactValue: '6800-0002', isPrimary: true },
          { contactType: 'EMAIL', contactValue: 'carlos.mendoza@example.com', isPrimary: false },
        ],
      },
    },
  });
  console.log(`  ✅ Persona: ${person2.displayName}`);

  // ── Persona 3 (sin cédula — caso real) ──────────────────────────
  const person3 = await prisma.entity.create({
    data: {
      entityType: 'PERSON',
      status: 'ACTIVE',
      displayName: 'Ana Lucía Vega',
      province: LOC.VERAGUAS,
      district: LOC.SANTIAGO,
      corregimiento: LOC.SANTIAGO_CORR,
      sourceOrigin: 'SEED',
      person: {
        create: {
          firstName: 'Ana Lucía',
          lastName: 'Vega',
          gender: 'FEMALE',
          occupation: 'Costurera',
          businessName: 'Confecciones Vega',
          economicActivity: 'Confección de ropa',
        },
      },
      contacts: {
        create: [
          { contactType: 'WHATSAPP', contactValue: '6500-0003', isPrimary: true },
        ],
      },
    },
  });
  console.log(`  ✅ Persona: ${person3.displayName}`);

  // ── Empresa 1 ───────────────────────────────────────────────────
  const company1 = await prisma.entity.create({
    data: {
      entityType: 'COMPANY',
      status: 'ACTIVE',
      displayName: 'Innovación Digital S.A.',
      province: LOC.PANAMA,
      district: LOC.PANAMA_DIST,
      sourceOrigin: 'SEED',
      company: {
        create: {
          legalName: 'Innovación Digital S.A.',
          tradeName: 'InnovaDigital',
          ruc: '155600-1-12345',
          dv: '78',
          companyType: 'S.A.',
          economicActivity: 'Tecnología y desarrollo de software',
          employeeCount: 25,
        },
      },
      contacts: {
        create: [
          { contactType: 'EMAIL', contactValue: 'contacto@innovadigital.com.pa', isPrimary: true },
          { contactType: 'PHONE', contactValue: '300-0100', isPrimary: true },
          { contactType: 'WEBSITE', contactValue: 'https://innovadigital.com.pa' },
        ],
      },
    },
  });
  console.log(`  ✅ Empresa: ${company1.displayName}`);

  // ── Empresa 2 (S.R.L. sin RUC — caso real) ──────────────────────
  const company2 = await prisma.entity.create({
    data: {
      entityType: 'COMPANY',
      status: 'ACTIVE',
      displayName: 'Agroexport Chiriquí S.R.L.',
      province: LOC.CHIRIQUI,
      district: LOC.DAVID,
      corregimiento: LOC.DAVID_CORR,
      sourceOrigin: 'SEED',
      company: {
        create: {
          legalName: 'Agroexport Chiriquí S.R.L.',
          tradeName: 'AgroChiriquí',
          companyType: 'S. de R.L.',
          economicActivity: 'Comercialización agrícola',
          employeeCount: 50,
        },
      },
      contacts: {
        create: [
          { contactType: 'PHONE', contactValue: '770-0200', isPrimary: true },
        ],
      },
    },
  });
  console.log(`  ✅ Empresa: ${company2.displayName}`);

  // ── Relaciones entre entidades ─────────────────────────────────
  // persona↔persona, persona↔empresa, empresa↔empresa
  await createSeedRelationship(
    company1,
    person1,
    'EMPLOYEE',
    'Gerente de Proyectos'
  );
  console.log('  ✅ Relación: Innovación Digital → María González (Empleada)');

  await createSeedRelationship(person2, company2, 'OWNER', 'Dueño');
  console.log('  ✅ Relación: Carlos Mendoza → AgroChiriquí (Dueño)');

  await createSeedRelationship(person1, person3, 'RELATED', 'Referido / contacto');
  console.log('  ✅ Relación: María González → Ana Lucía Vega (Relacionada)');

  await createSeedRelationship(person3, company2, 'REPRESENTATIVE', 'Representante comercial');
  console.log('  ✅ Relación: Ana Lucía Vega → AgroChiriquí (Representante)');

  await createSeedRelationship(company2, company1, 'PARTNER', 'Alianza comercial');
  console.log('  ✅ Relación: AgroChiriquí → Innovación Digital (Socio)');

  // ── Eventos (FASE 5) ──────────────────────────────────────────────
  console.log('');

  const event1 = await prisma.event.create({
    data: {
      name: 'Feria del Emprendedor 2026',
      slug: 'feria-del-emprendedor-2026',
      description: 'Gran feria anual de emprendedores organizada por AMPYME en la Ciudad del Saber.',
      eventType: 'Feria',
      status: 'PUBLISHED',
      startDate: new Date('2026-06-15T08:00:00Z'),
      endDate: new Date('2026-06-17T18:00:00Z'),
      location: 'Ciudad del Saber, Clayton',
      province: 'Panamá',
      maxCapacity: 500,
      formFields: {
        standSize: { label: 'Tamaño del stand', type: 'select', options: ['Pequeño', 'Mediano', 'Grande'] },
        productCategory: { label: 'Categoría del producto', type: 'text' },
        needsElectricity: { label: '¿Necesita electricidad?', type: 'boolean' },
      },
    },
  });
  console.log(`  ✅ Evento: ${event1.name}`);

  const event2 = await prisma.event.create({
    data: {
      name: 'Capacitación en Marketing Digital',
      slug: 'capacitacion-marketing-digital',
      description: 'Taller práctico de marketing digital para emprendedores.',
      eventType: 'Capacitación',
      status: 'PUBLISHED',
      startDate: new Date('2026-04-20T09:00:00Z'),
      endDate: new Date('2026-04-20T16:00:00Z'),
      location: 'Centro AMPYME, El Dorado',
      province: 'Panamá',
      maxCapacity: 40,
      formFields: {
        businessType: { label: 'Tipo de negocio', type: 'text' },
        experienceLevel: { label: 'Nivel de experiencia', type: 'select', options: ['Ninguno', 'Básico', 'Intermedio'] },
      },
    },
  });
  console.log(`  ✅ Evento: ${event2.name}`);

  const event3 = await prisma.event.create({
    data: {
      name: 'Cumbre PYME Chiriquí 2026',
      slug: 'cumbre-pyme-chiriqui-2026',
      description: 'Cumbre regional de pequeñas y medianas empresas en Chiriquí.',
      eventType: 'Cumbre',
      status: 'DRAFT',
      startDate: new Date('2026-09-10T08:00:00Z'),
      endDate: new Date('2026-09-11T17:00:00Z'),
      location: 'Centro de Convenciones David',
      province: 'Chiriquí',
      maxCapacity: 200,
    },
  });
  console.log(`  ✅ Evento: ${event3.name}`);

  // ── Inscripciones a eventos ────────────────────────────────────────

  const reg1 = await prisma.eventRegistration.create({
    data: {
      eventId: event1.id,
      entityId: person1.id,
      status: 'CONFIRMED',
      confirmedAt: new Date('2026-05-20'),
      sourceOrigin: 'SEED',
      answers: {
        create: [
          { fieldKey: 'standSize', fieldLabel: 'Tamaño del stand', value: 'Mediano' },
          { fieldKey: 'productCategory', fieldLabel: 'Categoría del producto', value: 'Artesanías' },
          { fieldKey: 'needsElectricity', fieldLabel: '¿Necesita electricidad?', value: 'true' },
        ],
      },
    },
  });
  console.log(`  ✅ Inscripción: ${person1.displayName} → ${event1.name} (CONFIRMED)`);

  const reg2 = await prisma.eventRegistration.create({
    data: {
      eventId: event1.id,
      entityId: company1.id,
      status: 'REGISTERED',
      sourceOrigin: 'SEED',
      answers: {
        create: [
          { fieldKey: 'standSize', fieldLabel: 'Tamaño del stand', value: 'Grande' },
          { fieldKey: 'productCategory', fieldLabel: 'Categoría del producto', value: 'Tecnología' },
          { fieldKey: 'needsElectricity', fieldLabel: '¿Necesita electricidad?', value: 'true' },
        ],
      },
    },
  });
  console.log(`  ✅ Inscripción: ${company1.displayName} → ${event1.name} (REGISTERED)`);

  const reg3 = await prisma.eventRegistration.create({
    data: {
      eventId: event2.id,
      entityId: person1.id,
      status: 'ATTENDED',
      confirmedAt: new Date('2026-04-15'),
      attendedAt: new Date('2026-04-20'),
      sourceOrigin: 'SEED',
      answers: {
        create: [
          { fieldKey: 'businessType', fieldLabel: 'Tipo de negocio', value: 'Artesanías' },
          { fieldKey: 'experienceLevel', fieldLabel: 'Nivel de experiencia', value: 'Básico' },
        ],
      },
    },
  });
  console.log(`  ✅ Inscripción: ${person1.displayName} → ${event2.name} (ATTENDED)`);

  const reg4 = await prisma.eventRegistration.create({
    data: {
      eventId: event2.id,
      entityId: person2.id,
      status: 'CONFIRMED',
      confirmedAt: new Date('2026-04-18'),
      sourceOrigin: 'SEED',
      answers: {
        create: [
          { fieldKey: 'businessType', fieldLabel: 'Tipo de negocio', value: 'Agricultura' },
          { fieldKey: 'experienceLevel', fieldLabel: 'Nivel de experiencia', value: 'Ninguno' },
        ],
      },
    },
  });
  console.log(`  ✅ Inscripción: ${person2.displayName} → ${event2.name} (CONFIRMED)`);

  const reg5 = await prisma.eventRegistration.create({
    data: {
      eventId: event2.id,
      entityId: person3.id,
      status: 'NO_SHOW',
      sourceOrigin: 'SEED',
      answers: {
        create: [
          { fieldKey: 'businessType', fieldLabel: 'Tipo de negocio', value: 'Confección' },
          { fieldKey: 'experienceLevel', fieldLabel: 'Nivel de experiencia', value: 'Intermedio' },
        ],
      },
    },
  });
  console.log(`  ✅ Inscripción: ${person3.displayName} → ${event2.name} (NO_SHOW)`);

  // ── Cartera / Seguimiento (FASE 6) ─────────────────────────────────
  console.log('');

  // Caso 1: María necesita financiamiento — asignado al operador
  const portfolio1 = await prisma.portfolioRecord.create({
    data: {
      entityId: person1.id,
      assignedToId: operator.id,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'Financiamiento',
      subject: 'Solicitud de crédito para ampliación de taller',
      description: 'María solicita financiamiento para comprar equipo nuevo y ampliar su taller de artesanías.',
      nextFollowUpDate: new Date('2026-03-15T10:00:00Z'),
    },
  });
  console.log(`  ✅ Cartera: ${person1.displayName} — ${portfolio1.subject}`);

  // Acciones para caso de María
  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio1.id,
      performedById: operator.id,
      actionType: 'CALL',
      description: 'Llamada inicial para recopilar información sobre necesidades de financiamiento.',
      result: 'María indica que necesita $5,000 para comprar una máquina de corte láser.',
      nextSteps: 'Enviar formulario de solicitud por email.',
      actionDate: new Date('2026-03-05T10:00:00Z'),
    },
  });
  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio1.id,
      performedById: operator.id,
      actionType: 'EMAIL_ACTION',
      description: 'Envío de formulario de solicitud de crédito por correo electrónico.',
      result: 'Formulario enviado correctamente.',
      nextSteps: 'Esperar que María devuelva el formulario completado.',
      actionDate: new Date('2026-03-06T14:00:00Z'),
    },
  });
  console.log('    ✅ 2 acciones de seguimiento registradas');

  // Caso 2: Carlos — asistencia técnica, sin acciones aún (unmanaged)
  const portfolio2 = await prisma.portfolioRecord.create({
    data: {
      entityId: person2.id,
      status: 'NEW',
      priority: 'MEDIUM',
      category: 'Asistencia Técnica',
      subject: 'Asesoría en buenas prácticas agrícolas',
      description: 'Carlos quiere mejorar técnicas de cultivo para su finca.',
      nextFollowUpDate: new Date('2026-03-20T09:00:00Z'),
    },
  });
  console.log(`  ✅ Cartera: ${person2.displayName} — ${portfolio2.subject} (NEW, sin acciones)`);

  // Caso 3: Innovación Digital — caso ya resuelto
  const portfolio3 = await prisma.portfolioRecord.create({
    data: {
      entityId: company1.id,
      assignedToId: admin.id,
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'Registro Empresarial',
      subject: 'Actualización de datos de RUC en sistema',
      description: 'La empresa solicitó actualizar su RUC tras cambio de razón social.',
      closedAt: new Date('2026-02-28'),
      closedReason: 'Datos actualizados correctamente en el sistema.',
    },
  });
  console.log(`  ✅ Cartera: ${company1.displayName} — ${portfolio3.subject} (RESOLVED)`);

  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio3.id,
      performedById: admin.id,
      actionType: 'MEETING',
      description: 'Reunión con representante legal para verificar documentos.',
      result: 'Documentos verificados y actualizados.',
      actionDate: new Date('2026-02-25T11:00:00Z'),
    },
  });
  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio3.id,
      performedById: admin.id,
      actionType: 'STATUS_CHANGE',
      description: 'Caso resuelto tras actualización de datos.',
      result: 'Datos de RUC actualizados en el sistema.',
      actionDate: new Date('2026-02-28T15:00:00Z'),
    },
  });
  console.log('    ✅ 2 acciones de seguimiento registradas');

  // Caso 4: S.R.L. con seguimiento vencido (overdue)
  const portfolio4 = await prisma.portfolioRecord.create({
    data: {
      entityId: company2.id,
      assignedToId: operator.id,
      status: 'WAITING',
      priority: 'URGENT',
      category: 'Capacitación',
      subject: 'Programa de capacitación grupal pendiente',
      description:
        'La empresa solicitó capacitación en contabilidad para 15 colaboradores. Pendiente coordinar fecha.',
      nextFollowUpDate: new Date('2026-02-15T10:00:00Z'), // Vencido (en el pasado)
    },
  });
  console.log(`  ✅ Cartera: ${company2.displayName} — ${portfolio4.subject} (OVERDUE)`);

  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio4.id,
      performedById: operator.id,
      actionType: 'VISIT',
      description: 'Visita a la sede de AgroChiriquí para evaluar necesidades de capacitación.',
      result: 'Se identificó que 15 colaboradores necesitan formación en contabilidad básica.',
      nextSteps: 'Coordinar con facilitador y definir fecha.',
      actionDate: new Date('2026-02-10T09:00:00Z'),
    },
  });
  console.log('    ✅ 1 acción de seguimiento registrada');

  // Caso 5: Ana Lucía — caso próximo (upcoming)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const portfolio5 = await prisma.portfolioRecord.create({
    data: {
      entityId: person3.id,
      assignedToId: operator.id,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      category: 'Formalización',
      subject: 'Apoyo para registro de aviso de operación',
      description: 'Ana Lucía quiere formalizar su negocio de confecciones.',
      nextFollowUpDate: tomorrow,
    },
  });
  console.log(`  ✅ Cartera: ${person3.displayName} — ${portfolio5.subject} (UPCOMING)`);

  await prisma.portfolioAction.create({
    data: {
      portfolioId: portfolio5.id,
      performedById: operator.id,
      actionType: 'WHATSAPP',
      description: 'Mensaje de WhatsApp para coordinar documentos necesarios.',
      result: 'Ana confirma que tiene los documentos listos.',
      nextSteps: 'Agendar visita para completar el trámite.',
      actionDate: new Date(),
    },
  });
  console.log('    ✅ 1 acción de seguimiento registrada');

  console.log('\n✨ Seeds completados exitosamente');
  console.log('── Usuarios seed (datos de ejemplo; login solo vía Active Directory) ──');
  console.log('  admin@ampyme.gob.pa          (ADMIN)');
  console.log('  emprend.admin@ampyme.gob.pa  (EMPREND_ADMIN)');
  console.log('  operador@ampyme.gob.pa       (EMPREND_OPERADOR)');
  console.log('  viewer@ampyme.gob.pa         (EMPREND_VIEWER)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seeds:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
