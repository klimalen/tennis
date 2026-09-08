-- ─── Unique index: one post per (author, game) ───────────────────────────────

CREATE UNIQUE INDEX posts_author_game_unique
ON posts(author_id, game_id)
WHERE game_id IS NOT NULL;

-- ─── Trigger: participant joins open game → auto-post ─────────────────────────

CREATE OR REPLACE FUNCTION auto_post_game_participant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    -- Skip if this participant is the creator (creator already has a post from open_game trigger)
    IF NOT EXISTS (
      SELECT 1 FROM games WHERE id = NEW.game_id AND creator_id = NEW.player_id
    ) THEN
      INSERT INTO posts (author_id, type, game_id)
      VALUES (NEW.player_id, 'open_game', NEW.game_id)
      ON CONFLICT (author_id, game_id) WHERE game_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER game_participant_post_trigger
AFTER INSERT ON game_participants
FOR EACH ROW EXECUTE FUNCTION auto_post_game_participant();
