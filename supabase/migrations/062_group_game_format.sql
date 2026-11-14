-- Group sessions share the games table. The host sets max_players (1–32).
-- There is no minimum roster: the game is listed and joinable until the cap.

ALTER TYPE play_format ADD VALUE IF NOT EXISTS 'group';
