-- One inbox row per thing a player should see under Feed → Notifications.
-- Written by triggers so every path (join, leave, invite, edit, cancel) is covered.
-- The feed loads these ten at a time.

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind        text NOT NULL,
  game_id     uuid,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  source_key  text NOT NULL,
  UNIQUE (user_id, source_key)
);

CREATE INDEX notifications_user_recent_idx
  ON notifications (user_id, created_at DESC, id DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

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
  ON CONFLICT (user_id, source_key) DO NOTHING;
END;
$$;

-- Default privileges on this project also grant EXECUTE to anon and authenticated.
-- Those roles must not be able to insert inbox rows for someone else.
REVOKE ALL ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) TO postgres;

CREATE OR REPLACE FUNCTION notification_game_payload(p_game games)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'scheduled_at', p_game.scheduled_at,
    'format', p_game.format,
    'location', p_game.neighborhood
  ));
$$;

CREATE OR REPLACE FUNCTION try_message_json(p_body text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_body IS NULL OR left(btrim(p_body), 1) <> '{' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN p_body::jsonb;
EXCEPTION WHEN others THEN
  RETURN '{}'::jsonb;
END;
$$;

-- ─── Follows ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM add_notification(
    NEW.following_id,
    NEW.follower_id,
    'follow',
    NULL,
    '{}'::jsonb,
    NEW.created_at,
    'follow:' || NEW.follower_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER follows_notify
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- ─── Play requests ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_game_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      PERFORM add_notification(
        NEW.receiver_id,
        NEW.sender_id,
        'request',
        NULL,
        jsonb_build_object('request_id', NEW.id),
        NEW.created_at,
        'request:' || NEW.id::text
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending' THEN
    DELETE FROM notifications
    WHERE user_id = NEW.receiver_id
      AND source_key = 'request:' || NEW.id::text;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'matched') THEN
    PERFORM add_notification(
      NEW.sender_id,
      NEW.receiver_id,
      'request_accepted',
      NULL,
      jsonb_build_object('request_id', NEW.id),
      NEW.updated_at,
      'request_accepted:' || NEW.id::text
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'declined' THEN
    PERFORM add_notification(
      NEW.sender_id,
      NEW.receiver_id,
      'request_declined',
      NULL,
      jsonb_build_object('request_id', NEW.id),
      NEW.updated_at,
      'request_declined:' || NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER game_requests_notify
  AFTER INSERT OR UPDATE OF status ON game_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_game_request();

-- ─── Joining, leaving, inviting ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = NEW.game_id;
  IF NOT FOUND OR NEW.player_id = v_game.creator_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'invited' THEN
    PERFORM add_notification(
      NEW.player_id,
      v_game.creator_id,
      'game_invite',
      NEW.game_id,
      notification_game_payload(v_game),
      NEW.invited_at,
      'invite:' || NEW.game_id::text || ':' || NEW.player_id::text
    );
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'accepted' AND v_game.is_open THEN
    PERFORM add_notification(
      v_game.creator_id,
      NEW.player_id,
      'game_joined',
      NEW.game_id,
      notification_game_payload(v_game),
      COALESCE(NEW.invited_at, now()),
      'joined:' || NEW.game_id::text || ':' || NEW.player_id::text
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM 'accepted'
    AND NEW.status = 'accepted'
    AND v_game.is_open THEN
    PERFORM add_notification(
      v_game.creator_id,
      NEW.player_id,
      'game_joined',
      NEW.game_id,
      notification_game_payload(v_game),
      COALESCE(NEW.responded_at, now()),
      'joined:' || NEW.game_id::text || ':' || NEW.player_id::text
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'accepted'
    AND NEW.status = 'declined' THEN
    PERFORM add_notification(
      v_game.creator_id,
      NEW.player_id,
      'game_left',
      NEW.game_id,
      notification_game_payload(v_game),
      COALESCE(NEW.responded_at, now()),
      'left:' || NEW.game_id::text || ':' || NEW.player_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER game_participants_notify
  AFTER INSERT OR UPDATE OF status ON game_participants
  FOR EACH ROW EXECUTE FUNCTION notify_on_participant();

-- ─── Game edited or cancelled ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_game_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_player uuid;
BEGIN
  IF NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.format IS NOT DISTINCT FROM OLD.format
     AND NEW.neighborhood IS NOT DISTINCT FROM OLD.neighborhood THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), NEW.creator_id);

  FOR v_player IN
    SELECT player_id
    FROM game_participants
    WHERE game_id = NEW.id
      AND status IN ('accepted', 'invited')
      AND player_id <> v_actor
  LOOP
    PERFORM add_notification(
      v_player,
      v_actor,
      'game_updated',
      NEW.id,
      notification_game_payload(NEW),
      now(),
      'updated:' || NEW.id::text || ':' || clock_timestamp()::text || ':' || v_player::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER games_notify_change
  AFTER UPDATE OF scheduled_at, format, neighborhood ON games
  FOR EACH ROW EXECUTE FUNCTION notify_on_game_change();

CREATE OR REPLACE FUNCTION notify_on_game_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player uuid;
  v_payload jsonb;
BEGIN
  v_payload := notification_game_payload(OLD);

  FOR v_player IN
    SELECT player_id
    FROM game_participants
    WHERE game_id = OLD.id
      AND status IN ('accepted', 'invited')
      AND player_id <> OLD.creator_id
  LOOP
    PERFORM add_notification(
      v_player,
      OLD.creator_id,
      'game_cancelled',
      OLD.id,
      v_payload,
      now(),
      'cancelled:' || OLD.id::text || ':' || v_player::text
    );
  END LOOP;

  RETURN OLD;
END;
$$;

CREATE TRIGGER games_notify_delete
  BEFORE DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION notify_on_game_delete();

-- ─── History already sitting in chats and tables ────────────────────────────

INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  f.following_id,
  f.follower_id,
  'follow',
  NULL,
  '{}'::jsonb,
  f.created_at,
  'follow:' || f.follower_id::text
FROM follows f
ON CONFLICT (user_id, source_key) DO NOTHING;

INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  r.receiver_id,
  r.sender_id,
  'request',
  NULL,
  jsonb_build_object('request_id', r.id),
  r.created_at,
  'request:' || r.id::text
FROM game_requests r
WHERE r.status = 'pending'
ON CONFLICT (user_id, source_key) DO NOTHING;

INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  r.sender_id,
  r.receiver_id,
  CASE WHEN r.status = 'declined' THEN 'request_declined' ELSE 'request_accepted' END,
  NULL,
  jsonb_build_object('request_id', r.id),
  r.updated_at,
  CASE WHEN r.status = 'declined' THEN 'request_declined:' ELSE 'request_accepted:' END || r.id::text
FROM game_requests r
WHERE r.status IN ('accepted', 'matched', 'declined')
ON CONFLICT (user_id, source_key) DO NOTHING;

INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  cp.user_id,
  m.sender_id,
  CASE
    WHEN COALESCE(try_message_json(m.body)->>'joined', '') = 'true' THEN 'game_joined'
    WHEN COALESCE(try_message_json(m.body)->>'updated', '') = 'true' THEN 'game_updated'
    WHEN m.game_id IS NULL THEN 'game_cancelled'
    ELSE 'game_invite'
  END,
  m.game_id,
  jsonb_strip_nulls(jsonb_build_object(
    'scheduled_at', try_message_json(m.body)->>'scheduled_at',
    'format', try_message_json(m.body)->>'format',
    'location', try_message_json(m.body)->>'location'
  )),
  m.created_at,
  CASE
    WHEN COALESCE(try_message_json(m.body)->>'joined', '') = 'true' AND m.game_id IS NOT NULL
      THEN 'joined:' || m.game_id::text || ':' || m.sender_id::text
    WHEN COALESCE(try_message_json(m.body)->>'updated', '') = 'true'
      THEN 'message:' || m.id::text
    WHEN m.game_id IS NULL
      THEN 'message:' || m.id::text
    ELSE 'invite:' || m.game_id::text || ':' || cp.user_id::text
  END
FROM messages m
JOIN conversation_participants cp
  ON cp.conversation_id = m.conversation_id
 AND cp.user_id <> m.sender_id
WHERE m.type = 'game_invite'
  AND cp.user_id <> m.sender_id
ON CONFLICT (user_id, source_key) DO NOTHING;

-- Invites and open-game joins that never made it into a chat.
INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  gp.player_id,
  g.creator_id,
  'game_invite',
  g.id,
  notification_game_payload(g),
  gp.invited_at,
  'invite:' || g.id::text || ':' || gp.player_id::text
FROM game_participants gp
JOIN games g ON g.id = gp.game_id
WHERE gp.status = 'invited'
  AND gp.player_id <> g.creator_id
ON CONFLICT (user_id, source_key) DO NOTHING;

INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
SELECT
  g.creator_id,
  gp.player_id,
  'game_joined',
  g.id,
  notification_game_payload(g),
  gp.invited_at,
  'joined:' || g.id::text || ':' || gp.player_id::text
FROM game_participants gp
JOIN games g ON g.id = gp.game_id
WHERE gp.status = 'accepted'
  AND gp.player_id <> g.creator_id
  AND g.is_open
ON CONFLICT (user_id, source_key) DO NOTHING;

CREATE OR REPLACE FUNCTION list_notifications(
  p_before timestamptz,
  p_before_id uuid,
  p_limit int
)
RETURNS TABLE (
  id uuid,
  kind text,
  game_id uuid,
  payload jsonb,
  created_at timestamptz,
  actor_id uuid,
  actor_full_name text,
  actor_username text,
  actor_avatar_url text,
  actor_skill_self numeric,
  actor_skill_computed numeric,
  actor_city text,
  following_back boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.kind,
    n.game_id,
    n.payload,
    n.created_at,
    n.actor_id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.skill_level_self,
    p.skill_level_computed,
    p.city_name,
    EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = auth.uid()
        AND f.following_id = n.actor_id
    )
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_id
  WHERE n.user_id = auth.uid()
    AND (
      p_before IS NULL
      OR n.created_at < p_before
      OR (n.created_at = p_before AND n.id < p_before_id)
    )
  ORDER BY n.created_at DESC, n.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION list_notifications(timestamptz, uuid, int) TO authenticated;
