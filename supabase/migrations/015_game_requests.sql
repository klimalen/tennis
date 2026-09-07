-- Game requests: one player invites another to play
CREATE TYPE game_request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'matched');

CREATE TABLE game_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        game_request_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_request CHECK (sender_id <> receiver_id),
  CONSTRAINT unique_pending_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX game_requests_receiver_idx ON game_requests (receiver_id, status);
CREATE INDEX game_requests_sender_idx   ON game_requests (sender_id, status);

-- Conversations for matched players
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid REFERENCES game_requests(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER game_requests_updated_at
  BEFORE UPDATE ON game_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE game_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;

-- game_requests: sender or receiver can read; sender can insert; sender can cancel; receiver can accept/decline
CREATE POLICY "Users see their own requests"
  ON game_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users send requests"
  ON game_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Parties update their request"
  ON game_requests FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- conversations: participants only
CREATE POLICY "Participants see conversation"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "System creates conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants see memberships"
  ON conversation_participants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System inserts participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (true);

-- messages
CREATE POLICY "Participants read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );
