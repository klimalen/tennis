-- Stop writing "Name joined/left the game" system lines into chats.
-- Existing rows stay in the DB; the UI no longer renders membership notices.

DROP TRIGGER IF EXISTS game_participants_sync_chat_notice ON game_participants;
DROP FUNCTION IF EXISTS announce_game_membership();
