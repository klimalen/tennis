-- Allow accepted participants to update game details (not just creator)
CREATE POLICY "Participants can update game"
  ON games FOR UPDATE USING (
    auth.uid() = creator_id OR
    id IN (SELECT my_game_ids())
  );
