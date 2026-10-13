-- Vínculo sesión CRM ↔ sessionRef opaco de ENTRA-userAPI (introspección S2S).

ALTER TABLE public.crm_auth_sessions
  ADD COLUMN IF NOT EXISTS entra_session_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_auth_sessions_entra_ref
  ON public.crm_auth_sessions (entra_session_ref)
  WHERE entra_session_ref IS NOT NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION api.fn_create_crm_session(
  p_id text,
  p_user_id text,
  p_family_id text,
  p_refresh_token_hash text,
  p_absolute_expires_at timestamptz,
  p_entra_session_ref text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  user_id text,
  family_id text,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  entra_session_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.crm_auth_sessions (
    id, user_id, family_id, refresh_token_hash, absolute_expires_at, entra_session_ref
  ) VALUES (
    p_id, p_user_id, p_family_id, p_refresh_token_hash, p_absolute_expires_at,
    NULLIF(p_entra_session_ref, '')
  );

  RETURN QUERY
  SELECT s.id, s.user_id, s.family_id, s.absolute_expires_at, s.revoked_at, s.entra_session_ref
  FROM public.crm_auth_sessions s
  WHERE s.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz, text) TO crm_api;

-- Mantener overload antigua (5 args) delegando a la nueva.
CREATE OR REPLACE FUNCTION api.fn_create_crm_session(
  p_id text,
  p_user_id text,
  p_family_id text,
  p_refresh_token_hash text,
  p_absolute_expires_at timestamptz
)
RETURNS TABLE (
  id text,
  user_id text,
  family_id text,
  absolute_expires_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.user_id, c.family_id, c.absolute_expires_at, c.revoked_at
  FROM api.fn_create_crm_session(
    p_id, p_user_id, p_family_id, p_refresh_token_hash, p_absolute_expires_at, NULL
  ) AS c;
$$;

REVOKE ALL ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz) TO crm_api;

CREATE OR REPLACE FUNCTION api.fn_get_crm_session(p_id text)
RETURNS TABLE (
  id text,
  user_id text,
  family_id text,
  refresh_token_hash text,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz,
  entra_session_ref text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    s.user_id,
    s.family_id,
    s.refresh_token_hash,
    s.absolute_expires_at,
    s.revoked_at,
    s.revoke_reason,
    s.created_at,
    s.entra_session_ref
  FROM public.crm_auth_sessions s
  WHERE s.id = p_id;
$$;

REVOKE ALL ON FUNCTION api.fn_get_crm_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_get_crm_session(text) TO crm_api;

-- Revoca todas las sesiones CRM ligadas a un sessionRef de ENTRA.
CREATE OR REPLACE FUNCTION api.fn_revoke_crm_sessions_by_entra_ref(
  p_entra_session_ref text,
  p_reason text DEFAULT 'entra_revoked'
)
RETURNS TABLE (sid text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.crm_auth_sessions s
  SET revoked_at = COALESCE(s.revoked_at, NOW()),
      revoke_reason = COALESCE(s.revoke_reason, p_reason),
      updated_at = NOW()
  WHERE s.entra_session_ref = p_entra_session_ref
    AND s.revoked_at IS NULL
  RETURNING s.id;
END;
$$;

REVOKE ALL ON FUNCTION api.fn_revoke_crm_sessions_by_entra_ref(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_revoke_crm_sessions_by_entra_ref(text, text) TO crm_api;
