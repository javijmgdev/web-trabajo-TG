// Única función de la API (Vercel Functions, estándar web fetch).
//   GET  /api?since=<rev>              -> cambios desde esa revisión
//   POST /api  {action:'check', id, done, who}
//   POST /api  {action:'edit', id, version, title, body, extra, owner, who}
//   POST /api  {action:'restore', id, version, who}
// Si existe la variable GROUP_KEY, todas las peticiones deben llevar la cabecera x-group-key.
import { db, PERSONS } from '../lib/db.js';

const FIELDS = 'id, section, grp, kind, sort, title, body, extra, owner, fig, checkable, meta, done, done_by, done_at, version, edited_by, edited_at, rev, (title IS NOT orig_title OR body IS NOT orig_body OR extra IS NOT orig_extra OR owner IS NOT orig_owner) AS changed';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function authorized(request) {
  const key = process.env.GROUP_KEY;
  if (!key) return true;
  return request.headers.get('x-group-key') === key;
}

const clean = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const now = () => new Date().toISOString();

async function nextRev(tx) {
  const r = await tx.execute(`UPDATE meta SET v = v + 1 WHERE k = 'rev' RETURNING v`);
  return Number(r.rows[0].v);
}

async function getState(url) {
  const client = await db();
  const since = Number(url.searchParams.get('since') || 0);
  const r = await client.execute(`SELECT v FROM meta WHERE k = 'rev'`);
  const rev = Number(r.rows[0].v);
  if (since > 0 && since >= rev) return json({ rev, items: [], full: false });
  const q = since > 0
    ? await client.execute({ sql: `SELECT ${FIELDS} FROM items WHERE rev > ? ORDER BY sort`, args: [since] })
    : await client.execute(`SELECT ${FIELDS} FROM items ORDER BY sort`);
  return json({ rev, items: q.rows.map(row), full: since === 0 });
}

const row = (r) => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : {}, changed: Number(r.changed) === 1 });

async function one(tx, id) {
  const r = await tx.execute({ sql: `SELECT ${FIELDS} FROM items WHERE id = ?`, args: [id] });
  return r.rows[0] ? row(r.rows[0]) : null;
}

async function post(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'El cuerpo de la petición no es JSON válido.' }, 400); }
  const who = PERSONS.includes(b.who) ? b.who : null;
  if (!who) return json({ error: 'Elige quién eres antes de guardar cambios.' }, 400);
  const id = clean(b.id, 40);
  const client = await db();
  const tx = await client.transaction('write');
  try {
    const cur = await one(tx, id);
    if (!cur) { await tx.rollback(); return json({ error: 'Ese elemento no existe.' }, 404); }

    if (b.action === 'check') {
      if (!cur.checkable) { await tx.rollback(); return json({ error: 'Este elemento no se puede marcar.' }, 400); }
      const rev = await nextRev(tx);
      const done = b.done ? 1 : 0;
      await tx.execute({ sql: `UPDATE items SET done = ?, done_by = ?, done_at = ?, rev = ? WHERE id = ?`, args: [done, done ? who : null, done ? now() : null, rev, id] });
      await tx.execute({ sql: `INSERT INTO history VALUES (?, ?, ?, ?, ?, ?)`, args: [now(), id, who, done ? 'marcar' : 'desmarcar', null, null] });
    } else if (b.action === 'edit' || b.action === 'restore') {
      if (Number(b.version) !== Number(cur.version)) {
        await tx.rollback();
        return json({ error: 'Otra persona ha cambiado este cuadro mientras lo editabas. Revisa su versión y vuelve a guardar.', item: cur }, 409);
      }
      let title, body, extra, owner;
      if (b.action === 'restore') {
        const o = (await tx.execute({ sql: `SELECT orig_title, orig_body, orig_extra, orig_owner FROM items WHERE id = ?`, args: [id] })).rows[0];
        ({ orig_title: title, orig_body: body, orig_extra: extra, orig_owner: owner } = o);
      } else {
        title = clean(b.title, 300).trim();
        body = clean(b.body, 4000).replace(/\r/g, '').trim();
        extra = clean(b.extra, 600).trim();
        owner = PERSONS.includes(b.owner) ? b.owner : cur.owner;
        if (!title) { await tx.rollback(); return json({ error: 'El título no puede quedar vacío.' }, 400); }
      }
      const rev = await nextRev(tx);
      await tx.execute({
        sql: `UPDATE items SET title = ?, body = ?, extra = ?, owner = ?, version = version + 1, edited_by = ?, edited_at = ?, rev = ? WHERE id = ?`,
        args: [title, body, extra, owner, who, now(), rev, id],
      });
      await tx.execute({
        sql: `INSERT INTO history VALUES (?, ?, ?, ?, ?, ?)`,
        args: [now(), id, who, b.action === 'restore' ? 'restaurar' : 'editar',
          JSON.stringify({ title: cur.title, body: cur.body, extra: cur.extra, owner: cur.owner }),
          JSON.stringify({ title, body, extra, owner })],
      });
    } else {
      await tx.rollback();
      return json({ error: 'Acción desconocida.' }, 400);
    }
    const item = await one(tx, id);
    await tx.commit();
    return json({ ok: true, item, rev: item.rev });
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  } finally {
    tx.close();
  }
}

export default {
  async fetch(request) {
    try {
      if (!authorized(request)) return json({ error: 'Clave del grupo incorrecta.' }, 401);
      const url = new URL(request.url);
      if (request.method === 'GET') return await getState(url);
      if (request.method === 'POST') return await post(request);
      return json({ error: 'Método no permitido.' }, 405);
    } catch (e) {
      console.error(e);
      return json({ error: 'Error del servidor al acceder a la base de datos.' }, 500);
    }
  },
};
