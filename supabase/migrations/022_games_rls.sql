-- Allow creator to INSERT their own games
CREATE POLICY "Creator can insert games"
  ON games FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Allow creator to UPDATE/DELETE their own games
CREATE POLICY "Creator can update games"
  ON games FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creator can delete games"
  ON games FOR DELETE USING (auth.uid() = creator_id);

-- Set defaults so API doesn't need to specify skill range
ALTER TABLE games ALTER COLUMN skill_level_min SET DEFAULT 1.0;
ALTER TABLE games ALTER COLUMN skill_level_max SET DEFAULT 7.0;

-- Fix self-referential RLS on game_participants (same pattern as conversations)
CREATE OR REPLACE FUNCTION my_game_ids()
  RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT game_id FROM game_participants WHERE player_id = auth.uid();
$$;

DROP POLICY IF EXISTS "Participants view game participants" ON game_participants;

CREATE POLICY "Participants view game participants"
  ON game_participants FOR SELECT USING (
    auth.uid() = player_id OR
    game_id IN (SELECT my_game_ids())
  );

-- Creator can invite participants; users can add themselves
CREATE POLICY "Creator can insert participants"
  ON game_participants FOR INSERT WITH CHECK (
    auth.uid() = player_id OR
    game_id IN (SELECT id FROM games WHERE creator_id = auth.uid())
  );

-- Participant can update their own status (accept/decline invite)
CREATE POLICY "Participant can update own status"
  ON game_participants FOR UPDATE USING (auth.uid() = player_id);

-- Creator can remove participants
CREATE POLICY "Creator can delete participants"
  ON game_participants FOR DELETE USING (
    game_id IN (SELECT id FROM games WHERE creator_id = auth.uid())
  );
