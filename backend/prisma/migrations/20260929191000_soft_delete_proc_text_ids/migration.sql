-- Los ids de Prisma son TEXT, no UUID. Se reemplazan las firmas de los procedimientos.

DROP PROCEDURE IF EXISTS public.sp_soft_delete_verifications_unvalidated(uuid, uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_intake_sessions(text, uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_intake_entities(uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_entity_contacts(uuid, uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_contact(uuid, uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_registration(uuid, uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_staging_rows(uuid);
DROP PROCEDURE IF EXISTS public.sp_soft_delete_import_batch(uuid, uuid);

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_verifications_unvalidated(
  p_batch_id text,
  p_user_id text
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
  p_user_id text
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
     SELECT btrim(x)
       FROM unnest(string_to_array(p_ids, ',')) AS x
      WHERE btrim(x) <> ''
   )
     AND "deleted_at" IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_intake_entities(p_session_id text)
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
  p_entity_id text,
  p_user_id text
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
  p_id text,
  p_user_id text
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
  p_id text,
  p_user_id text
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

CREATE OR REPLACE PROCEDURE public.sp_soft_delete_staging_rows(p_batch_id text)
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
  p_id text,
  p_user_id text
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
