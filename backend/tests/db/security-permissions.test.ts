/**
 * Tests de seguridad DB: crm_api no puede tocar tablas base;
 * sí puede usar views/functions/procedures de api.
 */
import { Client } from 'pg';

const ADMIN_URL =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL?.replace('?schema=public', '') ||
  'postgresql://postgres:postgres@localhost:5432/emprendedores_db';

const CRM_API_URL =
  process.env.CRM_API_DATABASE_URL ||
  'postgresql://crm_api:cambiar_crm_api@localhost:5432/emprendedores_db';

describe('DB security — crm_api', () => {
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('crm_api NO puede SELECT core/public.persons', async () => {
    await expect(
      admin.query(`SET ROLE crm_api; SELECT id FROM public.persons LIMIT 1;`)
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('crm_api NO puede INSERT en public.entities', async () => {
    await expect(
      admin.query(`
        SET ROLE crm_api;
        INSERT INTO public.entities (id, entity_type, status, display_name, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000099', 'PERSON', 'ACTIVE', 'X', NOW(), NOW());
      `)
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('crm_api NO puede UPDATE public.persons', async () => {
    await expect(
      admin.query(`SET ROLE crm_api; UPDATE public.persons SET first_name = 'HACK' WHERE FALSE;`)
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('crm_api NO puede DELETE public.entities', async () => {
    await expect(
      admin.query(`SET ROLE crm_api; DELETE FROM public.entities WHERE FALSE;`)
    ).rejects.toThrow(/permission denied/i);
    await admin.query('RESET ROLE');
  });

  it('crm_api PUEDE SELECT api.v_person_summary', async () => {
    await admin.query('SET ROLE crm_api');
    const res = await admin.query('SELECT * FROM api.v_person_summary LIMIT 1');
    expect(res).toBeDefined();
    await admin.query('RESET ROLE');
  });

  it('crm_api PUEDE EXECUTE api.fn_normalize_document', async () => {
    await admin.query('SET ROLE crm_api');
    const res = await admin.query(`SELECT api.fn_normalize_document('8-123-456') AS n`);
    expect(res.rows[0].n).toBe('8123456');
    await admin.query('RESET ROLE');
  });

  it('login directo crm_api puede consultar views', async () => {
    const api = new Client({ connectionString: CRM_API_URL });
    try {
      await api.connect();
      const res = await api.query('SELECT count(*)::int AS c FROM api.v_person_summary');
      expect(typeof res.rows[0].c).toBe('number');
    } finally {
      await api.end().catch(() => undefined);
    }
  });

  it('TPT: no permite company en entity PERSON', async () => {
    const id = 'tpt-test-person-entity-0001';
    await admin.query(`SELECT set_config('app.allow_physical_delete', 'on', false)`);
    await admin.query(`DELETE FROM public.companies WHERE entity_id = $1`, [id]).catch(() => undefined);
    await admin.query(`DELETE FROM public.persons WHERE entity_id = $1`, [id]).catch(() => undefined);
    await admin.query(`DELETE FROM public.entities WHERE id = $1`, [id]).catch(() => undefined);
    await admin.query(`SELECT set_config('app.allow_physical_delete', '', false)`);

    await admin.query(
      `
      INSERT INTO public.entities (id, entity_type, status, display_name, created_at, updated_at)
      VALUES ($1, 'PERSON', 'ACTIVE', 'TPT Test', NOW(), NOW())
    `,
      [id]
    );
    await admin.query(
      `
      INSERT INTO public.persons (id, entity_id, first_name, last_name)
      VALUES ($1, $2, 'A', 'B')
    `,
      [`${id}-p`, id]
    );

    await expect(
      admin.query(
        `
        INSERT INTO public.companies (id, entity_id, legal_name)
        VALUES ($1, $2, 'Illegal Co')
      `,
        [`${id}-c`, id]
      )
    ).rejects.toThrow(/TPT/i);

    await admin.query(`SELECT set_config('app.allow_physical_delete', 'on', false)`);
    await admin.query(`DELETE FROM public.persons WHERE entity_id = $1`, [id]);
    await admin.query(`DELETE FROM public.entities WHERE id = $1`, [id]);
    await admin.query(`SELECT set_config('app.allow_physical_delete', '', false)`);
  });

  it('auditoría: INSERT en entities genera change_log', async () => {
    const id = `audit-test-entity-${Date.now()}`;
    await admin.query(`SELECT set_config('app.user_id', 'test-actor', false)`);
    const cfg = await admin.query(`SELECT current_setting('app.user_id', true) AS uid`);
    expect(cfg.rows[0].uid).toBe('test-actor');

    await admin.query(
      `
      INSERT INTO public.entities (id, entity_type, status, display_name, created_at, updated_at)
      VALUES ($1, 'PERSON', 'ACTIVE', 'Audit Test', NOW(), NOW())
    `,
      [id]
    );
    const log = await admin.query(
      `SELECT action, actor_user_id FROM audit.change_log
       WHERE table_name = 'entities' AND record_id = $1
       ORDER BY id DESC LIMIT 1`,
      [id]
    );
    expect(log.rows[0]?.action).toBe('INSERT');
    expect(log.rows[0]?.actor_user_id).toBe('test-actor');

    await admin.query(`UPDATE public.entities SET deleted_at = NOW() WHERE id = $1`, [id]);
    await admin.query(`SELECT set_config('app.user_id', '', false)`);
  });

  it('soft delete físico bloqueado en entities', async () => {
    const id = `phys-del-test-${Date.now()}`;
    await admin.query(
      `
      INSERT INTO public.entities (id, entity_type, status, display_name, created_at, updated_at)
      VALUES ($1, 'PERSON', 'ACTIVE', 'Phys Del', NOW(), NOW())
    `,
      [id]
    );
    await expect(admin.query(`DELETE FROM public.entities WHERE id = $1`, [id])).rejects.toThrow(
      /Borrado físico no permitido/i
    );
    await admin.query(`UPDATE public.entities SET deleted_at = NOW() WHERE id = $1`, [id]);
  });
});
