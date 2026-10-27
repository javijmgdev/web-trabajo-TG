(() => {
'use strict';

// ---------------- configuración ----------------
const PEOPLE = [
  { name: 'María', key: 'maria', ini: 'MA', block: 'Motivación y conceptos' },
  { name: 'Ale', key: 'ale', ini: 'AL', block: 'El algoritmo y sus propiedades' },
  { name: 'Javi', key: 'javi', ini: 'JA', block: 'Estrategias y ejemplo' },
  { name: 'Pedro', key: 'pedro', ini: 'PE', block: 'Experimentos y conclusiones' },
  { name: 'Todos', key: 'todos', ini: '★', block: 'Cierre y tareas comunes' },
];
const P = Object.fromEntries(PEOPLE.map((p) => [p.name, p]));
const pc = (name) => `var(--p-${(P[name] || P.Todos).key})`;
const REVIEW = [['María', 'Ale'], ['Ale', 'Javi'], ['Javi', 'Pedro'], ['Pedro', 'María']];
const TAG = { fig: 'Figura', clave: 'Clave', ojo: 'Ojo', link: 'Conexión con clase', idea: 'Idea' };
const CHECK_LABEL = { slide: 'Hecha', doc: 'Redactado', qa: 'Practicada', check: 'Hecho' };
const POLL_MS = 4000;
const LS = { me: 'tg11-me', key: 'tg11-key', local: 'tg11-local-v1', filter: 'tg11-filter', hide: 'tg11-hide' };

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};

// ---------------- estado ----------------
const S = {
  items: new Map(), rev: 0, mode: 'server',
  me: ls.get(LS.me), key: ls.get(LS.key, ''),
  filter: ls.get(LS.filter, 'all'), hideDone: ls.get(LS.hide, false),
  open: new Set(), editing: null, polling: null, lastSync: 0,
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------- formato de texto ----------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function math(t) {
  t = t.replace(/\\chi/g, 'χ').replace(/\\ge/g, '≥').replace(/\\le/g, '≤').replace(/\\cdot/g, '·').replace(/\\setminus/g, '∖')
       .replace(/&#39;/g, '′').replace(/-/g, '−');
  t = t.replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^(\w+)/g, '<sup>$1</sup>')
       .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>');
  return `<span class="m">${t}</span>`;
}
function fmt(s) {
  return esc(s).split(/(\$[^$]*\$)/).map((p) => p.length > 1 && p.startsWith('$') && p.endsWith('$')
    ? math(p.slice(1, -1)) : p.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')).join('');
}
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

// ---------------- iconos ----------------
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

// ---------------- piezas de tarjeta ----------------
const chip = (name, pre = '') => `<span class="chip" style="--pc:${pc(name)}"><i></i>${pre}<b>${esc(name)}</b></span>`;
const editBtn = (it) => `<button class="ibtn" type="button" data-edit="${esc(it.id)}" aria-label="Editar «${esc(it.title)}»" title="Editar">${ICON_EDIT}</button>`;
const checkBox = (it) => it.checkable
  ? `<label class="chk"><input type="checkbox" data-check="${esc(it.id)}" ${it.done ? 'checked' : ''}><span>${CHECK_LABEL[it.kind] || 'Hecho'}</span></label>` : '';
function stamp(it) {
  const parts = [];
  if (it.done && it.done_by) parts.push(`${CHECK_LABEL[it.kind] || 'Hecho'} por ${esc(it.done_by)} ${ago(it.done_at)}`);
  if (it.changed && it.edited_by) parts.push(`<span class="edited">Editado por ${esc(it.edited_by)} ${ago(it.edited_at)}</span>`);
  return parts.length ? `<span class="stamp">${parts.join(' · ')}</span>` : '<span class="stamp"></span>';
}
const footer = (it, left) => `<div class="card-f">${left ?? chip(it.owner)}<div class="tools">${stamp(it)}${editBtn(it)}</div></div>`;
const doneCls = (it) => (it.checkable && it.done ? ' is-done' : '');

const R = {
  slide(it, lane) {
    return `<article class="card${doneCls(it)}" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="${it.checkable ? 1 : 0}" data-done="${it.done ? 1 : 0}" style="--pc:${pc(lane.owner)}">
      <div class="card-h"><span class="num">${it.meta.num ?? ''}</span><h4>${fmt(it.title)}</h4>${checkBox(it)}</div>
      ${lines(it.body).length ? `<ul>${lines(it.body).map((l) => `<li>${fmt(l)}</li>`).join('')}</ul>` : ''}
      ${it.extra ? `<p class="vis"><span class="lab">Visual</span><span>${fmt(it.extra)}</span></p>` : ''}
      ${footer(it)}</article>`;
  },
  note(it) {
    const tag = it.meta.tag || 'idea';
    const fig = it.fig && window.FIGS && window.FIGS[it.fig] ? `<div class="paper">${window.FIGS[it.fig]}</div>` : '';
    return `<article class="card note ${tag}" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="0">
      <span class="lab tag">${TAG[tag] || 'Nota'}</span><h4>${fmt(it.title)}</h4>${fig}<p>${fmt(it.body)}</p>${footer(it)}</article>`;
  },
  rub(it) {
    return `<article class="card crit" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="0">
      <div class="card-h" style="grid-template-columns:minmax(0,1fr) auto"><h4>${fmt(it.title)}</h4><span class="score" title="Puntuación posible"><span>1</span><span>0,7</span><span>0,3</span><span>0</span></span></div>
      <p class="exc"><span class="lab">Excelente</span><span>${fmt(it.body)}</span></p>
      <p>${fmt(it.extra)}</p>${footer(it)}</article>`;
  },
  doc(it) {
    return `<article class="card rowc${doneCls(it)}" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="1" data-done="${it.done ? 1 : 0}">
      <div class="card-h" style="grid-template-columns:minmax(0,1fr) auto"><span class="t">${fmt(it.title)}</span>${checkBox(it)}</div>
      <span class="d">${fmt(it.body)}</span>${footer(it)}</article>`;
  },
  bib(it) {
    const url = it.extra && /^https?:\/\//.test(it.extra) ? ` <a href="${esc(it.extra)}" target="_blank" rel="noopener">${esc(it.extra)}</a>` : '';
    return `<article class="card rowc" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="0">
      <div style="display:flex;gap:10px;align-items:baseline"><span class="lab">${esc(it.title)}</span><span class="d" style="color:var(--ink)">${fmt(it.body)}${url}</span></div>
      ${footer(it, chip(it.owner, 'Revisa '))}</article>`;
  },
  qa(it) {
    return `<article class="card qa${doneCls(it)}" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="1" data-done="${it.done ? 1 : 0}">
      <div class="card-h" style="grid-template-columns:minmax(0,1fr) auto"><h4>${fmt(it.title)}</h4>${checkBox(it)}</div>
      <details ${S.open.has(it.id) ? 'open' : ''} data-details="${esc(it.id)}"><summary>Ver respuesta</summary><p>${fmt(it.body)}</p></details>
      ${footer(it, `<span class="pairs">${chip(it.meta.block || 'Todos', 'Bloque de ')}${chip(it.owner, 'Practica ')}</span>`)}</article>`;
  },
  check(it) {
    return `<div class="card ck${doneCls(it)}" data-id="${esc(it.id)}" data-owner="${esc(it.owner)}" data-chk="1" data-done="${it.done ? 1 : 0}">
      <input type="checkbox" data-check="${esc(it.id)}" ${it.done ? 'checked' : ''} aria-label="${esc(it.title)}">
      <span class="t" style="font-size:14.5px">${fmt(it.title)}${it.done && it.done_by ? ` <span class="stamp">· ${esc(it.done_by)} ${ago(it.done_at)}</span>` : ''}${it.changed ? ' <span class="stamp edited">· editado</span>' : ''}</span>
      ${chip(it.owner)}${editBtn(it)}</div>`;
  },
};

// ---------------- render ----------------
const bySection = (sec) => [...S.items.values()].filter((i) => i.section === sec).sort((a, b) => a.sort - b.sort);

function renderLane(lane) {
  const slides = bySection('slide').filter((s) => s.grp === lane.grp);
  const notes = bySection('note').filter((s) => s.grp === lane.grp);
  const col = lane.meta.col === 6 ? '★' : lane.meta.col;
  return `<section class="panel lane" data-lane="${esc(lane.grp)}" data-id="${esc(lane.id)}" data-owner="${esc(lane.owner)}" style="--pc:${pc(lane.owner)}">
    <header class="lane-h"><span class="node" aria-hidden="true">${col}</span>
      <div><h3>${fmt(lane.title)}</h3><div class="lane-sub">${chip(lane.owner)}<span>${esc(lane.extra)} % del tiempo</span><span>${slides.length} diapositivas</span>${lane.changed && lane.edited_by ? `<span class="stamp edited">Editado por ${esc(lane.edited_by)}</span>` : ''}${editBtn(lane)}</div></div>
      <div class="lane-prog"><b data-lprog="${esc(lane.grp)}">0 / 0</b><div class="meter"><i data-lbar="${esc(lane.grp)}"></i></div></div></header>
    <div class="lane-body"><div><p class="colhead">Diapositivas</p><div class="slides" style="margin-top:10px">${slides.map((s) => R.slide(s, lane)).join('')}</div></div>
      <aside class="notes"><p class="colhead">Apoyo</p>${notes.map((n) => R.note(n)).join('')}</aside></div></section>`;
}

function renderAll() {
  const lanes = bySection('lane');
  $('#timebar').innerHTML = lanes.map((l) => `<div class="seg" style="flex:${Number(l.extra) || 1};--pc:${pc(l.owner)}"><span>${fmt(l.title)} · ${esc(l.owner)}</span><b>${esc(l.extra)} %</b></div>`).join('');
  $('#lanes').innerHTML = lanes.map(renderLane).join('');
  const rub = bySection('rub');
  const groups = [...new Set(rub.map((r) => r.grp))];
  $('#rub').innerHTML = groups.map((g) => `<div class="panel rgroup"><div class="rgroup-h"><h3>${esc(g)}</h3><span>4 criterios · 0–1 punto cada uno</span></div>${rub.filter((r) => r.grp === g).map(R.rub).join('')}</div>`).join('');
  $('#doc').innerHTML = bySection('doc').map(R.doc).join('');
  $('#pairs').innerHTML = `<span style="width:100%">Revisión cruzada:</span>` + REVIEW.map(([a, b]) => `<span>${chip(a)} revisa a ${chip(b)}</span>`).join('');
  $('#bib').innerHTML = bySection('bib').map(R.bib).join('');
  $('#qa').innerHTML = bySection('qa').map(R.qa).join('');
  $('#check').innerHTML = bySection('check').map(R.check).join('');
  renderTeam(); renderFilters(); refreshDerived();
}

function rerenderItem(it) {
  if (it.section === 'lane') { const el = $(`.lane[data-lane="${CSS.escape(it.grp)}"]`); if (el) el.outerHTML = renderLane(it); renderTimebar(); return; }
  const el = $(`[data-id="${CSS.escape(it.id)}"]`);
  if (!el) return;
  let html;
  if (it.section === 'slide') html = R.slide(it, S.items.get('lane-' + it.grp) || { owner: 'Todos' });
  else html = R[it.section](it);
  el.outerHTML = html;
}
function renderTimebar() {
  $('#timebar').innerHTML = bySection('lane').map((l) => `<div class="seg" style="flex:${Number(l.extra) || 1};--pc:${pc(l.owner)}"><span>${fmt(l.title)} · ${esc(l.owner)}</span><b>${esc(l.extra)} %</b></div>`).join('');
}

function renderTeam() {
  $('#team').innerHTML = PEOPLE.slice(0, 4).map((p) => `<button type="button" class="pcard" data-person="${p.name}" style="--pc:${pc(p.name)}" aria-pressed="false">
    <div class="pcard-top"><span class="av">${p.ini}</span><div><h3>${p.name}</h3><p data-pblock="${p.name}">${esc(p.block)}</p></div></div>
    <div class="meter"><i data-pbar="${p.name}"></i></div>
    <div class="meta"><span data-pprog="${p.name}">0 / 0</span><span>tareas propias</span></div>
    <span class="next" data-pnext="${p.name}"></span></button>`).join('');
}
function renderFilters() {
  const opts = [{ v: 'all', label: 'Todo el grupo' }, ...PEOPLE.slice(0, 4).map((p) => ({ v: p.name, label: p.name }))];
  $('#filters').innerHTML = `<div class="gutter"><div class="inner"><span class="lbl">Ver:</span>${opts.map((o) => `<button type="button" class="fchip" data-filter="${o.v}" aria-pressed="${S.filter === o.v}" ${o.v !== 'all' ? `style="--pc:${pc(o.v)}"` : ''}>${o.v !== 'all' ? '<i></i>' : ''}${o.label}</button>`).join('')}
    <label class="toggle"><input type="checkbox" id="hideDone" ${S.hideDone ? 'checked' : ''}><span>Ocultar lo ya hecho</span></label></div></div>`;
}

function refreshDerived() {
  const all = [...S.items.values()].filter((i) => i.checkable);
  const done = all.filter((i) => i.done).length;
  $('#allProg').textContent = `${done} / ${all.length} tareas`;
  $('#allBar').style.width = all.length ? `${(100 * done) / all.length}%` : '0';
  for (const p of PEOPLE.slice(0, 4)) {
    const mine = all.filter((i) => i.owner === p.name);
    const d = mine.filter((i) => i.done).length;
    const bar = $(`[data-pbar="${p.name}"]`); if (bar) bar.style.width = mine.length ? `${(100 * d) / mine.length}%` : '0';
    const pr = $(`[data-pprog="${p.name}"]`); if (pr) pr.textContent = `${d} / ${mine.length}`;
    const lane = bySection('lane').find((l) => l.owner === p.name);
    const pb = $(`[data-pblock="${p.name}"]`); if (pb && lane) pb.innerHTML = fmt(lane.title);
    const next = mine.filter((i) => !i.done).sort((a, b) => a.sort - b.sort)[0];
    const nx = $(`[data-pnext="${p.name}"]`); if (nx) nx.innerHTML = next ? `Siguiente: ${fmt(next.title)}` : 'Todo hecho';
  }
  for (const lane of bySection('lane')) {
    const sl = bySection('slide').filter((s) => s.grp === lane.grp);
    const d = sl.filter((s) => s.done).length;
    const b = $(`[data-lprog="${CSS.escape(lane.grp)}"]`); if (b) b.textContent = `${d} / ${sl.length} hechas`;
    const m = $(`[data-lbar="${CSS.escape(lane.grp)}"]`); if (m) m.style.width = sl.length ? `${(100 * d) / sl.length}%` : '0';
  }
  applyFilter();
}

function applyFilter() {
  const f = S.filter;
  $$('[data-person]').forEach((b) => { const on = b.dataset.person === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === f));
  $$('#app [data-id]').forEach((el) => {
    if (el.classList.contains('lane')) return;
    const ownerOk = f === 'all' || el.dataset.owner === f || el.dataset.owner === 'Todos';
    const doneOk = !(S.hideDone && el.dataset.chk === '1' && el.dataset.done === '1');
    el.hidden = !(ownerOk && doneOk);
  });
  $$('.lane').forEach((lane) => { lane.hidden = !$$('.card[data-id]', lane).some((c) => !c.hidden); });
}

// ---------------- datos: servidor o modo local ----------------
const headers = () => ({ 'content-type': 'application/json', ...(S.key ? { 'x-group-key': S.key } : {}) });
function setSync(state, text) { const el = $('#sync'); el.dataset.s = state; $('span', el).textContent = text; }

function normalize(it) {
  return { ...it, meta: typeof it.meta === 'string' ? JSON.parse(it.meta || '{}') : (it.meta || {}), done: Number(it.done) || 0, checkable: Number(it.checkable) || 0, version: Number(it.version) || 1, rev: Number(it.rev) || 0, sort: Number(it.sort) || 0 };
}

async function api(method, body, since) {
  const r = await fetch(method === 'GET' ? `/api?since=${since || 0}` : '/api', { method, headers: headers(), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let data = null;
  try { data = await r.json(); } catch { /* no es JSON */ }
  if (!data) throw Object.assign(new Error('sin servidor'), { offline: true });
  if (!r.ok) throw Object.assign(new Error(data.error || 'Error'), { status: r.status, data });
  return data;
}

function startLocal() {
  S.mode = 'local';
  const saved = ls.get(LS.local, {});
  S.items = new Map((window.SEED || []).map((it) => {
    const base = normalize({ ...it, version: 1, done: 0, changed: false, orig: { title: it.title, body: it.body, extra: it.extra, owner: it.owner } });
    return [it.id, saved[it.id] ? { ...base, ...saved[it.id] } : base];
  }));
  $('#localBanner').hidden = false;
  setSync('local', 'Modo local');
  renderAll();
}
function saveLocal() {
  const out = {};
  for (const it of S.items.values()) {
    if (it.done || it.changed) out[it.id] = { title: it.title, body: it.body, extra: it.extra, owner: it.owner, done: it.done, done_by: it.done_by, done_at: it.done_at, changed: it.changed, edited_by: it.edited_by, edited_at: it.edited_at, version: it.version };
  }
  ls.set(LS.local, out);
}

async function loadFull() {
  setSync('busy', 'Conectando…');
  try {
    const d = await api('GET', null, 0);
    S.items = new Map(d.items.map((it) => [it.id, normalize(it)]));
    S.rev = d.rev; S.mode = 'server'; S.lastSync = Date.now();
    renderAll(); setSync('ok', 'Sincronizado');
    startPolling();
  } catch (e) {
    if (e.status === 401) { openWho(true, S.key ? 'La clave no es correcta.' : ''); setSync('err', 'Falta la clave'); return; }
    startLocal();
  }
}

async function poll() {
  if (S.mode !== 'server' || document.hidden) return;
  try {
    const d = await api('GET', null, S.rev);
    if (d.items.length) {
      for (const raw of d.items) {
        const it = normalize(raw);
        const prev = S.items.get(it.id);
        S.items.set(it.id, it);
        if (prev && (prev.title !== it.title || prev.body !== it.body || prev.extra !== it.extra || prev.owner !== it.owner || prev.done !== it.done || prev.changed !== it.changed)) rerenderItem(it);
      }
      refreshDerived();
    }
    S.rev = d.rev; S.lastSync = Date.now();
    setSync('ok', 'Sincronizado');
  } catch (e) {
    setSync('err', e.status === 401 ? 'Falta la clave' : 'Sin conexión');
  }
}
function startPolling() { clearInterval(S.polling); S.polling = setInterval(poll, POLL_MS); }

function applyServerItem(raw) {
  const it = normalize(raw);
  S.items.set(it.id, it);
  if (raw.rev && Number(raw.rev) === S.rev + 1) S.rev = Number(raw.rev);
  rerenderItem(it); refreshDerived();
}

// ---------------- acciones ----------------
function needMe() { if (!S.me) { openWho(false); toast('Elige primero quién eres.'); return true; } return false; }

async function toggleCheck(id, done, input) {
  if (needMe()) { input.checked = !done; return; }
  const it = S.items.get(id); if (!it) return;
  if (S.mode === 'local') {
    Object.assign(it, { done: done ? 1 : 0, done_by: done ? S.me : null, done_at: done ? new Date().toISOString() : null });
    saveLocal(); rerenderItem(it); refreshDerived(); return;
  }
  const prev = { done: it.done, done_by: it.done_by, done_at: it.done_at };
  Object.assign(it, { done: done ? 1 : 0, done_by: done ? S.me : null, done_at: done ? new Date().toISOString() : null });
  rerenderItem(it); refreshDerived(); setSync('busy', 'Guardando…');
  try { const d = await api('POST', { action: 'check', id, done, who: S.me }); applyServerItem(d.item); setSync('ok', 'Guardado'); }
  catch (e) { Object.assign(it, prev); rerenderItem(it); refreshDerived(); setSync('err', 'Error'); toast(e.message || 'No se pudo guardar.'); }
}

const FORMS = {
  slide: [['title', 'Título de la diapositiva', 'input'], ['body', 'Puntos', 'textarea', 'Un punto por línea.'], ['extra', 'Visual propuesto', 'input'], ['owner', 'Responsable', 'owner']],
  note: [['title', 'Título', 'input'], ['body', 'Texto', 'textarea'], ['owner', 'Responsable', 'owner']],
  lane: [['title', 'Nombre del bloque', 'input'], ['extra', '% del tiempo', 'input', 'Solo el número.'], ['owner', 'Responsable', 'owner']],
  rub: [['title', 'Criterio', 'input'], ['body', 'Qué pide para «Excelente»', 'textarea'], ['extra', 'Qué haremos', 'textarea'], ['owner', 'Responsable', 'owner']],
  doc: [['title', 'Apartado', 'input'], ['body', 'Qué contiene', 'textarea'], ['owner', 'Responsable', 'owner']],
  bib: [['title', 'Tipo', 'input'], ['body', 'Referencia', 'textarea', 'Usa *cursiva* para títulos de revista o libro.'], ['extra', 'Enlace (opcional)', 'input'], ['owner', 'Revisa', 'owner']],
  qa: [['title', 'Pregunta', 'input'], ['body', 'Respuesta', 'textarea'], ['owner', 'La practica', 'owner']],
  check: [['title', 'Tarea', 'input'], ['owner', 'Responsable', 'owner']],
};

function fillForm(it) {
  const fields = FORMS[it.kind] || FORMS.note;
  $('#editFields').innerHTML = `<div style="display:grid;gap:12px">${fields.map(([f, label, type, hint]) => {
    const id = `ef-${f}`;
    let ctl;
    if (type === 'textarea') ctl = `<textarea id="${id}" name="${f}">${esc(it[f])}</textarea>`;
    else if (type === 'owner') ctl = `<select id="${id}" name="${f}">${PEOPLE.map((p) => `<option ${p.name === it.owner ? 'selected' : ''}>${p.name}</option>`).join('')}</select>`;
    else ctl = `<input id="${id}" name="${f}" value="${esc(it[f])}">`;
    return `<div class="field"><label for="${id}">${label}</label>${ctl}${hint ? `<small>${hint}</small>` : ''}</div>`;
  }).join('')}<small style="color:var(--faint)">Fórmulas entre dólares, por ejemplo $G'$ o $\\chi(G)$.</small></div>`;
  $('#editSub').textContent = it.changed && it.edited_by ? `Última edición: ${it.edited_by}, ${ago(it.edited_at)}.` : 'Texto original.';
  $('#restoreBtn').hidden = !it.changed;
}
function openEdit(id) {
  if (needMe()) return;
  const it = S.items.get(id); if (!it) return;
  S.editing = { id, version: it.version };
  $('#editTitle').textContent = { slide: 'Editar diapositiva', note: 'Editar nota', lane: 'Editar bloque', rub: 'Editar criterio', doc: 'Editar apartado', bib: 'Editar referencia', qa: 'Editar pregunta', check: 'Editar tarea' }[it.kind] || 'Editar';
  $('#editErr').hidden = true;
  fillForm(it);
  $('#editDlg').showModal();
  setTimeout(() => $('#editFields input, #editFields textarea')?.focus(), 30);
}
function formValues() {
  const it = S.items.get(S.editing.id);
  const v = { title: it.title, body: it.body, extra: it.extra, owner: it.owner };
  $$('#editFields [name]').forEach((el) => { v[el.name] = el.value; });
  return v;
}
async function saveEdit(action) {
  const { id, version } = S.editing; const it = S.items.get(id);
  const v = action === 'restore' ? null : formValues();
  if (v && !v.title.trim()) { showErr('El título no puede quedar vacío.'); return; }
  $('#saveBtn').disabled = true;
  try {
    if (S.mode === 'local') {
      const nv = action === 'restore' ? { ...it.orig } : { title: v.title.trim(), body: v.body.trim(), extra: v.extra.trim(), owner: v.owner };
      Object.assign(it, nv, { version: it.version + 1, edited_by: S.me, edited_at: new Date().toISOString() });
      it.changed = ['title', 'body', 'extra', 'owner'].some((k) => (it[k] || '') !== (it.orig[k] || ''));
      saveLocal(); rerenderItem(it); refreshDerived();
    } else {
      setSync('busy', 'Guardando…');
      const d = await api('POST', { action, id, version, who: S.me, ...(v || {}) });
      applyServerItem(d.item); setSync('ok', 'Guardado');
    }
    $('#editDlg').close(); toast(action === 'restore' ? 'Texto original restaurado.' : 'Cambios guardados para todo el grupo.');
  } catch (e) {
    if (e.status === 409 && e.data?.item) {
      applyServerItem(e.data.item);
      S.editing.version = Number(e.data.item.version);
      fillForm(S.items.get(id));
      showErr(`${e.message} Se ha cargado el texto actual.`);
      setSync('ok', 'Sincronizado');
    } else { showErr(e.message || 'No se pudo guardar.'); setSync('err', 'Error'); }
  } finally { $('#saveBtn').disabled = false; }
}
function showErr(m) { const el = $('#editErr'); el.textContent = m; el.hidden = false; }

// ---------------- identidad ----------------
function renderMe() {
  const p = P[S.me];
  $('#meAv').textContent = p ? p.ini : '?';
  $('#meAv').style.setProperty('--pc', pc(S.me || 'Todos'));
  $('#meName').textContent = p ? p.name : '¿Quién eres?';
}
let pickedWho = null;
function openWho(needKey, err = '') {
  pickedWho = S.me;
  $('#whoGrid').innerHTML = PEOPLE.slice(0, 4).map((p) => `<button type="button" class="who-btn" data-who="${p.name}" aria-pressed="${p.name === S.me}" style="--pc:${pc(p.name)}"><span class="av">${p.ini}</span><span><b>${p.name}</b><br><small style="color:var(--muted)">${esc(p.block)}</small></span></button>`).join('');
  $('#keyField').hidden = !needKey; $('#keyInput').value = S.key || '';
  const e = $('#whoErr'); e.textContent = err; e.hidden = !err;
  if (!$('#whoDlg').open) $('#whoDlg').showModal();
}

// ---------------- avisos ----------------
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800); }

// ---------------- eventos ----------------
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-check]')) toggleCheck(t.dataset.check, t.checked, t);
  if (t.id === 'hideDone') { S.hideDone = t.checked; ls.set(LS.hide, S.hideDone); applyFilter(); }
});
document.addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edit]'); if (ed) { openEdit(ed.dataset.edit); return; }
  const f = e.target.closest('[data-filter]'); if (f) { S.filter = f.dataset.filter; ls.set(LS.filter, S.filter); applyFilter(); return; }
  const pcard = e.target.closest('[data-person]'); if (pcard) { S.filter = S.filter === pcard.dataset.person ? 'all' : pcard.dataset.person; ls.set(LS.filter, S.filter); applyFilter(); $('#exposicion').scrollIntoView({ behavior: 'smooth' }); return; }
  const w = e.target.closest('[data-who]'); if (w) { pickedWho = w.dataset.who; $$('[data-who]').forEach((b) => b.setAttribute('aria-pressed', b === w)); }
});
document.addEventListener('toggle', (e) => {
  const d = e.target; if (!d.matches?.('[data-details]')) return;
  if (d.open) S.open.add(d.dataset.details); else S.open.delete(d.dataset.details);
}, true);
$('#meBtn').addEventListener('click', () => openWho(!$('#keyField').hidden));
$('#whoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pickedWho) { const er = $('#whoErr'); er.textContent = 'Elige tu nombre.'; er.hidden = false; return; }
  const needKey = !$('#keyField').hidden;
  S.me = pickedWho; ls.set(LS.me, S.me); renderMe();
  $('#whoDlg').close();
  if (needKey) { S.key = $('#keyInput').value.trim(); ls.set(LS.key, S.key); loadFull(); }
});
$('#editForm').addEventListener('submit', (e) => { e.preventDefault(); saveEdit('edit'); });
$('#cancelBtn').addEventListener('click', () => $('#editDlg').close());
$('#restoreBtn').addEventListener('click', () => saveEdit('restore'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

// pestaña activa según la sección visible
const tabs = $$('.tabs a');
const io = new IntersectionObserver((ents) => {
  ents.forEach((en) => { if (en.isIntersecting) tabs.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id)); });
}, { rootMargin: '-40% 0px -55% 0px' });
$$('main > .sec').forEach((s) => io.observe(s));

// tiempos relativos al día
setInterval(() => { if (S.mode === 'server' && Date.now() - S.lastSync > 3 * POLL_MS && !document.hidden) setSync('err', 'Sin conexión'); }, POLL_MS);

// ---------------- arranque ----------------
renderMe();
loadFull().then(() => { if (!S.me && !$('#whoDlg').open) openWho(false); });
})();
