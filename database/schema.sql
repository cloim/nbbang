CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, treasurer_name text NOT NULL DEFAULT '', treasurer_account text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL, title text NOT NULL, treasurer_name text NOT NULL DEFAULT '', treasurer_account text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE, name text NOT NULL, is_treasurer boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meeting_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(meeting_id, member_id)
);
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title text NOT NULL, payer_id uuid NOT NULL REFERENCES members(id), amount integer NOT NULL, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expense_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id), amount integer, UNIQUE(expense_id, member_id)
);
CREATE TABLE IF NOT EXISTS settlement_groups (
  meeting_id uuid PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE, groups jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS meetings_owner_created_idx ON meetings(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS members_group_idx ON members(group_id, created_at);
CREATE INDEX IF NOT EXISTS expenses_meeting_order_idx ON expenses(meeting_id, sort_order, created_at);
