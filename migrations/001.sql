CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('citizen','officer','admin'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS complaints (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), officer TEXT REFERENCES users(id),
 issue TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL,
 lat REAL, lon REAL, ward TEXT, priority TEXT NOT NULL, status TEXT NOT NULL,
 created INTEGER NOT NULL, resolved INTEGER
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, complaint TEXT NOT NULL REFERENCES complaints(id),
 actor TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, note TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
 id TEXT PRIMARY KEY, complaint TEXT NOT NULL REFERENCES complaints(id), phase TEXT NOT NULL, data BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), result TEXT NOT NULL, category TEXT NOT NULL,
 feedback TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, title TEXT NOT NULL, cost INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
 points INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(owner,reason)
);
CREATE TABLE IF NOT EXISTS support (
 complaint TEXT REFERENCES complaints(id), actor TEXT REFERENCES users(id), PRIMARY KEY(complaint,actor)
);
CREATE INDEX IF NOT EXISTS complaint_owner ON complaints(owner);
CREATE INDEX IF NOT EXISTS complaint_officer ON complaints(officer);
CREATE INDEX IF NOT EXISTS complaint_duplicate ON complaints(issue,created);
CREATE INDEX IF NOT EXISTS event_complaint ON events(complaint,id);
CREATE TABLE IF NOT EXISTS scan_requests (
 owner TEXT NOT NULL REFERENCES users(id), created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scan_request_limit ON scan_requests(owner,created);
CREATE TABLE IF NOT EXISTS auth_requests (address TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_request_window ON auth_requests(created);
