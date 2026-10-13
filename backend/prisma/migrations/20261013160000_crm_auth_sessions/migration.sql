-- ============================================================================
-- Sesiones locales del CRM (JWT con sid). Revocables; refresh con rotación.
-- crm_api no tiene DML directo: solo api.fn_* / api.sp_*.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_auth_sessions (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  family_id             TEXT NOT NULL,
  refresh_token_hash    TEXT NOT NULL,
  absolute_expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,
  revoke_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_auth_sessions_user
  ON public.crm_auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_crm_auth_sessions_family
  ON public.crm_auth_sessions (family_id);

CREATE INDEX IF NOT EXISTS idx_crm_auth_sessions_active
  ON public.crm_auth_sessions (id)
  WHERE revoked_at IS NULL;

REVOKE ALL ON TABLE public.crm_auth_sessions FROM PUBLIC, crm_api, crm_readonly_admin;

-- Crear sesión
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.crm_auth_sessions (
    id, user_id, family_id, refresh_token_hash, absolute_expires_at
  ) VALUES (
    p_id, p_user_id, p_family_id, p_refresh_token_hash, p_absolute_expires_at
  );

  RETURN QUERY
  SELECT s.id, s.user_id, s.family_id, s.absolute_expires_at, s.revoked_at
  FROM public.crm_auth_sessions s
  WHERE s.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_create_crm_session(text, text, text, text, timestamptz) TO crm_api;

-- Lectura de sesión
CREATE OR REPLACE FUNCTION api.fn_get_crm_session(p_id text)
RETURNS TABLE (
  id text,
  user_id text,
  family_id text,
  refresh_token_hash text,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz
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
    s.created_at
  FROM public.crm_auth_sessions s
  WHERE s.id = p_id;
$$;

REVOKE ALL ON FUNCTION api.fn_get_crm_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_get_crm_session(text) TO crm_api;

-- Rotación atómica. Códigos:
--   rotated | reuse_detected | not_found | revoked | expired | hash_mismatch
CREATE OR REPLACE FUNCTION api.fn_rotate_crm_refresh(
  p_id text,
  p_presented_hash text,
  p_new_hash text
)
RETURNS TABLE (
  outcome text,
  user_id text,
  family_id text,
  absolute_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.crm_auth_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.crm_auth_sessions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF s.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'revoked'::text, s.user_id, s.family_id, s.absolute_expires_at;
    RETURN;
  END IF;

  IF s.absolute_expires_at <= NOW() THEN
    UPDATE public.crm_auth_sessions
    SET revoked_at = NOW(), revoke_reason = 'absolute_expired', updated_at = NOW()
    WHERE id = p_id;
    RETURN QUERY SELECT 'expired'::text, s.user_id, s.family_id, s.absolute_expires_at;
    RETURN;
  END IF;

  IF s.refresh_token_hash = p_presented_hash THEN
    UPDATE public.crm_auth_sessions
    SET refresh_token_hash = p_new_hash,
        last_rotated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_id;
    RETURN QUERY SELECT 'rotated'::text, s.user_id, s.family_id, s.absolute_expires_at;
    RETURN;
  END IF;

  -- Hash distinto con JWT de la misma sid: posible reutilización tras rotación.
  UPDATE public.crm_auth_sessions
  SET revoked_at = NOW(),
      revoke_reason = 'refresh_reuse',
      updated_at = NOW()
  WHERE family_id = s.family_id AND revoked_at IS NULL;

  RETURN QUERY SELECT 'reuse_detected'::text, s.user_id, s.family_id, s.absolute_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION api.fn_rotate_crm_refresh(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_rotate_crm_refresh(text, text, text) TO crm_api;

-- Revocar una sesión
CREATE OR REPLACE PROCEDURE api.sp_revoke_crm_session(
  p_id text,
  p_reason text DEFAULT 'logout'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.crm_auth_sessions
  SET revoked_at = COALESCE(revoked_at, NOW()),
      revoke_reason = COALESCE(revoke_reason, p_reason),
      updated_at = NOW()
  WHERE id = p_id AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON PROCEDURE api.sp_revoke_crm_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE api.sp_revoke_crm_session(text, text) TO crm_api;

-- Revocar familia completa
CREATE OR REPLACE PROCEDURE api.sp_revoke_crm_session_family(
  p_family_id text,
  p_reason text DEFAULT 'family_revoke'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.crm_auth_sessions
  SET revoked_at = COALESCE(revoked_at, NOW()),
      revoke_reason = COALESCE(revoke_reason, p_reason),
      updated_at = NOW()
  WHERE family_id = p_family_id AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON PROCEDURE api.sp_revoke_crm_session_family(text, text) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE api.sp_revoke_crm_session_family(text, text) TO crm_api;

-- Revocar todas las sesiones activas de un usuario
CREATE OR REPLACE PROCEDURE api.sp_revoke_crm_sessions_for_user(
  p_user_id text,
  p_reason text DEFAULT 'user_disabled'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.crm_auth_sessions
  SET revoked_at = COALESCE(revoked_at, NOW()),
      revoke_reason = COALESCE(revoke_reason, p_reason),
      updated_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON PROCEDURE api.sp_revoke_crm_sessions_for_user(text, text) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE api.sp_revoke_crm_sessions_for_user(text, text) TO crm_api;
