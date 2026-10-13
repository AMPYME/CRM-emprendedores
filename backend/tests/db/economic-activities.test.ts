/**
 * Pruebas de integridad y privilegios del módulo CINU / entity_economic_activities.
 * Requiere PostgreSQL con migraciones aplicadas y roles crm_api.
 */
import { Client } from 'pg';
import { randomUUID } from 'crypto';

const ADMIN_URL =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL?.replace('?schema=public', '') ||
  'postgresql://postgres:postgres@localhost:5432/emprendedores_db';

const hasDb = process.env.RUN_DB_TESTS === '1' || process.env.CI === 'true';

(hasDb ? describe : describe.skip)('CINU economic activities — DB', () => {
  let admin: Client;
  let entityId: string;
  let classId: string;
  let otherClassId: string;
  let subclassId: string | null = null;
  let wrongSubclassId: string | null = null;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();

    const version = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_version('CINU-4.1-TEST', 'CINU test', 'test')`
    );
    const versionId = version.rows[0].out_id as string;

    const cat = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_category($1, 'A', 'Agricultura test')`,
      [versionId]
    );
    const div = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_division($1, '01', 'Division test')`,
      [cat.rows[0].out_id]
    );
    const grp = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_group($1, '011', 'Grupo test')`,
      [div.rows[0].out_id]
    );
    const cls = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_class($1, '0111', 'Clase test')`,
      [grp.rows[0].out_id]
    );
    classId = cls.rows[0].out_id;

    const cls2 = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_class($1, '0112', 'Otra clase')`,
      [grp.rows[0].out_id]
    );
    otherClassId = cls2.rows[0].out_id;

    const sub = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_subclass($1, '01111', 'Subclase test')`,
      [classId]
    );
    subclassId = sub.rows[0].out_id;

    const subWrong = await admin.query(
      `SELECT * FROM api.fn_upsert_cinu_subclass($1, '01121', 'Subclase otra clase')`,
      [otherClassId]
    );
    wrongSubclassId = subWrong.rows[0].out_id;

    entityId = randomUUID();
    await admin.query(
      `INSERT INTO public.entities (id, entity_type, status, display_name, created_at, updated_at)
       VALUES ($1, 'PERSON', 'ACTIVE', 'Persona CINU test', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [entityId]
    );
  });

  afterAll(async () => {
    await admin.end();
  });

  it('crm_api no puede SELECT directo sobre entity_economic_activities', async () => {
    await expect(
      admin.query(
        `SET ROLE crm_api; SELECT id FROM public.entity_economic_activities LIMIT 1;`
      )
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('crm_api no puede SELECT directo sobre cinu_classes', async () => {
    await expect(
      admin.query(`SET ROLE crm_api; SELECT id FROM public.cinu_classes LIMIT 1;`)
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('rechaza clase inexistente', async () => {
    await expect(
      admin.query(
        `SELECT * FROM api.fn_assign_entity_economic_activity($1, $2, NULL, false, NULL)`,
        [entityId, randomUUID()]
      )
    ).rejects.toThrow(/inexistente|no encontrada/i);
  });

  it('rechaza subclase de otra clase', async () => {
    await expect(
      admin.query(
        `SELECT * FROM api.fn_assign_entity_economic_activity($1, $2, $3, false, NULL)`,
        [entityId, classId, wrongSubclassId]
      )
    ).rejects.toThrow(/no pertenece/i);
  });

  it('permite múltiples actividades y una sola principal', async () => {
    const a1 = await admin.query(
      `SELECT * FROM api.fn_assign_entity_economic_activity($1, $2, $3, true, NULL)`,
      [entityId, classId, subclassId]
    );
    expect(a1.rows[0].is_primary).toBe(true);

    const a2 = await admin.query(
      `SELECT * FROM api.fn_assign_entity_economic_activity($1, $2, NULL, true, NULL)`,
      [entityId, otherClassId]
    );
    expect(a2.rows[0].is_primary).toBe(true);

    const list = await admin.query(
      `SELECT * FROM api.fn_get_entity_economic_activities($1)`,
      [entityId]
    );
    expect(list.rows.length).toBeGreaterThanOrEqual(2);
    expect(list.rows.filter((r: { is_primary: boolean }) => r.is_primary)).toHaveLength(1);

    await expect(
      admin.query(
        `SELECT * FROM api.fn_assign_entity_economic_activity($1, $2, $3, false, NULL)`,
        [entityId, classId, subclassId]
      )
    ).rejects.toThrow(/ya tiene/i);
  });

  it('eliminación lógica y auditoría', async () => {
    const list = await admin.query(
      `SELECT * FROM api.fn_get_entity_economic_activities($1)`,
      [entityId]
    );
    const activityId = list.rows[0].id as string;

    const removed = await admin.query(
      `SELECT * FROM api.fn_remove_entity_economic_activity($1, $2, NULL)`,
      [entityId, activityId]
    );
    expect(removed.rows[0].deleted_at).not.toBeNull();

    const active = await admin.query(
      `SELECT * FROM api.fn_get_entity_economic_activities($1)`,
      [entityId]
    );
    expect(active.rows.find((r: { id: string }) => r.id === activityId)).toBeUndefined();

    const audit = await admin.query(
      `SELECT id FROM public.audit_logs
        WHERE entity_type = 'ECONOMIC_ACTIVITY' AND entity_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [entityId]
    );
    expect(audit.rows.length).toBe(1);

    await expect(
      admin.query(`DELETE FROM public.entity_economic_activities WHERE id = $1`, [activityId])
    ).rejects.toThrow(/físic|reject|no permit/i);
  });
});
