/* Negeri di Balik Daun — komponen UI bersama untuk index.html (Jalan Tikus), gedung-bundar.html, meja-hijau.html.
 *   NDBD.Feed       panel "Aktivitas": semua kejadian putaran ini + riwayat, nama pemain berwarna, "aksi terakhir" per pemain
 *   NDBD.CardQueue  kartu besar anti-banjir (maks 2 antre, durasi mengikuti kecepatan)
 *   NDBD.tips       gerbang tips pertama kali (hanya prompt milikmu, maks 1 per putaran, bisa dimatikan)
 *   NDBD.Chat       chat multiplayer lewat channel Supabase yang sama (event 'chat'), kanal Umum + DM opsional
 *   NDBD.TurnTimer  batas waktu tiap prompt manusia (dijalankan host; habis → pilihan bot)
 *   NDBD.Nego       jendela negosiasi (host) + banner hitung mundur & tombol Siap
 * Tidak ada dependensi; CSS disuntikkan sekali dan memakai token warna halaman (--panel, --line, --ink, dst.).
 */
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const CSS = `
.nd-feed { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin: 0 0 8px; font-size: 12px; }
.nd-feed-h { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-bottom: 1px solid var(--line); }
.nd-feed-h b { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.nd-feed-h button { border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 2px 8px; font-size: 11px; }
.nd-feed-list { max-height: 9.6em; overflow-y: auto; padding: 4px 8px 6px; line-height: 1.35; }
.nd-feed.open .nd-feed-list { max-height: 45dvh; }
.nd-feed-list .r { padding: 1px 0; color: var(--ink); }
.nd-feed-list .r.pv { color: var(--muted); font-style: italic; }
.nd-feed-list .r.baru { animation: ndflash 1.4s; border-radius: 4px; }
.nd-feed-list .g { font-size: 10.5px; font-weight: 800; color: var(--muted); margin: 6px 0 2px; text-transform: uppercase; letter-spacing: .05em; }
@keyframes ndflash { from { background: var(--gold-soft); } }
.nd-last { font-size: 10.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.nd-fab { position: fixed; right: 12px; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 18; width: 48px; height: 48px; border-radius: 50%;
  border: 1px solid var(--line); background: var(--panel); box-shadow: 0 4px 14px rgba(0,0,0,.25); font-size: 22px; }
.nd-fab .bd { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--danger); color: #fff; font-size: 11px; font-weight: 800; line-height: 18px; padding: 0 4px; }
.nd-chat { position: fixed; left: 0; right: 0; bottom: 0; z-index: 26; max-width: 540px; margin: 0 auto; background: var(--panel); border: 1px solid var(--line);
  border-radius: 16px 16px 0 0; box-shadow: 0 -6px 24px rgba(0,0,0,.3); display: flex; flex-direction: column; height: min(62dvh, 460px); padding-bottom: env(safe-area-inset-bottom); }
.nd-chat-h { display: flex; gap: 6px; align-items: center; padding: 8px 8px 6px; border-bottom: 1px solid var(--line); }
.nd-tabs { flex: 1; display: flex; gap: 4px; overflow-x: auto; }
.nd-tabs button { white-space: nowrap; border: 1px solid var(--line); background: var(--bg); border-radius: 999px; padding: 4px 10px; font-size: 12px; position: relative; }
.nd-tabs button.on { background: var(--leaf); color: #fff; border-color: var(--leaf); }
.nd-tabs button i { font-style: normal; color: var(--danger); font-weight: 800; margin-left: 3px; }
.nd-tabs button.on i { color: #fff; }
.nd-chat-h .x { border: 0; background: none; font-size: 20px; padding: 0 6px; }
.nd-msgs { flex: 1; overflow-y: auto; padding: 8px 10px; font-size: 13.5px; }
.nd-msg { margin: 3px 0; }
.nd-msg .who { font-weight: 700; }
.nd-msg.me { text-align: right; }
.nd-msg .bub { display: inline-block; max-width: 85%; text-align: left; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 5px 9px; word-wrap: break-word; }
.nd-msg.me .bub { background: var(--leaf-soft); }
.nd-msg .sys { font-size: 11.5px; color: var(--muted); }
.nd-note { font-size: 11px; color: var(--muted); padding: 0 10px 4px; }
.nd-form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--line); }
.nd-form input { flex: 1; font: inherit; padding: 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); min-width: 0; }
.nd-form button { border: 0; background: var(--leaf); color: #fff; border-radius: 10px; padding: 0 14px; font-weight: 700; }
.nd-quick { display: flex; gap: 4px; flex-wrap: wrap; padding: 0 8px 6px; }
.nd-quick button { border: 1px solid var(--line); background: var(--bg); border-radius: 999px; padding: 3px 9px; font-size: 12px; }
.nd-nego { background: var(--gold-soft); border: 1px solid var(--gold); border-radius: 10px; padding: 7px 9px; margin: 6px 0; font-size: 13px; display: flex; gap: 8px; align-items: center; }
.nd-nego .tx { flex: 1; }
.nd-nego button { border: 0; background: var(--gold); color: #fff; border-radius: 9px; padding: 7px 12px; font-weight: 700; white-space: nowrap; }
.nd-nego button:disabled { opacity: .5; }
.nd-timer { font-weight: 800; font-variant-numeric: tabular-nums; }
.nd-timer.low { color: var(--danger); }
#tip .nd-tipoff, .nd-tipoff { border: 0; background: none; color: var(--muted); font-size: 12px; text-decoration: underline; padding: 0 4px; }
`;
  let cssDone = false;
  function injectCss() {
    if (cssDone || typeof document === 'undefined') return;
    cssDone = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  }

  // ---------- jam host (untuk hitung mundur di klien) ----------
  let clockOffset = 0; // Date.now() host − Date.now() lokal
  const hostNow = () => Date.now() + clockOffset;
  function syncClock(hostTs) { if (hostTs) clockOffset = hostTs - Date.now(); }
  function tick() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      const s = Math.max(0, Math.ceil((+el.dataset.deadline - hostNow()) / 1000));
      el.textContent = s + ' dtk'; el.classList.toggle('low', s <= 10);
    });
  }
  if (typeof setInterval !== 'undefined' && typeof document !== 'undefined') setInterval(tick, 500);

  // ---------- Feed ----------
  function Feed(el, { label = 'Putaran' } = {}) {
    injectCss();
    const items = new Map();
    let open = false, last = null, lastTop = 0;
    el.classList.add('nd-feed');
    function add(list, pv) {
      for (const l of list || []) {
        if (l.n === undefined) continue;
        const key = (pv ? 'p' : 'g') + l.n;
        if (!items.has(key)) items.set(key, { n: l.n, t: l.t, msg: l.msg, pv });
      }
    }
    function colorize(msg, players) {
      let h = esc(msg);
      for (const p of players) {
        if (!p.name) continue;
        const e = esc(p.name);
        h = h.split(e).join(`<b style="color:${p.color}">${e}</b>`);
      }
      return h;
    }
    function render(args) {
      last = args;
      const { log, priv, t, players } = args;
      add(log, false); add(priv, true);
      const all = [...items.values()].sort((a, b) => a.n - b.n);
      const rows = open ? all : all.filter((e) => e.t === t);
      const list = el.querySelector('.nd-feed-list');
      const nearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 30;
      const oldTop = list ? list.scrollTop : 0;
      let html = '', g = null;
      const top = all.length ? all[all.length - 1].n : 0;
      for (const e of rows) {
        if (e.t !== g) { g = e.t; html += `<div class="g">${e.t ? `${label} ${e.t}` : 'Persiapan'}</div>`; }
        html += `<div class="r ${e.pv ? 'pv' : ''} ${e.n === top && top !== lastTop ? 'baru' : ''}">${e.pv ? '🔒 ' : ''}${colorize(e.msg, players)}</div>`;
      }
      el.classList.toggle('open', open);
      el.innerHTML = `<div class="nd-feed-h"><b>📜 Aktivitas${t ? ` · ${label} ${t}` : ''}</b><button type="button">${open ? 'Putaran ini saja' : 'Riwayat lengkap'}</button></div>
        <div class="nd-feed-list">${html || '<div class="r" style="color:var(--muted)">Belum ada kejadian.</div>'}</div>`;
      const nl = el.querySelector('.nd-feed-list');
      nl.scrollTop = nearBottom ? nl.scrollHeight : oldTop;
      lastTop = top;
    }
    el.addEventListener('click', (ev) => {
      if (!ev.target.closest('.nd-feed-h button')) return;
      open = !open; lastTop = -1;
      if (last) render(last);
      if (!open) { const nl = el.querySelector('.nd-feed-list'); nl.scrollTop = nl.scrollHeight; }
    });
    /** baris log publik terakhir di putaran t yang menyebut nama ini (untuk "aksi terakhir" di kartu pemain) */
    function lastAction(name, t) {
      if (!name) return '';
      let hit = '';
      for (const e of items.values()) if (!e.pv && e.t === t && e.msg.includes(name)) hit = e.msg;
      return hit;
    }
    function reset() { items.clear(); open = false; lastTop = 0; }
    return { render, lastAction, reset };
  }

  // ---------- CardQueue ----------
  function CardQueue(el, { speed = () => 1000, max = 2 } = {}) {
    const q = []; let timer = 0;
    function next() {
      const c = q.shift();
      if (!c) { el.hidden = true; return; }
      el.className = 'cardpop ' + (c.kind || '');
      el.innerHTML = `<div class="kind">${esc(c.head)}</div><div class="big">${c.em}</div><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p><div class="close">tap untuk tutup</div>`;
      el.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(next, Math.max(1800, speed() * 2.2));
    }
    function show(kind, head, em, title, text) {
      q.push({ kind, head, em, title, text });
      while (q.length > max) q.shift();   // antrean terlalu panjang: buang kartu lama (tetap ada di Aktivitas)
      if (el.hidden) next();
    }
    el.onclick = next;
    return { show, next, clear() { q.length = 0; el.hidden = true; clearTimeout(timer); } };
  }

  // ---------- tips ----------
  const tips = {
    lastT: null,
    off() { return store.get('ndbd_tips_off', false); },
    setOff(v) { store.set('ndbd_tips_off', !!v); },
    /** Tips hanya untuk prompt milikmu (kunci 'p:'), maks 1 per putaran, dan tidak saat dimatikan. */
    allow(key, t) {
      if (this.off() || !key.startsWith('p:')) return false;
      if (this.lastT === t) return false;
      this.lastT = t;
      return true;
    },
    offButton() { return '<button class="nd-tipoff" type="button" onclick="NDBD.tips.setOff(true);this.closest(\'#tip\').hidden=true">Matikan tips</button>'; },
  };

  // ---------- Chat ----------
  /**
   * opts: myId, myName(), mySeat(), send(payload), channels() → [{id:'umum'|pid, label}], sysNote() → teks kecil di bawah tab (opsional)
   * Pesan: {pid, name, seat, to (pid|null), text, ts}. DM hanya diterima kalau pengirimnya ada di channels() penerima.
   */
  function Chat(opts) {
    injectCss();
    const msgs = new Map([['umum', []]]);
    const unread = new Map();
    let active = 'umum', enabled = false, lastSend = 0;
    const fab = document.createElement('button');
    fab.className = 'nd-fab'; fab.type = 'button'; fab.hidden = true; fab.title = 'Chat';
    fab.innerHTML = '💬<span class="bd" hidden></span>';
    const panel = document.createElement('div');
    panel.className = 'nd-chat'; panel.hidden = true;
    panel.innerHTML = `<div class="nd-chat-h"><div class="nd-tabs"></div><button class="x" type="button" aria-label="Tutup">✕</button></div>
      <div class="nd-note"></div><div class="nd-msgs"></div>
      <div class="nd-quick"></div>
      <form class="nd-form"><input maxlength="140" placeholder="Tulis pesan…" autocomplete="off"><button type="submit">Kirim</button></form>`;
    document.body.appendChild(fab); document.body.appendChild(panel);
    const QUICK = ['👍', '😂', '🤝 Deal?', '🙅 Tidak', '🤔 Curiga…', '⏳ Tunggu'];
    panel.querySelector('.nd-quick').innerHTML = QUICK.map((q) => `<button type="button">${esc(q)}</button>`).join('');

    const chanList = () => [{ id: 'umum', label: '💬 Umum' }].concat((opts.channels && opts.channels()) || []);
    function renderTabs() {
      const list = chanList();
      if (!list.some((c) => c.id === active)) active = 'umum';
      panel.querySelector('.nd-tabs').innerHTML = list.map((c) =>
        `<button type="button" data-ch="${esc(c.id)}" class="${c.id === active ? 'on' : ''}">${esc(c.label)}${unread.get(c.id) ? `<i>${unread.get(c.id)}</i>` : ''}</button>`).join('');
      const note = opts.sysNote ? opts.sysNote(active) : '';
      panel.querySelector('.nd-note').textContent = note || (active === 'umum' ? 'Semua pemain bisa membaca kanal ini.' : 'Pesan pribadi: hanya kalian berdua yang melihatnya di layar.');
    }
    function renderMsgs() {
      const box = panel.querySelector('.nd-msgs');
      const list = msgs.get(active) || [];
      const me = opts.myId;
      box.innerHTML = list.map((m) => (m.sys ? `<div class="nd-msg"><span class="sys">${esc(m.text)}</span></div>`
        : `<div class="nd-msg ${m.pid === me ? 'me' : ''}"><span class="bub">${m.pid === me ? '' : `<span class="who">${esc(m.name)}:</span> `}${esc(m.text)}</span></div>`)).join('')
        || '<div class="nd-msg"><span class="sys">Belum ada pesan. Negosiasi, gertakan, dan janji (yang tidak mengikat) dimulai di sini.</span></div>';
      box.scrollTop = box.scrollHeight;
    }
    function renderBadge() {
      let n = 0; for (const v of unread.values()) n += v;
      const bd = fab.querySelector('.bd'); bd.hidden = !n; bd.textContent = n > 9 ? '9+' : n;
    }
    function isOpen() { return !panel.hidden; }
    function open(ch) {
      if (!enabled) return;
      if (ch) active = ch;
      panel.hidden = false; unread.delete(active);
      renderTabs(); renderMsgs(); renderBadge();
    }
    function close() { panel.hidden = true; }
    function push(ch, m) {
      if (!msgs.has(ch)) msgs.set(ch, []);
      const L = msgs.get(ch); L.push(m); if (L.length > 150) L.shift();
      if (!(isOpen() && active === ch) && m.pid !== opts.myId) unread.set(ch, (unread.get(ch) || 0) + 1);
      if (isOpen()) { renderTabs(); if (active === ch) renderMsgs(); }
      renderBadge();
    }
    function receive(m) {
      if (!m || typeof m.text !== 'string') return;
      const me = opts.myId;
      if (m.to && m.to !== me && m.pid !== me) return;
      let ch = 'umum';
      if (m.to) {
        ch = m.pid === me ? m.to : m.pid;
        if (m.pid !== me && !chanList().some((c) => c.id === ch)) return; // jalur DM tidak diizinkan
      }
      push(ch, { pid: m.pid, name: String(m.name || '?').slice(0, 20), text: m.text.slice(0, 140), ts: m.ts });
    }
    function sendText(text) {
      text = String(text || '').trim().slice(0, 140);
      if (!text || !enabled) return;
      const now = Date.now();
      if (now - lastSend < 1000) return;
      lastSend = now;
      const m = { pid: opts.myId, name: opts.myName(), seat: opts.mySeat ? opts.mySeat() : -1, to: active === 'umum' ? null : active, text, ts: now };
      opts.send(m); receive(m);
    }
    function system(text) { push('umum', { sys: true, text }); }
    function setEnabled(v) {
      enabled = !!v; fab.hidden = !enabled;
      if (!enabled) { close(); }
    }
    function reset() { msgs.clear(); msgs.set('umum', []); unread.clear(); active = 'umum'; renderBadge(); }
    fab.onclick = () => (isOpen() ? close() : open());
    panel.querySelector('.x').onclick = close;
    panel.querySelector('.nd-tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-ch]'); if (b) open(b.dataset.ch); });
    panel.querySelector('.nd-quick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) sendText(b.textContent); });
    panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const i = panel.querySelector('input'); sendText(i.value); i.value = ''; });
    return { receive, open, close, isOpen, setEnabled, system, reset, refresh() { if (isOpen()) renderTabs(); } };
  }

  // ---------- TurnTimer (host) ----------
  /** Panggil watch(S) di setiap onUpdate host. Prompt manusia yang tidak dijawab dalam `seconds` dijawab dengan pilihan bot. */
  function TurnTimer({ seconds = 45, answer, onTimeout }) {
    let curId = 0, to = 0;
    function watch(S) {
      const p = S.prompt;
      if (!p || S.players[p.seat].bot || S.phase !== 'play') { if (!p) { curId = 0; clearTimeout(to); } S.deadline = null; return; }
      if (p.id === curId) return;
      curId = p.id;
      S.deadline = Date.now() + seconds * 1000;
      clearTimeout(to);
      const id = p.id;
      to = setTimeout(() => {
        if (S.prompt && S.prompt.id === id && S.phase === 'play') {
          const q = S.prompt;
          if (answer(q.seat, q.id, q.bot) && onTimeout) onTimeout(q.seat);
        }
      }, seconds * 1000);
    }
    return { watch, stop() { clearTimeout(to); curId = 0; } };
  }

  // ---------- Nego (host) ----------
  /**
   * phase(S, humans) → Promise: jendela negosiasi selama `seconds` atau sampai semua manusia (pid) menekan Siap.
   * Tanpa ≥ 2 manusia langsung selesai. onChange() dipanggil saat status berubah (render + push state).
   */
  function Nego({ seconds = 60, onChange }) {
    let resolve = null, S0 = null, humans = [], iv = 0;
    function done() {
      if (!resolve) return;
      clearInterval(iv); S0.nego = null; const r = resolve; resolve = null; onChange(); r();
    }
    function phase(S, humanPids) {
      humans = humanPids;
      if (humans.length < 2) return Promise.resolve();
      S0 = S;
      S.nego = { until: Date.now() + seconds * 1000, ready: [], n: humans.length };
      onChange();
      return new Promise((res) => {
        resolve = res;
        iv = setInterval(() => { if (Date.now() >= S.nego.until) done(); }, 300);
      });
    }
    function ready(pid) {
      if (!S0 || !S0.nego || !humans.includes(pid) || S0.nego.ready.includes(pid)) return;
      S0.nego.ready.push(pid); onChange();
      if (S0.nego.ready.length >= humans.length) done();
    }
    return { phase, ready, cancel: done };
  }
  /** HTML banner negosiasi untuk semua pemain (host & klien). */
  function negoBanner(S, myId, text) {
    if (!S || !S.nego) return '';
    const siap = S.nego.ready.includes(myId);
    return `<div class="nd-nego"><div class="tx">🤝 <b>Negosiasi</b> <span class="nd-timer" data-deadline="${S.nego.until}"></span><br>
      <span class="small">${esc(text || 'Pakai chat untuk tawar-menawar. Janji tidak mengikat.')} · ${S.nego.ready.length}/${S.nego.n} siap</span></div>
      <button type="button" data-nego-siap ${siap ? 'disabled' : ''}>${siap ? '✓ Siap' : 'Siap ▶'}</button></div>`;
  }
  /** HTML hitung mundur giliran (kalau ada deadline). */
  function timerBadge(S) {
    return S && S.deadline ? ` · ⏱️ <span class="nd-timer" data-deadline="${S.deadline}"></span>` : '';
  }

  root.NDBD = { esc, Feed, CardQueue, tips, Chat, TurnTimer, Nego, negoBanner, timerBadge, syncClock, tick, hostNow };
})(typeof window !== 'undefined' ? window : globalThis);
