const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

if (config.dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });
}

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    school_email  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    class_name    TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'staff')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dedications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_name    TEXT NOT NULL,
    to_name      TEXT NOT NULL,
    song         TEXT NOT NULL,
    artist       TEXT,
    meal         TEXT,
    comment      TEXT,
    play_date    TEXT NOT NULL,            -- YYYY-MM-DD, the birthday / day it should play
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'played', 'belated', 'cancelled')),
    status_note  TEXT,
    handled_by   INTEGER REFERENCES users(id),
    handled_at   TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_dedications_status_date ON dedications(status, play_date);
  CREATE INDEX IF NOT EXISTS idx_dedications_user ON dedications(user_id);
`);

module.exports = db;
