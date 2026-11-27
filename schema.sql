-- Bibley SQLite database schema (Bibley 7.8, 2026-11-27)
-- The exact schema of the live database behind https://bibley.sites.tab.bot (worker.src.js creates it with
-- CREATE TABLE IF NOT EXISTS on first use). Times are milliseconds since 1970 (JavaScript Date.now()).
--
--   users              Bibley accounts (username is unique, case-insensitive via username_lower;
--                      passwords: PBKDF2-SHA256, 100,000 rounds, 16-byte salt - never stored in plain text)
--   sessions           sign-ins: sha256 of the 32-byte bearer token, 90 days
--   user_sync_state    Cloud Sync: one row per synced setting / notes / highlights key per user
--   auth_failures      wrong-password counter (10 in 15 minutes -> wait)
--   writings           Writings posts (Markdown body, version for "Keep mine / Load theirs")
--   writing_comments   comments on a writing
--   writing_editors    friends the author lets edit a writing
--   prayers, public_notes, friendships   ready for future community features
--
-- Run:  sqlite3 bibley.sqlite < schema.sql
PRAGMA journal_mode = WAL;

-- Accounts & Cloud Sync
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, username_lower TEXT UNIQUE NOT NULL, 
  display_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_label TEXT, 
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS user_sync_state (user_id TEXT NOT NULL, key TEXT NOT NULL, value_json TEXT NOT NULL, 
  updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, key));
CREATE TABLE IF NOT EXISTS auth_failures (k TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);

-- Community (future features)
CREATE TABLE IF NOT EXISTS prayers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, 
  status TEXT NOT NULL DEFAULT 'active', visibility TEXT NOT NULL DEFAULT 'private', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS prayers_user ON prayers (user_id);
CREATE TABLE IF NOT EXISTS public_notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, verse_ref TEXT NOT NULL, body TEXT NOT NULL, 
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS public_notes_ref ON public_notes (verse_ref);
CREATE TABLE IF NOT EXISTS friendships (id TEXT PRIMARY KEY, requester_id TEXT NOT NULL, addressee_id TEXT NOT NULL, 
  status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS friendships_pair ON friendships (requester_id, addressee_id);

-- Writings (7.8)
CREATE TABLE IF NOT EXISTS writings (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, 
  version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, updated_by_id TEXT);
CREATE INDEX IF NOT EXISTS writings_updated ON writings (updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS writings_author ON writings (author_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS writing_comments (id TEXT PRIMARY KEY, writing_id TEXT NOT NULL, author_id TEXT NOT NULL, 
  body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS writing_comments_w ON writing_comments (writing_id, created_at);
CREATE TABLE IF NOT EXISTS writing_editors (writing_id TEXT NOT NULL, user_id TEXT NOT NULL, added_at INTEGER NOT NULL, 
  PRIMARY KEY (writing_id, user_id));
CREATE INDEX IF NOT EXISTS writing_editors_user ON writing_editors (user_id);
