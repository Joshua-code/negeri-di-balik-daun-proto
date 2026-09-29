/* Dompet Dana Offshore — Negeri di Balik Daun (docs/06-dunia-antah-berantah.md).
 * Currency tiap game (Receh/Cuan/Fulus) hanya hidup di dalam match. Setelah match selesai, Kekayaan akhir
 * dikonversi ke Dana Offshore: Kekayaan × Kurs game × Rasio peringkat × Pengali mode. Dana tidak pernah masuk ke match.
 * Dipakai di browser (window.NDBDDompet) dan Node (require). Penyimpanan tahap ini: localStorage (per perangkat).
 */
(function (root) {
  'use strict';

  const RASIO = [0.4, 0.3, 0.25, 0.2, 0.15];            // juara, ke-2, ke-3, ke-4, ke-5
  const MODE = { online: 1, latihan: 0.5, tutorial: 0 };
  const BONUS_TUTORIAL = 50;
  const GAME = {
    dg: { nama: 'Dari Gerobak', uang: 'Daun', em: '🍃', url: 'dari-gerobak.html' },
    // game Season 1 lama (diarsipkan 29 Sep 2026): tetap di sini supaya riwayat lama bisa ditampilkan
    jt: { nama: 'Jalan Tikus', uang: 'Receh', em: '🪙', url: 'arsip/jalan-tikus.html' },
    gb: { nama: 'Gedung Bundar', uang: 'Cuan', em: '💹', url: 'arsip/gedung-bundar.html' },
    mh: { nama: 'Meja Hijau', uang: 'Fulus', em: '💵', url: 'arsip/meja-hijau.html' },
  };

  /** Isi s.rasio dan s.dana (basis Online) untuk tiap baris ranking (urut juara → terakhir). */
  function konversi(ranking, kurs) {
    ranking.forEach((s, i) => {
      s.rasio = RASIO[Math.min(i, RASIO.length - 1)];
      s.dana = Math.floor(Math.max(0, s.kekayaan) * kurs * s.rasio);
    });
    return ranking;
  }
  const danaMode = (dana, mode) => Math.floor(dana * (MODE[mode] ?? 0));

  // ---------- penyimpanan ----------
  const KEY = 'ndbd_dompet';
  const kosong = () => ({ saldo: 0, perGame: { dg: 0 }, riwayat: [], tutorial: {}, match: {} });
  let mem = null;   // cadangan kalau localStorage tidak tersedia
  function baca() {
    try { const v = JSON.parse(root.localStorage.getItem(KEY)); if (v && typeof v.saldo === 'number') return Object.assign(kosong(), v); } catch (e) {}
    return mem || kosong();
  }
  function tulis(d) { mem = d; try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  /** Tambah Dana dari satu match. Idempoten per matchId (reload/rebroadcast tidak menggandakan). */
  function kredit({ matchId, game, mode, role, peringkat, n, kekayaan, dana }) {
    const d = baca();
    if (d.match[matchId]) return { baru: false, dana: d.match[matchId], saldo: d.saldo };
    d.saldo += dana; d.perGame[game] = (d.perGame[game] || 0) + dana; d.match[matchId] = dana || -1;
    d.riwayat.unshift({ game, mode, role, peringkat, n, kekayaan, dana, waktu: Date.now() });
    d.riwayat = d.riwayat.slice(0, 30);
    const ids = Object.keys(d.match); if (ids.length > 200) ids.slice(0, ids.length - 200).forEach((k) => delete d.match[k]);
    tulis(d);
    return { baru: true, dana, saldo: d.saldo };
  }
  /** Bonus sekali saat tutorial sebuah game tamat. */
  function bonusTutorial(game) {
    const d = baca();
    if (d.tutorial[game]) return { baru: false, dana: 0, saldo: d.saldo };
    d.tutorial[game] = true; d.saldo += BONUS_TUTORIAL; d.perGame[game] = (d.perGame[game] || 0) + BONUS_TUTORIAL;
    d.riwayat.unshift({ game, mode: 'tutorial', role: 'Tutorial tamat', peringkat: null, n: null, kekayaan: null, dana: BONUS_TUTORIAL, waktu: Date.now() });
    d.riwayat = d.riwayat.slice(0, 30);
    tulis(d);
    return { baru: true, dana: BONUS_TUTORIAL, saldo: d.saldo };
  }

  // ---------- layar akhir (browser) ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => Math.round(x * 100) + '%';
  /**
   * HTML papan peringkat + konversi, dan kredit Dana kursi sendiri ke dompet (sekali per matchId).
   * opts: game ('jt'|'gb'|'mh'), result (S.result dari engine), mySeat, mode ('latihan'|'online'), matchId, label(x) → keterangan role.
   * Mengembalikan { rank, konversi } (dua potong HTML).
   */
  function layarAkhir({ game, result, mySeat, mode, matchId, label }) {
    const G = GAME[game], medal = ['🥇', '🥈', '🥉', '4.', '5.'];
    const rank = result.ranking.map((x, i) => `<div><span>${medal[i]} ${esc(x.name)}${x.seat === mySeat ? ' (kamu)' : ''} <span class="small muted">${label(x)}</span></span>`
      + `<b style="white-space:nowrap" title="Kekayaan ${x.kekayaan} ${G.uang} × kurs ${result.kurs} × ${pct(x.rasio)}">${G.em} ${x.kekayaan} <span class="small muted">→</span> 🏝️ ${danaMode(x.dana, mode)}</b></div>`).join('');
    const me = result.ranking.find((x) => x.seat === mySeat);
    let info = `<p class="small muted">Kekayaan = ${G.uang} di tangan + Aset/nilai usaha. Setelah match, Kekayaan dikonversi jadi <b>🏝️ Dana Offshore</b>: Kekayaan × kurs ${result.kurs} × rasio peringkat (juara ${pct(RASIO[0])}, ke-2 ${pct(RASIO[1])}, ke-3 ${pct(RASIO[2])}, ke-4 ${pct(RASIO[3])}${result.ranking.length > 4 ? `, ke-5 ${pct(RASIO[4])}` : ''})${mode === 'latihan' ? ', lalu ×50% karena Latihan vs Bot' : ''}.</p>`;
    if (me) {
      const peringkat = result.ranking.indexOf(me) + 1, dana = danaMode(me.dana, mode);
      const k = kredit({ matchId: `${matchId}#${mySeat}`, game, mode, role: label(me).replace(/<[^>]*>/g, ''), peringkat, n: result.ranking.length, kekayaan: me.kekayaan, dana });
      info = `<div class="dompet-hasil"><div>Peringkat <b>${peringkat}</b> · Kekayaan <b>${G.em} ${me.kekayaan} ${G.uang}</b> × ${result.kurs} × ${pct(me.rasio)}${mode === 'latihan' ? ' × 50%' : ''}</div>`
        + `<div style="font-size:20px;margin:6px 0"><b>+${dana} 🏝️ Dana Offshore</b></div>`
        + `<div class="small muted">${k.baru ? 'Masuk ke dompetmu di Negeri di Balik Daun.' : 'Sudah tercatat di dompetmu.'} Saldo sekarang: <b>${k.saldo}</b></div></div>` + info;
    }
    return { rank, konversi: info };
  }

  if (typeof document !== 'undefined' && !document.getElementById('ndbd-dompet-css')) {
    const css = document.createElement('style'); css.id = 'ndbd-dompet-css';
    css.textContent = '.dompet-hasil{border:2px solid var(--gold);border-radius:14px;padding:12px;margin:10px 0;text-align:center;background:var(--panel)}';
    document.head.appendChild(css);
  }

  const api = {
    RASIO, MODE, BONUS_TUTORIAL, GAME, konversi, danaMode, kredit, bonusTutorial, layarAkhir,
    saldo: () => baca().saldo, data: baca, riwayat: () => baca().riwayat,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NDBDDompet = api;
})(typeof window !== 'undefined' ? window : globalThis);
