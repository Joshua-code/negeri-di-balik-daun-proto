/* Ruang online Negeri di Balik Daun: Supabase Realtime Broadcast (tanpa tabel), host-authoritative.
 * Diambil dari kode net yang dulu diduplikasi di tiap halaman game (lihat prototype/arsip/meja-hijau.html).
 *
 * NDBDNet.Room({ url, key, prefix, myId, myName, buatLobi, publik, ... }) →
 *   open(code, isHost), send(event, payload), action(seat, id, choice), pushLobby(), pushState(now), leave(), ready()
 * Host menyiarkan `publik(S)` (state tanpa rahasia + privs[pid] per pemain). Klien mengirim aksi dengan `aid` unik;
 * host mengabaikan aid yang sudah pernah diproses (kirim ulang saat koneksi goyah tidak dobel).
 */
(function (root) {
  'use strict';
  function Room(o) {
    const R = {
      sb: null, ch: null, code: null, isHost: false, lobby: null, online: new Set(), pushT: 0, aidSeen: new Set(), aidN: 0,
      ready() { return o.url && o.url.startsWith('http') && root.supabase; },
      async open(code, isHost) {
        R.leave();
        R.code = code; R.isHost = isHost; R.aidSeen.clear();
        if (!R.sb) R.sb = root.supabase.createClient(o.url, o.key, { realtime: { params: { eventsPerSecond: 20 } } });
        const ch = R.sb.channel(o.prefix + '-' + code, { config: { broadcast: { self: false }, presence: { key: o.myId } } });
        R.ch = ch;
        if (isHost) R.lobby = o.buatLobi(code);
        ch.on('presence', { event: 'sync' }, () => R.onPresence());
        ch.on('broadcast', { event: 'hello' }, () => { if (R.isHost) { R.pushLobby(); if (o.getState()) R.pushState(true); } });
        ch.on('broadcast', { event: 'action' }, ({ payload: a }) => {
          if (!R.isHost || !a || R.aidSeen.has(a.aid)) return;
          R.aidSeen.add(a.aid);
          o.onAction && o.onAction(a);
        });
        ch.on('broadcast', { event: 'chat' }, ({ payload }) => o.onChat && o.onChat(payload));
        ch.on('broadcast', { event: 'ready' }, ({ payload }) => { if (R.isHost && o.onReady) o.onReady(payload.pid); });
        ch.on('broadcast', { event: 'lobby' }, ({ payload }) => { if (!R.isHost) { R.lobby = payload; o.onLobby && o.onLobby(payload); } });
        ch.on('broadcast', { event: 'state' }, ({ payload }) => { if (!R.isHost) o.onState && o.onState(payload); });
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej(new Error('timeout')), 10000);
          ch.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(to);
              await ch.track({ id: o.myId, name: o.myName(), host: isHost, ts: Date.now(), meta: o.meta ? o.meta() : null });
              if (!isHost) R.send('hello', { id: o.myId });
              res();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); rej(new Error(status)); }
          });
        });
      },
      onPresence() {
        const ps = Object.values(R.ch.presenceState()).map((a) => a[0]).filter(Boolean).sort((a, b) => a.ts - b.ts);
        R.online = new Set(ps.map((p) => p.id));
        if (R.isHost && R.lobby && !R.lobby.started) R.lobby.players = ps.map((p) => ({ id: p.id, name: p.name, meta: p.meta || null }));
        if (R.isHost) R.pushLobby();
        o.onPresence && o.onPresence(ps, ps.some((p) => p.host));
      },
      send(event, payload) { if (R.ch) R.ch.send({ type: 'broadcast', event, payload }); },
      /** Klien: kirim jawaban prompt ke host. */
      action(seat, id, choice) { R.send('action', { aid: o.myId + ':' + (++R.aidN) + ':' + id, pid: o.myId, seat, id, choice }); },
      pushLobby() { if (R.isHost && R.lobby) R.send('lobby', R.lobby); },
      pushState(now) {
        const S = o.getState();
        if (!R.isHost || !S) return;
        const go = () => { R.pushT = 0; const pub = o.publik(o.getState()); pub.hostNow = Date.now(); R.send('state', pub); };
        if (now) { clearTimeout(R.pushT); go(); } else if (!R.pushT) R.pushT = setTimeout(go, 150);
      },
      leave() { if (R.ch) { R.sb.removeChannel(R.ch); R.ch = null; } R.lobby = null; },
    };
    return R;
  }
  root.NDBDNet = { Room };
})(typeof window !== 'undefined' ? window : globalThis);
