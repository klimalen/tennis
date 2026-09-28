-- Joining an open game left an existing invite as "invited". The schedule and
-- the Games list only treated "accepted" as playing, while the open-game card
-- already said "You're in", so the game never appeared. Accepting the seat
-- updates that row. A fresh join still inserts accepted.

CREATE OR REPLACE FUNCTION join_open_game(p_game_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_count int;
  v_status participant_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_game
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_game.is_open THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  SELECT status INTO v_status
  FROM game_participants
  WHERE game_id = p_game_id AND player_id = auth.uid();

  IF FOUND THEN
    IF v_status = 'accepted' THEN
      RETURN 'already';
    END IF;

    SELECT count(*) INTO v_count
    FROM game_participants
    WHERE game_id = p_game_id
      AND status IN ('accepted', 'invited')
      AND player_id <> auth.uid();

    IF v_count >= v_game.max_players THEN
      RAISE EXCEPTION 'game full';
    END IF;

    UPDATE game_participants
    SET status = 'accepted', responded_at = now()
    WHERE game_id = p_game_id AND player_id = auth.uid();

    RETURN 'joined';
  END IF;

  SELECT count(*) INTO v_count
  FROM game_participants
  WHERE game_id = p_game_id
    AND status IN ('accepted', 'invited');

  IF v_count >= v_game.max_players THEN
    RAISE EXCEPTION 'game full';
  END IF;

  INSERT INTO game_participants (game_id, player_id, status)
  VALUES (p_game_id, auth.uid(), 'accepted');

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION join_open_game(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION join_open_game(uuid) TO authenticated;

-- People already holding an open-game seat as "invited" are the stuck case.
-- Do not send a new "joined" notification for that repair.
ALTER TABLE game_participants DISABLE TRIGGER game_participants_notify;

UPDATE game_participants gp
SET status = 'accepted', responded_at = COALESCE(gp.responded_at, now())
FROM games g
WHERE g.id = gp.game_id
  AND g.is_open
  AND g.status NOT IN ('cancelled', 'draft')
  AND gp.status = 'invited'
  AND gp.player_id <> g.creator_id;

ALTER TABLE game_participants ENABLE TRIGGER game_participants_notify;
