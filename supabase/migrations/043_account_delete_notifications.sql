-- Deleting an account cascades into that player's games. The cancel trigger
-- then inserts a notification whose actor is the profile being removed, and
-- notifications_actor_id_fkey rejects the row. Skip inbox writes for this
-- transaction so the account can actually be deleted.

CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM set_config('app.deleting_account', 'true', true);
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION add_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_game_id uuid,
  p_payload jsonb,
  p_created_at timestamptz,
  p_source_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.deleting_account', true) = 'true' THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
  VALUES (
    p_user_id,
    p_actor_id,
    p_kind,
    p_game_id,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_created_at, now()),
    p_source_key
  )
  ON CONFLICT (user_id, source_key) DO UPDATE
  SET
    payload = EXCLUDED.payload,
    created_at = EXCLUDED.created_at,
    actor_id = EXCLUDED.actor_id,
    kind = EXCLUDED.kind,
    game_id = EXCLUDED.game_id
  WHERE notifications.kind = 'game_updated';

  DELETE FROM notifications
  WHERE user_id = p_user_id
    AND created_at < now() - interval '90 days';
END;
$$;

REVOKE ALL ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) TO postgres;
