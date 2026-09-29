-- Borrado lógico, objetos de base y bloqueo de DELETE físico.
-- La aplicación llama procedimientos (CALL). Las lecturas activas viven en vistas.

ALTER TABLE "verification_items" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "verification_items" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "entity_contacts" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "entity_contacts" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "event_registrations" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "event_registrations" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "import_batches" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "import_batches" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "staging_rows" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "intake_sessions" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "intake_sessions" ADD COLUMN "deleted_by_id" TEXT;

ALTER TABLE "intake_entities" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "verification_items"
  ADD CONSTRAINT "verification_items_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "entity_contacts"
  ADD CONSTRAINT "entity_contacts_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "intake_sessions"
  ADD CONSTRAINT "intake_sessions_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "verification_items_deleted_at_idx" ON "verification_items"("deleted_at");
CREATE INDEX "verification_items_deleted_by_id_idx" ON "verification_items"("deleted_by_id");
CREATE INDEX "verification_items_active_queue_idx"
  ON "verification_items" ("status", "source", "entity_type")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "entity_contacts_deleted_at_idx" ON "entity_contacts"("deleted_at");
CREATE INDEX "entity_contacts_deleted_by_id_idx" ON "entity_contacts"("deleted_by_id");
CREATE INDEX "entity_contacts_active_entity_idx"
  ON "entity_contacts" ("entity_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "event_registrations_deleted_at_idx" ON "event_registrations"("deleted_at");
CREATE INDEX "event_registrations_deleted_by_id_idx" ON "event_registrations"("deleted_by_id");

ALTER TABLE "event_registrations" DROP CONSTRAINT IF EXISTS "event_registrations_event_id_entity_id_key";
CREATE UNIQUE INDEX "event_registrations_active_event_entity_key"
  ON "event_registrations" ("event_id", "entity_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "import_batches_deleted_at_idx" ON "import_batches"("deleted_at");
CREATE INDEX "import_batches_deleted_by_id_idx" ON "import_batches"("deleted_by_id");

CREATE INDEX "staging_rows_deleted_at_idx" ON "staging_rows"("deleted_at");
CREATE INDEX "staging_rows_active_batch_idx"
  ON "staging_rows" ("import_batch_id", "status")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "intake_sessions_deleted_at_idx" ON "intake_sessions"("deleted_at");
CREATE INDEX "intake_sessions_deleted_by_id_idx" ON "intake_sessions"("deleted_by_id");

CREATE INDEX "intake_entities_deleted_at_idx" ON "intake_entities"("deleted_at");
CREATE INDEX "intake_entities_active_session_idx"
  ON "intake_entities" ("session_id")
  WHERE "deleted_at" IS NULL;

-- Vistas de filas vigentes y de verificaciones dadas de baja (con el funcionario).
CREATE OR REPLACE VIEW "vw_verification_items_activas" AS
  SELECT * FROM "verification_items" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_verification_items_eliminadas" AS
  SELECT
    v.*,
    u."username" AS "funcionario"
  FROM "verification_items" v
  LEFT JOIN "users" u ON u."id" = v."deleted_by_id"
  WHERE v."deleted_at" IS NOT NULL;

CREATE OR REPLACE VIEW "vw_entity_contacts_activos" AS
  SELECT * FROM "entity_contacts" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_event_registrations_activas" AS
  SELECT * FROM "event_registrations" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_import_batches_activos" AS
  SELECT * FROM "import_batches" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_staging_rows_activas" AS
  SELECT * FROM "staging_rows" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_intake_sessions_activas" AS
  SELECT * FROM "intake_sessions" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "vw_intake_entities_activas" AS
  SELECT * FROM "intake_entities" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE FUNCTION public.fn_db_ping()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 1;
$$;

CREATE OR REPLACE PROCEDURE public.sp_db_ping()
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.fn_db_ping();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reject_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_physical_delete', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Borrado físico no permitido en %. Use borrado lógico.', TG_TABLE_NAME
    USING ERRCODE = '23001';
END;
$$;

CREATE TRIGGER "trg_verification_items_no_delete"
  BEFORE DELETE ON "verification_items"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_entity_contacts_no_delete"
  BEFORE DELETE ON "entity_contacts"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_event_registrations_no_delete"
  BEFORE DELETE ON "event_registrations"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_import_batches_no_delete"
  BEFORE DELETE ON "import_batches"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_staging_rows_no_delete"
  BEFORE DELETE ON "staging_rows"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_intake_sessions_no_delete"
  BEFORE DELETE ON "intake_sessions"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE TRIGGER "trg_intake_entities_no_delete"
  BEFORE DELETE ON "intake_entities"
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_verifications_unvalidated(
  p_batch_id uuid,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "verification_items"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "import_batch_id" = p_batch_id
     AND "status" <> 'VALIDATED'
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_intake_sessions(
  p_ids text,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_ids IS NULL OR btrim(p_ids) = '' THEN
    RETURN;
  END IF;

  UPDATE "intake_sessions"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "id" IN (
     SELECT btrim(x)::uuid
       FROM unnest(string_to_array(p_ids, ',')) AS x
      WHERE btrim(x) <> ''
   )
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_intake_entities(p_session_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "intake_entities"
     SET "deleted_at" = NOW(),
         "updated_at" = NOW()
   WHERE "session_id" = p_session_id
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_entity_contacts(
  p_entity_id uuid,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "entity_contacts"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "entity_id" = p_entity_id
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_contact(
  p_id uuid,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "entity_contacts"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "id" = p_id
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_registration(
  p_id uuid,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "event_registrations"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "id" = p_id
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_staging_rows(p_batch_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "staging_rows"
     SET "deleted_at" = NOW()
   WHERE "import_batch_id" = p_batch_id
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_import_batch(
  p_id uuid,
  p_user_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  CALL public.sp_soft_delete_staging_rows(p_id);
  CALL public.sp_soft_delete_verifications_unvalidated(p_id, p_user_id);

  UPDATE "import_batches"
     SET "deleted_at" = NOW(),
         "deleted_by_id" = p_user_id,
         "updated_at" = NOW()
   WHERE "id" = p_id
     AND "deleted_at" IS NULL;
END;
$$;
