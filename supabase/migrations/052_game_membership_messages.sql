-- A seat change is a line in the chats, not only a badge on an old card.
-- Joining writes "Name joined the game". Leaving a seat writes "Name left the game".
-- The game chat gets the line for everyone still in it. The direct chat with the
-- organiser gets the same line when that chat already exists. Declining an
-- invite that was never accepted stays on the proposal card.

CREATE OR REPLACE FUNCTION announce_game_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_name text;
  v_event text;
  v_body text;
  v_game_chat uuid;
  v_direct uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    v_event := 'joined';
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM 'accepted'
    AND NEW.status = 'accepted' THEN
    v_event := 'joined';
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'accepted'
    AND NEW.status IN ('declined', 'cancelled') THEN
    v_event := 'left';
  ELSE
    RETURN NEW;
  END IF;

  SELECT * INTO v_game FROM games WHERE id = NEW.game_id;
  IF NOT FOUND OR NEW.player_id = v_game.creator_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(full_name), '') INTO v_name
  FROM profiles
  WHERE id = NEW.player_id;

  v_body := jsonb_build_object(
    'event', v_event,
    'name', COALESCE(v_name, 'Someone'),
    'scheduled_at', v_game.scheduled_at,
    'format', v_game.format,
    'location', v_game.neighborhood
  )::text;

  SELECT id INTO v_game_chat
  FROM conversations
  WHERE game_id = NEW.game_id
    AND kind = 'game';

  IF v_game_chat IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_id, body, type, game_id)
    VALUES (v_game_chat, NEW.player_id, v_body, 'system', NEW.game_id);
  END IF;

  SELECT cp1.conversation_id INTO v_direct
  FROM conversation_participants cp1
  JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = NEW.player_id
    AND cp2.user_id = v_game.creator_id
    AND c.kind = 'direct'
  LIMIT 1;

  IF v_direct IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_id, body, type, game_id)
    VALUES (v_direct, NEW.player_id, v_body, 'system', NEW.game_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION announce_game_membership() FROM PUBLIC, anon, authenticated;

-- Runs after game_participants_sync_chat, so the game chat already exists
-- and someone who left is already out of it.
DROP TRIGGER IF EXISTS game_participants_sync_chat_notice ON game_participants;
CREATE TRIGGER game_participants_sync_chat_notice
  AFTER INSERT OR UPDATE OF status ON game_participants
  FOR EACH ROW EXECUTE FUNCTION announce_game_membership();
