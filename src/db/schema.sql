PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')) DEFAULT 'editor',
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS animals (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('chien', 'chat', 'nac', 'ferme')),
  sex TEXT NOT NULL CHECK (sex IN ('male', 'femelle', 'groupe', 'inconnu')) DEFAULT 'inconnu',
  breed TEXT NOT NULL DEFAULT '',
  birth_date TEXT,
  age_label TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ok_dogs TEXT NOT NULL CHECK (ok_dogs IN ('oui', 'non', 'a_tester')) DEFAULT 'a_tester',
  ok_cats TEXT NOT NULL CHECK (ok_cats IN ('oui', 'non', 'a_tester')) DEFAULT 'a_tester',
  ok_kids TEXT NOT NULL CHECK (ok_kids IN ('oui', 'non', 'a_tester', 'grands')) DEFAULT 'a_tester',
  housing TEXT NOT NULL CHECK (housing IN ('appartement', 'maison', 'jardin_clos', 'exterieur')) DEFAULT 'maison',
  identification TEXT NOT NULL DEFAULT '',
  vaccinated INTEGER NOT NULL DEFAULT 0,
  sterilized INTEGER NOT NULL DEFAULT 0,
  dewormed INTEGER NOT NULL DEFAULT 0,
  foster_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('disponible', 'reserve', 'adopte')) DEFAULT 'disponible',
  urgent INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  backdrop TEXT NOT NULL DEFAULT 'ajonc',
  fee_label TEXT NOT NULL DEFAULT '',
  adopted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_animals_listing ON animals (published, status, species);

CREATE TABLE IF NOT EXISTS animal_photos (
  id INTEGER PRIMARY KEY,
  animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_animal ON animal_photos (animal_id, position);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('adoption', 'kermesse', 'collecte', 'benevoles', 'fermeture', 'autre')) DEFAULT 'autre',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'interne')) DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events (starts_at);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vie', 'appel', 'conseil', 'merci')) DEFAULT 'vie',
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL CHECK (topic IN ('adoption', 'accueil', 'benevolat', 'don', 'abandon', 'autre')) DEFAULT 'autre',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
  home TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('nouveau', 'traite', 'archive')) DEFAULT 'nouveau',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (status, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
