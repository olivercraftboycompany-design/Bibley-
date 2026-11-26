"""Community persistence for a trusted same-origin account-server adapter.

The calling server supplies the authenticated, stable account ID. This module is
not an HTTP handler. It never imports private notes, prayer lists or sync data.
"""
import secrets
import sqlite3


class NotFound(ValueError):
    pass


SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS community_friends(
  low TEXT NOT NULL, high TEXT NOT NULL, requester TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0 CHECK(accepted IN(0,1)),
  CHECK(low < high), CHECK(requester IN(low,high)), PRIMARY KEY(low,high));
CREATE TABLE IF NOT EXISTS community_shares(
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('highlight','note','prayer','encouragement')),
  content TEXT NOT NULL, created INTEGER NOT NULL DEFAULT(unixepoch()),
  CHECK(owner <> recipient));
CREATE INDEX IF NOT EXISTS community_share_inbox ON community_shares(recipient, created DESC);
"""


def ident(value):
    if not isinstance(value, str) or not value or len(value) > 128 or value != value.strip():
        raise ValueError('Invalid account')
    return value


class Community:
    def __init__(self, path):
        self.db = sqlite3.connect(path, isolation_level='IMMEDIATE')
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    def close(self):
        self.db.close()

    @staticmethod
    def pair(actor, other):
        actor, other = ident(actor), ident(other)
        if actor == other:
            raise ValueError('Choose another account')
        return tuple(sorted((actor, other)))

    def request_friend(self, actor, other):
        # Adapter must resolve other through a verified account lookup before calling.
        pair = self.pair(actor, other)
        with self.db:
            self.db.execute('INSERT INTO community_friends(low,high,requester) VALUES(?,?,?) ON CONFLICT DO NOTHING', (*pair, actor))

    def accept_friend(self, actor, other):
        pair = self.pair(actor, other)
        with self.db:
            cur = self.db.execute('UPDATE community_friends SET accepted=1 WHERE low=? AND high=? AND requester=?', (*pair, other))
            if not cur.rowcount:
                raise NotFound('No incoming request')

    def friends(self, actor):
        actor = ident(actor)
        return [dict(r) for r in self.db.execute('''
        SELECT CASE WHEN low=? THEN high ELSE low END AS account,
               CASE WHEN accepted=1 THEN 'friend' WHEN requester=? THEN 'outgoing' ELSE 'incoming' END AS state
        FROM community_friends WHERE low=? OR high=? ORDER BY account''', (actor,)*4)]

    def remove_friend(self, actor, other):
        pair = self.pair(actor, other)
        with self.db:
            self.db.execute('DELETE FROM community_friends WHERE low=? AND high=?', pair)
            self.db.execute('DELETE FROM community_shares WHERE (owner=? AND recipient=?) OR (owner=? AND recipient=?)', (actor, other, other, actor))

    def share(self, actor, other, kind, explicit_copy):
        # Only the text confirmed in a share composer, never a reference into private sync.
        pair = self.pair(actor, other)
        if kind not in ('highlight','note','prayer','encouragement') or not isinstance(explicit_copy, str) or not 1 <= len(explicit_copy.strip()) <= 4000:
            raise ValueError('Choose a supported type and enter up to 4000 characters')
        share_id = secrets.token_urlsafe(24)
        with self.db:
            cur = self.db.execute('''INSERT INTO community_shares(id,owner,recipient,kind,content)
                SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM community_friends WHERE low=? AND high=? AND accepted=1)''',
                (share_id, actor, other, kind, explicit_copy.strip(), *pair))
            if not cur.rowcount:
                raise NotFound('Accepted friendship required')
        return share_id

    def inbox(self, actor):
        return [dict(r) for r in self.db.execute('''SELECT id,owner,kind,content,created FROM community_shares
          WHERE recipient=? ORDER BY created DESC,id DESC LIMIT 100''', (ident(actor),))]

    def revoke(self, actor, share_id):
        with self.db:
            cur = self.db.execute('DELETE FROM community_shares WHERE owner=? AND id=?', (ident(actor), share_id))
            if not cur.rowcount:
                raise NotFound('No share found')
