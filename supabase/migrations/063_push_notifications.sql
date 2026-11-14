-- Device push tokens, per-kind preferences, per-chat mute, and chat-message inbox rows.
-- Soft-ask completion is stored on profiles so onboarding only shows the prompt once.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_prompt_seen_at timestamptz;

CREATE TABLE push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All kinds default on. Missing row = all on (send path treats null as enabled).
CREATE TABLE notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  follow             boolean NOT NULL DEFAULT true,
  request            boolean NOT NULL DEFAULT true,
  request_accepted   boolean NOT NULL DEFAULT true,
  request_declined   boolean NOT NULL DEFAULT true,
  game_invite        boolean NOT NULL DEFAULT true,
  game_joined        boolean NOT NULL DEFAULT true,
  game_left          boolean NOT NULL DEFAULT true,
  game_updated       boolean NOT NULL DEFAULT true,
  game_cancelled     boolean NOT NULL DEFAULT true,
  message            boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS muted_at timestamptz;

-- ─── Chat message → inbox ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_preview text;
BEGIN
  -- Only real chat text. game_invite rows have their own notification paths.
  IF NEW.type IS DISTINCT FROM 'text' THEN
    RETURN NEW;
  END IF;

  v_preview := left(btrim(NEW.body), 120);

  FOR v_recipient IN
    SELECT cp.user_id
    FROM conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND cp.muted_at IS NULL
  LOOP
    PERFORM add_notification(
      v_recipient,
      NEW.sender_id,
      'message',
      NULL,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'preview', v_preview
      ),
      NEW.created_at,
      'message:' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify ON messages;
CREATE TRIGGER messages_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_message();

-- Helper for the send worker: whether this user wants this kind.
CREATE OR REPLACE FUNCTION notification_kind_enabled(p_user_id uuid, p_kind text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN CASE p_kind
    WHEN 'follow' THEN v_prefs.follow
    WHEN 'request' THEN v_prefs.request
    WHEN 'request_accepted' THEN v_prefs.request_accepted
    WHEN 'request_declined' THEN v_prefs.request_declined
    WHEN 'game_invite' THEN v_prefs.game_invite
    WHEN 'game_joined' THEN v_prefs.game_joined
    WHEN 'game_left' THEN v_prefs.game_left
    WHEN 'game_updated' THEN v_prefs.game_updated
    WHEN 'game_cancelled' THEN v_prefs.game_cancelled
    WHEN 'message' THEN v_prefs.message
    ELSE true
  END;
END;
$$;

REVOKE ALL ON FUNCTION notification_kind_enabled(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION notification_kind_enabled(uuid, text) TO service_role, postgres;
