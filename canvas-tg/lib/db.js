// Acceso a la base de datos.
// - En Vercel: Turso (SQLite alojado) por HTTP, con TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.
// - En local: un archivo SQLite normal (file:local.db) si no hay TURSO_DATABASE_URL.
import seed from './seed.js';

let clientPromise = null;
let ready = null;

// Acepta TURSO_DATABASE_URL / TURSO_AUTH_TOKEN o, si la integración de Vercel
// las crea con otro nombre (p. ej. con prefijo), detecta la URL libsql:// y su token.
function findEnv() {
  const env = process.env;
  let url = env.TURSO_DATABASE_URL;
  let authToken = env.TURSO_AUTH_TOKEN;
  if (!url) {
    const k = Object.keys(env).find((k) => /DATABASE_URL$|DB_URL$/.test(k) && /^libsql:\/\//.test(env[k] || ''));
    if (k) url = env[k];
  }
  if (!authToken) {
    const k = Object.keys(env).find((k) => /TURSO.*AUTH_TOKEN$|AUTH_TOKEN$/.test(k) && /TURSO|DATABASE|DB/.test(k));
    if (k) authToken = env[k];
  }
  return { url: url || 'file:local.db', authToken };
}

async function makeClient() {
  const { url, authToken } = findEnv();
  if (url.startsWith('file:')) {
    const { createClient } = await import('@libsql/client');
    return createClient({ url });
  }
  const { createClient } = await import('@libsql/client/web');
  return createClient({ url, authToken });
}

export async function db() {
  if (!clientPromise) clientPromise = makeClient();
  const client = await clientPromise;
  if (!ready) ready = ensureSchema(client).catch((e) => { ready = null; throw e; });
  await ready;
  return client;
}

const COLS = ['id', 'section', 'grp', 'kind', 'sort', 'title', 'body', 'extra', 'owner', 'fig', 'checkable', 'meta'];

async function ensureSchema(client) {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL, grp TEXT, kind TEXT, sort INTEGER,
      title TEXT, body TEXT, extra TEXT, owner TEXT, fig TEXT,
      checkable INTEGER DEFAULT 0, meta TEXT,
      done INTEGER DEFAULT 0, done_by TEXT, done_at TEXT,
      orig_title TEXT, orig_body TEXT, orig_extra TEXT, orig_owner TEXT,
      version INTEGER DEFAULT 1, edited_by TEXT, edited_at TEXT,
      rev INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`,
    `INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', 0)`,
    `CREATE TABLE IF NOT EXISTS history (
      at TEXT, item_id TEXT, who TEXT, action TEXT, old TEXT, new TEXT
    )`,
  ], 'write');
  // Inserta el contenido inicial solo de los elementos que aún no existen:
  // nunca sobrescribe lo que el grupo haya editado.
  const stmts = seed.map((it) => ({
    sql: `INSERT OR IGNORE INTO items (${COLS.join(',')}, orig_title, orig_body, orig_extra, orig_owner)
          VALUES (${COLS.map(() => '?').join(',')}, ?, ?, ?, ?)`,
    args: [...COLS.map((c) => it[c] ?? null), it.title, it.body, it.extra, it.owner],
  }));
  await client.batch(stmts, 'write');
}

export const PERSONS = ['María', 'Ale', 'Javi', 'Pedro', 'Todos'];
