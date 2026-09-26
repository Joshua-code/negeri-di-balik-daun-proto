/* Gedung Bundar — mesin aturan. Port dari tools/sim_gedung_bundar.py (aturan: docs/04-gedung-bundar.md).
 * Dipakai di browser (window.GedungBundar) dan Node (require). Protokol sama dengan engine.js (Jalan Tikus):
 * setiap keputusan lewat ask(): kursi bot dijawab heuristik simulasi, kursi manusia menunggu answer().
 */
(function (root) {
  'use strict';

  const C = {
    RONDE: 8, HARGA: [3, 6, 10], PROD: [1, 2, 4], FEE: 0.2, FEE_AMNESTI: 0.05, GAJI_JAKSA: 2, GAJI_DIREKSI: 3,
    LOKER_AWAL: 4, LOKER_MAX: 10, LOKER_RESET: 4, KRISIS: 0.2,
    PENGALI: [1, 2, 3], AMBANG: [6, 5, 4], CITRA_VONIS: [1, 2, 3], LAPAS_VONIS: [1, 2, 2], BEKU: [1, 1, 2],
    CITRA_KALAH: 2, KONPERS_CITRA: 2, KONPERS_LEPAS: 3, CITRA_MIN: 6, CITRA_AWAL: 5,
    ISTANA_BACKING: 2, LOBI: 5, BACKING_MAX: 3, CUCI: 2, SOWAN: 3, REMISI: 3, SEL_MEWAH: 2, KEMITRAAN_FEE: 3,
    UMKM_PENGUSAHA: 3, SETOR: 0.5, KORPORASI_JEJAK: 0.5, UPETI: 2, UMKM_JEJAK: 1, UMKM_KECIL: 1, KONG_SIDANG: 1,
    KARET: 2, VIRAL_MAX: 3, BOT_CITRA: 5,
  };
  // role: [emoji, nama, Rupiah awal, ukuran Usaha awal, Backing, gaji]
  const ROLES = {
    jaksa: ['⚖️', 'Jaksa'],
    kong: ['🎩', 'Konglomerat', 11, [1], 2, 0],
    bumn: ['🏢', 'Direksi BUMN', 4, [1], 1, C.GAJI_DIREKSI],
    umkm: ['🧺', 'UMKM', 3, [0], 0, 0],
  };
  const SEKTOR = [['🌾', 'Pangan'], ['⛏️', 'Tambang'], ['🏗️', 'Infrastruktur'], ['📱', 'Digital']];
  const UKURAN = ['Kecil', 'Menengah', 'Besar'];
  const NAMA_USAHA = [
    ['Warung Nasi Daun', 'Pabrik Tahu', 'Kebun Sawit Daun'],
    ['Galian Pasir', 'Tambang Batu Kapur', 'Tambang Timah Daun'],
    ['Toko Bangunan', 'Kontraktor Jalan', 'Grup Beton Negeri'],
    ['Konter Pulsa', 'Startup Aplikasi', 'Raksasa Ojol Daun'],
  ];
  // 24 kartu: per sektor 3 Kecil, 2 Menengah, 1 Besar (tabel 7.3)
  const USAHA = [];
  for (let s = 0; s < 4; s++) for (const u of [0, 0, 0, 1, 1, 2]) USAHA.push({ id: USAHA.length, sektor: s, ukuran: u, nama: NAMA_USAHA[s][u] });
  // [nama, sektor|null, syarat, untung, jejak] — tabel 7.2
  const PROYEK = [
    ['Impor Gula', 0, 1, 8, 3], ['Izin Ekspor CPO', 0, 1, 10, 4], ['Bansos Beras', 0, 0, 5, 2],
    ['Tata Niaga Timah', 1, 1, 9, 4], ['Smelter Nikel', 1, 2, 13, 5], ['Tol Trans-Daun', 2, 2, 12, 5],
    ['Revitalisasi Pasar', 2, 0, 5, 2], ['Bendungan Nasional', 2, 1, 9, 4], ['Laptop untuk Sekolah', 3, 1, 10, 4],
    ['Menara Sinyal Desa', 3, 2, 13, 5], ['Pengadaan UMKM Desa', null, 0, 4, 1], ['Pengadaan UMKM Desa', null, 0, 4, 1],
  ].map(([nama, sektor, syarat, untung, jejak], id) => ({ id, nama, sektor, syarat, untung, jejak }));
  const KABAR = {
    1: ['Mahkamah Daun: Hanya Badan Pemeriksa yang Boleh Hitung', 'Kalkulator Fantastis tidak boleh dipakai ronde ini.'],
    2: ['Rekor Sitaan Terbesar Sepanjang Sejarah', 'Setiap vonis ronde ini memberi Citra +1 tambahan.'],
    3: ['Abolisi demi Rekonsiliasi', 'Semua pemain di Lapas langsung bebas, termasuk Jaksa.'],
    4: ['UU BUMN Baru: Rugi BUMN Bukan Rugi Negara', 'Ambang sidang Direksi maksimal 4 ronde ini.'],
    5: ['Jaksa Agung Ganti 43 Kajari', 'Sorotan Jaksa −1, kasus Laci terlama dibuang. Masalahnya dipindah, bukan diselesaikan.'],
    6: ['Pengampunan Pajak', 'Transfer ke Luar Pelaku Usaha hanya dipotong 5% ronde ini.'],
    7: ['RUU Perampasan Aset Ditunda Lagi', 'Tidak terjadi apa-apa. Kartu dikocok kembali ke deck.'],
    8: ['Direksi Takut Ambil Keputusan', 'Lapangan Kerja −2.'],
    9: ['Harga Komoditas Naik', 'Usaha Pangan & Tambang berproduksi +1 ronde ini.'],
    10: ['Target PNBP Kejaksaan', 'Kalau Jaksa menyelidiki ronde ini, wajib Kalkulator Tinggi.'],
    11: ['OTT Jaksa Daerah', 'Sorotan Jaksa +2.'],
    12: ['Polisi Geledah Rumah Jaksa', 'Sorotan Jaksa +1. Upeti Laci tidak ditagih ronde ini.'],
  };
  const KALK = ['Rendah', 'Tinggi', 'Fantastis'];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * players: [{name, bot, pid, role}] — index 0 = Jaksa, sisanya Pelaku Usaha (1–3; role default kong, bumn, umkm).
   * opts: rng, delay, putaran (jumlah ronde), script {kabar:[..], usaha:[id..], proyek:[id..], sidang:[..], karet:[..], koreksi:[..]},
   *       setup(S), onUpdate(S), onEvent(ev), strict, stopAfterTurn(S, seat).
   */
  function createGame(players, opts = {}) {
    const rng = opts.rng || Math.random;
    const script = opts.script || {};
    const delayMs = () => (typeof opts.delay === 'function' ? opts.delay() : opts.delay || 0);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const d6 = (queue) => (queue && queue.length ? queue.shift() : 1 + Math.floor(rng() * 6));
    const kartu = (id) => Object.assign({}, USAHA[id], { beku: false });

    const deckUsaha = script.usaha ? script.usaha.slice().reverse() : shuffle(USAHA.map((u) => u.id));
    const deckProyek = script.proyek ? script.proyek.slice().reverse() : shuffle(PROYEK.map((p) => p.id));
    const S = {
      t: 0, ronde: opts.putaran || C.RONDE, phase: 'play', turn: null, kabar: null, loker: C.LOKER_AWAL,
      pasar: [], proyekBuka: [], log: [], events: [], evN: 0, prompt: null, stats: {}, result: null, f: {},
      players: players.map((p) => ({ name: p.name, bot: !!p.bot, pid: p.pid || null })),
      j: { seat: 0, rp: 3, aman: 0, citra: C.CITRA_AWAL, sorotan: 2, backing: 1, lapas: 0, laci: [], fantastis: 0 },
      ps: players.slice(1).map((p, i) => {
        const role = p.role || ['kong', 'bumn', 'umkm'][i];
        const R = ROLES[role];
        return { seat: i + 1, role, rp: R[2], aman: 0, usaha: [], jejak: 0, jejakMitra: 0, backing: R[4], gaji: R[5],
          viral: role === 'umkm' ? 2 : 0, lapas: 0, pengusaha: role !== 'umkm', menangSidang: false };
      }),
      decks: { usaha: deckUsaha, proyek: deckProyek, kabar: script.kabar ? script.kabar.slice().reverse() : shuffle(Object.keys(KABAR).map(Number)) },
    };
    const j = S.j, ps = S.ps;
    for (const p of ps) for (const u of ROLES[p.role][3]) {
      const i = S.decks.usaha.findIndex((id) => USAHA[id].ukuran === u);
      p.usaha.push(kartu(S.decks.usaha.splice(i, 1)[0]));
    }
    while (S.pasar.length < 4 && S.decks.usaha.length) S.pasar.push(kartu(S.decks.usaha.pop()));
    while (S.proyekBuka.length < 3 && S.decks.proyek.length) S.proyekBuka.push(S.decks.proyek.pop());
    if (opts.setup) opts.setup(S);

    let promptSeq = 0, pending = null, stopped = false;
    const name = (seat) => S.players[seat].name;
    const st = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
    const update = () => opts.onUpdate && opts.onUpdate(S);
    const log = (msg) => { S.log.push({ t: S.t, msg }); if (S.log.length > 60) S.log.shift(); update(); };
    const PACE = { ronde: 1, kabar: 2.5, produksi: 0.8, upeti: 1.2, turn: 0.4, beli: 1, proyek: 1.2, kemitraan: 1.5, korporasi: 1.2,
      transfer: 1.5, perkara: 2.5, sidang: 1.5, vonis: 2, laci: 1.2, respons: 1.2, ott: 1.5, lapas: 1.5, krisis: 2, koreksi_ma: 1.5, aksi: 1 };
    const pace = async (k = 1) => { const d = delayMs(); if (d) await sleep(d * k); };
    async function ev(type, data = {}) {
      const e = Object.assign({}, data, { n: ++S.evN, type, t: S.t });
      S.events.push(e); if (S.events.length > 20) S.events.shift();
      update();
      if (opts.onEvent) await opts.onEvent(e, S);
      if (PACE[type]) await pace(PACE[type]);
    }

    // ---------- ask / answer ----------
    async function ask(seat, prompt, botChoice) {
      const valid = prompt.options.filter((x) => !x.disabled).map((x) => x.id);
      if (opts.strict && !valid.includes(botChoice)) throw new Error(`bot choice ${botChoice} not in ${valid} for ${prompt.kind}`);
      if (S.players[seat].bot) { await pace(0.5); return botChoice; }
      S.prompt = Object.assign({ id: ++promptSeq, seat, bot: botChoice }, prompt);
      update();
      const choice = await new Promise((res) => { pending = { id: S.prompt.id, res }; });
      S.prompt = null; pending = null; update();
      return choice;
    }
    function answer(seat, promptId, choice) {
      const p = S.prompt;
      if (!pending || !p || p.id !== promptId || p.seat !== seat) return false;
      if (!p.options.some((x) => x.id === choice && !x.disabled)) return false;
      pending.res(choice);
      return true;
    }
    function setBot(seat, bot) {
      S.players[seat].bot = bot;
      if (bot && S.prompt && S.prompt.seat === seat && pending) pending.res(S.prompt.bot);
      update();
    }

    // ---------- helpers ----------
    const sisa = () => S.ronde - S.t;
    const harga = (p, c) => Math.max(1, C.HARGA[c.ukuran] - p.usaha.filter((u) => u.sektor === c.sektor).length);
    const setor = (rugi) => Math.ceil(rugi * C.SETOR);
    const pr = (id) => PROYEK[id];
    const bisaProyek = (p, id) => pr(id).sektor === null || p.usaha.filter((u) => u.sektor === pr(id).sektor).length >= pr(id).syarat;
    const jejakProyek = (p, id) => (p.role === 'umkm' ? Math.max(1, pr(id).jejak - C.UMKM_JEJAK) : pr(id).jejak);
    const jejakKorporasi = (c) => Math.ceil(C.HARGA[c.ukuran] * C.KORPORASI_JEJAK);
    const prodUsaha = (p, u) => C.PROD[u.ukuran] + (p.role === 'umkm' && u.ukuran === 0 ? C.UMKM_KECIL : 0);
    const fee = (p) => (p !== j && S.f.fee !== null ? S.f.fee : C.FEE);
    const bekuTarget = (p, kalk) => p.usaha.filter((u) => !u.beku).sort((a, b) => b.ukuran - a.ukuran).slice(0, C.BEKU[kalk]);
    function ubahLoker(n) { S.loker = Math.min(C.LOKER_MAX, S.loker + n); if (n < 0) st('lapangan_kerja_hilang', -n); }
    function ambang(p, kalk, konpers) {
      let a = Math.min(6, C.AMBANG[kalk] + (konpers ? 1 : 0));
      if (p.role === 'bumn') a = Math.min(a, S.f.bjr);
      return a;
    }
    const modSidang = (p, viral) => (p.role === 'kong' ? C.KONG_SIDANG : 0) + (viral ? 1 : 0);
    const peluang = (a, mod) => Math.max(0, Math.min(6, 7 - a + mod)) / 6;

    // ---------- Sorotan & OTT ----------
    async function naikSorotan(n) {
      j.sorotan = Math.max(0, j.sorotan + n);
      if (j.sorotan < 10) return;
      st('ott');
      const options = [
        { id: 'backing', label: 'Pakai Backing', sub: 'Buang 1 Backing · Sorotan → 7', disabled: !j.backing },
        { id: 'tumbal', label: 'Tumbal Kajari', sub: 'Buang 1 kasus Laci selamanya · Sorotan → 6 · Citra −2', disabled: !j.laci.length },
        { id: 'tertangkap', label: 'Pasrah tertangkap', sub: 'Separuh Rupiah disita · Lapas 1 ronde · Sorotan → 5' },
      ];
      await ev('ott', { seat: 0 });
      const c = await ask(0, { kind: 'ott', text: '🚨 OTT! Sorotan menyentuh 10. Bagaimana kamu lolos?', options },
        j.backing ? 'backing' : j.laci.length ? 'tumbal' : 'tertangkap');
      if (c === 'backing') { j.backing--; j.sorotan = 7; st('ott_backing'); log(`🚨 OTT! ${name(0)} diselamatkan Backing.`); }
      else if (c === 'tumbal') {
        const k = j.laci.shift(); j.sorotan = 6; j.citra -= 2; st('ott_tumbal_kajari');
        log(`🚨 OTT! ${name(0)} mengorbankan Kajari: kasus ${name(k.seat)} dibuang dari Laci. Berita: "oknum jaksa daerah dicopot".`);
      } else {
        const sita = Math.ceil(j.rp / 2); j.rp -= sita; j.lapas = 1; j.sorotan = 5; st('ott_tertangkap');
        log(`🚨 OTT! ${name(0)} TERTANGKAP. ${sita} Rupiah disita, masuk Lapas 1 ronde.`);
      }
    }
    async function masukLapas(p, n, sebab) {
      p.lapas = Math.max(p.lapas, n); st('lapas_' + sebab);
      const why = { pasal_karet: 'dilaporkan balik dengan UU ITE (pasal karet)', vonis: 'divonis bersalah' }[sebab];
      log(`🔒 ${name(p.seat)} masuk Lapas ${n} ronde: ${why}.`);
      await ev('lapas', { seat: p.seat, sebab });
    }
    async function transfer(p) {
      const masuk = Math.floor(p.rp * (1 - fee(p)));
      p.aman += masuk;
      log(`💸 ${name(p.seat)} transfer ${p.rp} Rupiah ke luar negeri → +${masuk} Harta Aman.`);
      p.rp = 0;
      await ev('transfer', { seat: p.seat, jumlah: masuk });
      if (p === j) await naikSorotan(1);
    }

    // ---------- Kabar Istana ----------
    async function bukaKabar() {
      S.f = { noFantastis: false, vonisBonus: 0, bjr: 5, fee: null, komoditas: false, wajibTinggi: false, noUpeti: false };
      if (!S.decks.kabar.length) { S.kabar = null; return; }
      const k = S.decks.kabar.pop();
      S.kabar = { id: k };
      log(`📰 Kabar Istana: ${KABAR[k][0]} — ${KABAR[k][1]}`);
      await ev('kabar', { id: k });
      const f = S.f;
      if (k === 1) f.noFantastis = true;
      else if (k === 2) f.vonisBonus = 1;
      else if (k === 3) { ps.forEach((p) => { p.lapas = 0; }); j.lapas = 0; }
      else if (k === 4) f.bjr = 4;
      else if (k === 5) { j.sorotan = Math.max(0, j.sorotan - 1); j.laci.shift(); }
      else if (k === 6) f.fee = C.FEE_AMNESTI;
      else if (k === 7) S.decks.kabar.splice(Math.floor(rng() * (S.decks.kabar.length + 1)), 0, k);
      else if (k === 8) ubahLoker(-2);
      else if (k === 9) f.komoditas = true;
      else if (k === 10) f.wajibTinggi = true;
      else if (k === 11) await naikSorotan(2);
      else if (k === 12) { f.noUpeti = true; await naikSorotan(1); }
    }

    // ---------- produksi & upeti ----------
    async function produksi() {
      for (const p of ps) {
        let n = p.gaji;
        for (const u of p.usaha) if (!u.beku) {
          n += prodUsaha(p, u) + (S.f.komoditas && u.sektor <= 1 ? 1 : 0);
        }
        p.rp += n;
      }
      if (!j.lapas) j.rp += C.GAJI_JAKSA;
      log(`🏭 Produksi: ${ps.map((p) => `${name(p.seat)} ${p.rp}`).join(' · ')} Rupiah.`);
      await ev('produksi', {});
    }
    async function upeti() {
      if (!C.UPETI || j.lapas || S.f.noUpeti || !j.laci.length) return;
      let total = 0;
      for (const kasus of j.laci.slice()) {
        if (!j.laci.includes(kasus)) continue; // sudah hilang (tumbal Kajari)
        const p = ps.find((x) => x.seat === kasus.seat);
        if (p.rp >= C.UPETI) { p.rp -= C.UPETI; j.rp += C.UPETI; total += C.UPETI; st('upeti', C.UPETI); }
        else {
          j.laci.splice(j.laci.indexOf(kasus), 1); st('laci_dibuka');
          log(`🗄️ ${name(p.seat)} tidak mampu bayar upeti. Kasusnya dibuka lagi dari Laci!`);
          await perkara(p, kasus.rugi, kasus.kalk, false, true);
        }
      }
      if (total) { log(`🗄️ Upeti Laci: ${total} Rupiah masuk ke ${name(0)}.`); await ev('upeti', { total }); }
    }

    // ---------- Pelaku Usaha ----------
    function isiPasar() { while (S.pasar.length < 4 && S.decks.usaha.length) S.pasar.push(kartu(S.decks.usaha.pop())); }
    async function beli(p, c, gratis) {
      S.pasar.splice(S.pasar.indexOf(c), 1); isiPasar();
      if (gratis) {
        const jj = jejakKorporasi(c); p.jejak += jj; st('aksi_korporasi');
        log(`🏢 ${name(p.seat)} mengakuisisi ${c.nama} pakai uang negara (Aksi Korporasi). Jejak +${jj}.`);
      } else {
        const h = harga(p, c); p.rp -= h;
        log(`🛒 ${name(p.seat)} membeli ${c.nama} (${h} Rupiah).`);
      }
      p.usaha.push(c); ubahLoker(1);
      await ev(gratis ? 'korporasi' : 'beli', { seat: p.seat, id: c.id });
      if (!p.pengusaha && p.usaha.length >= C.UMKM_PENGUSAHA) {
        p.pengusaha = true; st('umkm_jadi_pengusaha_ronde', S.t);
        log(`⬆️ ${name(p.seat)} naik kelas jadi Pengusaha! Sekarang boleh Transfer ke Luar.`);
        await ev('naik', { seat: p.seat });
      }
    }
    async function ambilProyek(p, id, pemberi) {
      S.proyekBuka.splice(S.proyekBuka.indexOf(id), 1);
      if (S.decks.proyek.length) S.proyekBuka.push(S.decks.proyek.pop());
      const jj = jejakProyek(p, id);
      p.rp += pr(id).untung; p.jejak += jj; st('proyek_diambil');
      if (pemberi) {
        p.rp -= C.KEMITRAAN_FEE; pemberi.rp += C.KEMITRAAN_FEE;
        pemberi.jejak += pr(id).jejak; pemberi.jejakMitra += pr(id).jejak; st('kemitraan');
        log(`🤝 Kemitraan: ${name(pemberi.seat)} memberi proyek ${pr(id).nama} ke ${name(p.seat)} (+${pr(id).untung}, fee ${C.KEMITRAAN_FEE}). Keduanya kena Jejak.`);
        await ev('kemitraan', { seat: p.seat, from: pemberi.seat, id });
      } else {
        log(`📜 ${name(p.seat)} mengambil Proyek ${pr(id).nama}: +${pr(id).untung} Rupiah, Jejak +${jj}.`);
        await ev('proyek', { seat: p.seat, id });
      }
    }
    // rencana bot (heuristik simulasi): { cat, arg, v }
    function nilaiUsaha(p, c) { return prodUsaha(p, c) * sisa() - harga(p, c) + (p.pengusaha ? 0 : 8); }
    function rencanaBot(p) {
      if (p.pengusaha && p.rp > 0 && (S.t >= S.ronde - 1 || p.rp >= 20)) return { cat: 'transfer' };
      const opsi = [];
      for (const c of S.pasar) {
        if (harga(p, c) <= p.rp) opsi.push({ v: nilaiUsaha(p, c), cat: 'beli', arg: c.id });
        if (p.role === 'bumn') opsi.push({ v: C.PROD[c.ukuran] * sisa() - 1.3 * C.HARGA[c.ukuran] * C.KORPORASI_JEJAK, cat: 'korporasi', arg: c.id });
      }
      const risiko = p.strat === 'aman' ? 3 : 1.3;
      for (const id of S.proyekBuka) if (bisaProyek(p, id)) opsi.push({ v: pr(id).untung - risiko * (pr(id).jejak + p.jejak * 0.3), cat: 'proyek', arg: id });
      if (p.jejak >= 4 && p.rp >= C.CUCI * 2) { const n = Math.min(p.jejak, Math.floor(p.rp / C.CUCI)); opsi.push({ v: n * 1.2, cat: 'cuci', arg: n }); }
      if (p.backing < 2 && p.rp >= C.LOBI + 3 && p.jejak >= 4) opsi.push({ v: 3, cat: 'lobi' });
      let best = null;
      for (const o of opsi) if (!best || o.v > best.v) best = o;
      if (best && best.v > 0) return best;
      if (p.pengusaha && p.rp >= 10) return { cat: 'transfer' };
      return { cat: 'pas' };
    }

    async function kemitraan(p) {
      const lain = ps.filter((q) => q !== p);
      if (p.role !== 'bumn' || !lain.length || !S.proyekBuka.length || sisa() < 1) return;
      const calonBot = lain.filter((q) => q.jejak <= 3);
      const prBot = S.proyekBuka.find((id) => pr(id).jejak <= 3);
      const bot = p.jejak <= 2 && calonBot.length && prBot !== undefined ? prBot : 'lewat';
      const options = S.proyekBuka.map((id) => ({ id, label: `Beri ${pr(id).nama}`, sub: `Penerima +${pr(id).untung}, bayar fee ${C.KEMITRAAN_FEE} ke kamu · kamu Jejak +${pr(id).jejak}` }))
        .concat([{ id: 'lewat', label: 'Tidak ada Kemitraan', sub: '' }]);
      const c = await ask(p.seat, { kind: 'kemitraan', text: 'Aksi bebas Direksi: berikan 1 Proyek ke pemain lain lewat Kemitraan?', options }, bot);
      if (c === 'lewat') return;
      const tBot = (calonBot.length ? calonBot : lain).slice().sort((a, b) => a.rp - b.rp)[0].seat;
      const tSeat = await ask(p.seat, { kind: 'kemitraan_target', text: `Kemitraan ${pr(c).nama}: untuk siapa?`,
        options: lain.map((q) => ({ id: q.seat, label: name(q.seat), sub: `${ROLES[q.role][1]} · ${q.rp} Rupiah · Jejak ${q.jejak}` })) }, tBot);
      const q = ps.find((x) => x.seat === tSeat);
      const jawab = await ask(q.seat, { kind: 'terima_kemitraan', text: `${name(p.seat)} menawarkan proyek ${pr(c).nama} lewat Kemitraan.`, options: [
        { id: 'terima', label: `Terima (+${pr(c).untung - C.KEMITRAAN_FEE} bersih)`, sub: `Untung ${pr(c).untung}, fee ${C.KEMITRAAN_FEE} ke Direksi · Jejak +${jejakProyek(q, c)}` },
        { id: 'tolak', label: 'Tolak', sub: 'Tidak mau ikut kena Jejak' }] }, q.jejak <= 3 ? 'terima' : 'tolak');
      if (jawab === 'terima') await ambilProyek(q, c, p);
      else log(`${name(q.seat)} menolak tawaran Kemitraan ${name(p.seat)}.`);
    }

    async function giliranPelaku(p) {
      S.turn = p.seat; update();
      await ev('turn', { seat: p.seat });
      if (p.lapas) {
        const remisi = C.REMISI * p.lapas;
        const bot = p.rp >= remisi + 6 ? 'remisi' : p.rp >= C.SEL_MEWAH + 6 ? 'sel' : 'jalani';
        const c = await ask(p.seat, { kind: 'lapas', text: `🔒 Kamu di Lapas (sisa ${p.lapas} ronde). Usahamu tetap berproduksi.`, options: [
          { id: 'remisi', label: `Beli remisi (${remisi})`, sub: 'Langsung bebas dan beraksi ronde ini', disabled: p.rp < remisi },
          { id: 'sel', label: `Sel mewah (${C.SEL_MEWAH})`, sub: 'Tetap boleh beraksi dari dalam', disabled: p.rp < C.SEL_MEWAH },
          { id: 'jalani', label: 'Jalani hukuman', sub: 'Lewati aksi ronde ini' }] }, bot);
        if (c === 'remisi') { p.rp -= remisi; p.lapas = 0; st('remisi'); log(`${name(p.seat)} membeli remisi, langsung bebas.`); }
        else if (c === 'sel') { p.rp -= C.SEL_MEWAH; p.lapas--; st('sel_mewah'); log(`${name(p.seat)} menyewa sel mewah dan tetap berbisnis dari dalam.`); }
        else { p.lapas--; log(`${name(p.seat)} menjalani hukuman di Lapas.`); await pace(); return; }
      }
      await kemitraan(p);
      for (;;) {
        const plan = rencanaBot(p);
        const beliBisa = S.pasar.filter((c) => harga(p, c) <= p.rp);
        const proyekBisa = S.proyekBuka.filter((id) => bisaProyek(p, id));
        const options = [
          { id: 'beli', label: '🛒 Beli Usaha', sub: beliBisa.length ? `${beliBisa.length} kartu terjangkau · Lapangan Kerja +1` : 'Uang tidak cukup', disabled: !beliBisa.length },
          { id: 'proyek', label: '📜 Ambil Proyek Negara', sub: proyekBisa.length ? 'Untung besar sekarang · untung = Jejak' : 'Syarat sektor belum terpenuhi', disabled: !proyekBisa.length },
        ];
        if (p.role === 'bumn') options.push({ id: 'korporasi', label: '🏢 Aksi Korporasi', sub: 'Ambil Usaha gratis pakai uang negara · Jejak + ½ harga', disabled: !S.pasar.length });
        options.push(
          { id: 'transfer', label: `💸 Transfer ke Luar (−${Math.round(fee(p) * 100)}%)`, sub: !p.pengusaha ? `Belum Pengusaha (butuh ${C.UMKM_PENGUSAHA} Usaha)` : `${p.rp} Rupiah → ${Math.floor(p.rp * (1 - fee(p)))} Harta Aman`, disabled: !p.pengusaha || !p.rp },
          { id: 'lobi', label: `🛡️ Lobi Istana (${C.LOBI})`, sub: `+1 Backing (maks ${C.BACKING_MAX}). 2 Backing = Minta Istana`, disabled: p.rp < C.LOBI || p.backing >= C.BACKING_MAX },
          { id: 'cuci', label: '🧼 Hibah Yayasan', sub: `Hapus Jejak, ${C.CUCI} Rupiah per Jejak`, disabled: !p.jejak || p.rp < C.CUCI },
          { id: 'setoran', label: '🤫 Setoran Pengamanan (bebas)', sub: 'Bayar Jaksa. Tidak memakai Aksi. Janji tidak mengikat · Sorotan Jaksa +1', disabled: !p.rp },
          { id: 'pas', label: 'Pas', sub: 'Tidak melakukan apa-apa' });
        const c = await ask(p.seat, { kind: 'aksi', text: 'Pilih 1 aksi.', options }, plan.cat);
        const kembali = { id: 'kembali', label: '↩ Kembali', sub: '' };
        if (c === 'pas') { log(`${name(p.seat)} pas.`); await ev('aksi', { seat: p.seat, c }); return; }
        if (c === 'transfer') { await transfer(p); return; }
        if (c === 'lobi') { p.rp -= C.LOBI; p.backing++; st('lobi_istana'); log(`🛡️ ${name(p.seat)} melobi Istana: +1 Backing.`); await ev('aksi', { seat: p.seat, c }); return; }
        if (c === 'beli' || c === 'korporasi') {
          const gratis = c === 'korporasi';
          const list = gratis ? S.pasar : beliBisa;
          const id = await ask(p.seat, { kind: gratis ? 'pilih_korporasi' : 'pilih_usaha', text: gratis ? 'Akuisisi Usaha mana?' : 'Beli Usaha mana?',
            options: list.map((u) => ({ id: u.id, label: `${SEKTOR[u.sektor][0]} ${u.nama}`,
              sub: `${UKURAN[u.ukuran]} · produksi ${prodUsaha(p, u)}/ronde · ${gratis ? `gratis, Jejak +${jejakKorporasi(u)}` : `harga ${harga(p, u)}`}` })).concat([kembali]) },
          plan.cat === c ? plan.arg : list.reduce((a, u) => (nilaiUsaha(p, u) > nilaiUsaha(p, a) ? u : a)).id);
          if (id === 'kembali') continue;
          await beli(p, S.pasar.find((u) => u.id === id), gratis); return;
        }
        if (c === 'proyek') {
          const id = await ask(p.seat, { kind: 'pilih_proyek', text: 'Ambil Proyek mana?',
            options: proyekBisa.map((x) => ({ id: x, label: `${pr(x).sektor === null ? '🏘️' : SEKTOR[pr(x).sektor][0]} ${pr(x).nama}`, sub: `+${pr(x).untung} Rupiah · Jejak +${jejakProyek(p, x)}` })).concat([kembali]) },
          plan.cat === 'proyek' ? plan.arg : proyekBisa.reduce((a, x) => (pr(x).untung > pr(a).untung ? x : a)));
          if (id === 'kembali') continue;
          await ambilProyek(p, id); return;
        }
        if (c === 'cuci') {
          const maks = Math.min(p.jejak, Math.floor(p.rp / C.CUCI));
          const opts2 = []; for (let n = 1; n <= maks; n++) opts2.push({ id: n, label: `Hapus ${n} Jejak`, sub: `Bayar ${n * C.CUCI}` });
          const n = await ask(p.seat, { kind: 'cuci', text: 'Hibah ke yayasan untuk menghapus Jejak:', options: opts2.concat([kembali]) }, plan.cat === 'cuci' ? Math.min(plan.arg, maks) : maks);
          if (n === 'kembali') continue;
          p.rp -= n * C.CUCI; p.jejak -= n; p.jejakMitra = Math.min(p.jejakMitra, p.jejak); st('jejak_dicuci', n);
          log(`🧼 ${name(p.seat)} berhibah ke yayasan: Jejak −${n}.`); await ev('aksi', { seat: p.seat, c }); return;
        }
        if (c === 'setoran') {
          const opts2 = [1, 2, 3, 5, 8].filter((n) => n <= p.rp).map((n) => ({ id: n, label: `Setor ${n}`, sub: '' }));
          const n = await ask(p.seat, { kind: 'setoran', text: `Berapa "setoran pengamanan" untuk ${name(0)}?`, options: opts2.concat([kembali]) }, 'kembali');
          if (n === 'kembali') continue;
          p.rp -= n; j.rp += n; st('setoran_pengamanan_bebas', n);
          log(`🤫 ${name(p.seat)} menitipkan ${n} Rupiah ke ${name(0)}. "Semoga perkaranya aman."`);
          await naikSorotan(1);
        }
      }
    }

    // ---------- Jaksa ----------
    function respons(p, rugi, kalk, konpers, viral) {
      // bot target: pilihan termurah menurut perkiraan kasar (sama dengan simulasi)
      const a = ambang(p, kalk, konpers), mod = modSidang(p, viral), pm = peluang(a, mod);
      const beku = bekuTarget(p, kalk);
      const biayaLawan = (1 - pm) * (Math.min(p.rp, rugi) + beku.reduce((s, u) => s + C.HARGA[u.ukuran], 0) + 4 * C.LAPAS_VONIS[kalk] + p.jejak) - pm;
      const pil = [['lawan', biayaLawan]];
      if (p.rp >= setor(rugi)) pil.push(['setor', setor(rugi)]);
      if (p.backing >= C.ISTANA_BACKING) pil.push(['istana', 6 + C.ISTANA_BACKING]);
      return pil.reduce((x, y) => (y[1] < x[1] ? y : x))[0];
    }
    function rencanaJaksa() {
      const target = ps.filter((p) => p.jejak >= 1);
      if (j.sorotan >= 8 && j.rp >= C.SOWAN) return { cat: 'sowan' };
      if (!target.length) return { cat: 'pas' };
      const butuhCitra = j.citra < C.CITRA_MIN + 1 && sisa() <= C.BOT_CITRA;
      let best = null;
      for (const t of target) for (const kalk of kalkBoleh()) {
        const rugi = t.jejak * C.PENGALI[kalk], pil = respons(t, rugi, kalk, butuhCitra, false);
        const uang = pil === 'setor' ? setor(rugi) : 0;
        const citra = C.CITRA_VONIS[kalk] * (pil === 'lawan' ? 0.6 : 0) + (butuhCitra ? C.KONPERS_CITRA : 0);
        const v = uang + (butuhCitra ? 4 * citra : 0) + rng();
        if (!best || v > best.v) best = { v, cat: 'selidik', seat: t.seat, kalk, konpers: butuhCitra };
      }
      return best;
    }
    const kalkBoleh = () => (S.f.wajibTinggi ? [1] : S.f.noFantastis ? [0, 1] : [0, 1, 2]);

    async function giliranJaksa() {
      S.turn = 0; update();
      if (j.lapas) { j.lapas--; log(`🔒 ${name(0)} masih di Lapas.`); await pace(); return; }
      await ev('turn', { seat: 0 });
      const plan = rencanaJaksa();
      const target = ps.filter((p) => p.jejak >= 1);
      const c = await ask(0, { kind: 'aksi_jaksa', text: 'Pilih 1 aksi Jaksa.', options: [
        { id: 'selidik', label: '🔍 Penyelidikan', sub: target.length ? 'Jerat pemain ber-Jejak dengan Pasal 2/3' : 'Belum ada yang punya Jejak', disabled: !target.length },
        { id: 'sowan', label: `🙇 Sowan ke atasan (${C.SOWAN})`, sub: 'Sorotan −2', disabled: j.rp < C.SOWAN },
        { id: 'pas', label: 'Pas', sub: '' }] }, plan.cat);
      if (c === 'sowan') { j.rp -= C.SOWAN; j.sorotan = Math.max(0, j.sorotan - 2); st('sowan'); log(`🙇 ${name(0)} sowan ke atasan (setor ${C.SOWAN}).`); await ev('aksi', { seat: 0, c }); }
      else if (c === 'selidik') {
        const tSeat = await ask(0, { kind: 'target', text: 'Selidiki siapa?', options: target.map((p) => ({ id: p.seat, label: `${ROLES[p.role][0]} ${name(p.seat)}`,
          sub: `Jejak ${p.jejak} · ${p.rp} Rupiah · 🛡️${p.backing}${p.role === 'umkm' ? ` · 📹${p.viral}` : ''}` })) }, plan.cat === 'selidik' ? plan.seat : target[0].seat);
        const t = ps.find((p) => p.seat === tSeat);
        const boleh = kalkBoleh();
        const botKalk = plan.cat === 'selidik' && plan.seat === tSeat ? plan.kalk : boleh[boleh.length - 1];
        const kalk = await ask(0, { kind: 'kalkulator', text: `🧮 Kalkulator Kerugian untuk ${name(tSeat)} (Jejak ${t.jejak}).`,
          options: [0, 1, 2].map((k) => ({ id: k, label: `${KALK[k]} ×${C.PENGALI[k]} → Kerugian ${t.jejak * C.PENGALI[k]}`,
            sub: `Setor ${setor(t.jejak * C.PENGALI[k])} · target menang sidang di dadu ≥ ${C.AMBANG[k]} · vonis Citra +${C.CITRA_VONIS[k]} · beku ${C.BEKU[k]} Usaha${k === 2 ? ' · Sorotan +1, Koreksi MA' : ''}`,
            disabled: !boleh.includes(k) })) }, botKalk);
        const konpers = await ask(0, { kind: 'konpers', text: 'Gelar Konferensi Pers? (tersangka dipamerkan)', options: [
          { id: 'ya', label: '🎤 Konferensi Pers', sub: `Citra +${C.KONPERS_CITRA}, ambang sidang +1. Kalau nanti dilepas (Setor/Istana): Citra −${C.KONPERS_LEPAS}` },
          { id: 'tidak', label: 'Diam-diam saja', sub: 'Lebih mudah "diamankan"' }] }, plan.cat === 'selidik' && plan.konpers ? 'ya' : 'tidak');
        await perkara(t, t.jejak * C.PENGALI[kalk], kalk, konpers === 'ya', false);
      } else { log(`${name(0)} pas.`); await ev('aksi', { seat: 0, c }); }
      if (j.rp > 0 && !j.lapas) {
        const t = await ask(0, { kind: 'transfer_jaksa', text: 'Pindahkan uang ke luar negeri?', options: [
          { id: 'transfer', label: 'Transfer (−20%)', sub: `${j.rp} Rupiah → ${Math.floor(j.rp * (1 - C.FEE))} Harta Aman · Sorotan +1` },
          { id: 'tidak', label: 'Simpan dulu', sub: 'Rupiah bisa disita kalau kena OTT' }] },
        S.t === S.ronde || (j.rp >= 10 && j.sorotan <= 6) ? 'transfer' : 'tidak');
        if (t === 'transfer') await transfer(j);
      }
    }

    async function perkara(p, rugi, kalk, konpers, dariLaci) {
      st('perkara'); st('kalkulator_' + ['rendah', 'tinggi', 'fantastis'][kalk]);
      if (p.menangSidang) st('kasus_estafet');
      log(`🔍 ${name(0)} ${dariLaci ? 'membuka lagi kasus' : 'menyelidiki'} ${name(p.seat)}: Kalkulator ${KALK[kalk]} → kerugian negara ${rugi}!${konpers ? ' 🎤 Konferensi pers digelar.' : ''}`);
      await ev('perkara', { seat: p.seat, rugi, kalk, konpers, laci: dariLaci });
      if (kalk === 2) await naikSorotan(1);
      if (konpers) { j.citra += C.KONPERS_CITRA; st('konferensi_pers'); }
      const beku = bekuTarget(p, kalk);
      beku.forEach((u) => { u.beku = true; });
      ubahLoker(-beku.length); st('usaha_dibekukan', beku.length);
      if (beku.length) log(`❄️ Usaha ${name(p.seat)} dibekukan: ${beku.map((u) => u.nama).join(', ')}.`);
      const s = setor(rugi);
      let viral = false;
      if (p.role === 'umkm' && p.viral) {
        const c = await ask(p.seat, { kind: 'viral', text: 'Viralkan kasusmu? "No viral no justice."', options: [
          { id: 'ya', label: `📹 Viralkan (sisa ${p.viral})`, sub: `Sorotan Jaksa +3 · +1 di sidang · lalu dadu Pasal Karet 1–${C.KARET} = Lapas 2 ronde` },
          { id: 'tidak', label: 'Jangan', sub: '' }] }, rugi >= 4 || p.rp < s ? 'ya' : 'tidak');
        if (c === 'ya') {
          viral = true; p.viral--; st('viral');
          log(`📹 ${name(p.seat)} memviralkan kasusnya!`);
          await naikSorotan(3);
          const d = d6(script.karet);
          await ev('karet', { seat: p.seat, d });
          if (d <= C.KARET) await masukLapas(p, 2, 'pasal_karet');
          else log(`Dadu Pasal Karet ${d}: ${name(p.seat)} aman.`);
        }
      }
      const a = ambang(p, kalk, konpers), mod = modSidang(p, viral);
      const c = await ask(p.seat, { kind: 'respons', text: `⚖️ Kamu diselidiki: kerugian negara ${rugi}. Bagaimana menanggapinya?`, options: [
        { id: 'setor', label: `🤫 Setor ${s}`, sub: `Kasus masuk Laci Jaksa · Upeti ${C.UPETI}/ronde mulai ronde depan · Usaha dicairkan`, disabled: p.rp < s },
        { id: 'lawan', label: `🧑‍⚖️ Lawan di sidang (${Math.round(peluang(a, mod) * 100)}% menang)`, sub: `Menang kalau dadu${mod ? ` +${mod}` : ''} ≥ ${a}. Kalah: bayar ${rugi}, Usaha beku disita, Lapas ${C.LAPAS_VONIS[kalk]} ronde` },
        { id: 'istana', label: `🏛️ Minta Istana (${C.ISTANA_BACKING} Backing)`, sub: 'Kasus batal, Jejak hapus (rehabilitasi)', disabled: p.backing < C.ISTANA_BACKING }] },
      respons(p, rugi, kalk, konpers, viral));
      const cairkan = () => beku.forEach((u) => { u.beku = false; });
      if (c === 'setor') {
        p.rp -= s; j.rp += s; j.laci.push({ seat: p.seat, rugi, kalk }); p.jejak = 0; p.jejakMitra = 0; cairkan();
        if (konpers) j.citra -= C.KONPERS_LEPAS;
        st('setoran_pengamanan', s); st('setor');
        log(`🤫 ${name(p.seat)} menyetor ${s} ke ${name(0)}. Kasusnya "diamankan" ke Laci.`);
        await ev('laci', { seat: p.seat, jumlah: s });
        await naikSorotan(1);
      } else if (c === 'istana') {
        p.backing -= C.ISTANA_BACKING; p.jejak = 0; p.jejakMitra = 0; cairkan();
        j.citra -= 1 + (konpers ? C.KONPERS_LEPAS : 0); st('minta_istana');
        log(`🏛️ ${name(p.seat)} mendapat rehabilitasi dari Istana. Kasus batal.`);
        await ev('respons', { seat: p.seat, c });
      } else {
        if (!S.players[p.seat].bot) await ask(p.seat, { kind: 'sidang', text: `🧑‍⚖️ Sidang! Kamu menang kalau dadu${mod ? ` +${mod}` : ''} ≥ ${a}.`, options: [{ id: 'roll', label: '🎲 Lempar dadu', sub: '' }] }, 'roll');
        const d = d6(script.sidang), menang = d + mod >= a;
        log(`🧑‍⚖️ Sidang ${name(p.seat)}: dadu ${d}${mod ? ` +${mod}` : ''} vs ambang ${a}.`);
        await ev('sidang', { seat: p.seat, d, mod, ambang: a, menang });
        if (menang) {
          cairkan(); j.citra -= C.CITRA_KALAH; p.rp += 1; p.menangSidang = true; st('target_menang_sidang');
          log(`✅ ${name(p.seat)} MENANG sidang! Ganti rugi dari negara: 1 Rupiah. Jejaknya tetap tercatat.`);
        } else {
          const bayar = Math.min(p.rp, rugi); p.rp -= bayar;
          p.usaha = p.usaha.filter((u) => !beku.includes(u));
          st('usaha_disita', beku.length); st('uang_pengganti', bayar);
          if (p.jejakMitra) st('vonis_tanpa_menikmati');
          p.jejak = 0; p.jejakMitra = 0;
          const citra = C.CITRA_VONIS[kalk] + S.f.vonisBonus;
          j.citra += citra; if (kalk === 2) j.fantastis++;
          st('vonis');
          ps.forEach((q) => { if (q !== p && q.role === 'umkm') q.viral = Math.min(C.VIRAL_MAX, q.viral + 1); });
          log(`⛓️ ${name(p.seat)} DIVONIS. Uang pengganti ${bayar}, ${beku.length} Usaha disita. Citra Jaksa +${citra}.`);
          await ev('vonis', { seat: p.seat, bayar, sita: beku.length });
          await masukLapas(p, C.LAPAS_VONIS[kalk], 'vonis');
        }
      }
    }

    // ---------- loop utama ----------
    async function run() {
      for (let t = 1; t <= S.ronde && !stopped; t++) {
        S.t = t; update();
        await ev('ronde', { t });
        await bukaKabar(); if (stopped) break;
        await produksi();
        await upeti(); if (stopped) break;
        const n = ps.length;
        for (let k = 0; k < n && !stopped; k++) {
          const p = ps[(t + k) % n];
          await giliranPelaku(p);
          if (opts.stopAfterTurn && opts.stopAfterTurn(S, p.seat)) stopped = true;
        }
        if (stopped) break;
        await giliranJaksa();
        if (opts.stopAfterTurn && opts.stopAfterTurn(S, 0)) { stopped = true; break; }
        if (S.loker <= 0) {
          st('krisis');
          for (const p of ps.concat([j])) p.rp -= Math.floor(p.rp * C.KRISIS);
          S.loker = C.LOKER_RESET;
          log(`📉 KRISIS! Lapangan kerja habis, dunia usaha takut bergerak. Semua pemain kehilangan 20% Rupiah.`);
          await ev('krisis', {});
        }
      }
      if (stopped) { S.phase = 'stopped'; S.prompt = null; update(); return S; }
      S.turn = null;
      for (let i = 0; i < j.fantastis; i++) {
        const d = d6(script.koreksi);
        if (d <= 3) { j.citra -= 3; st('koreksi_ma'); log(`🧮 Koreksi MA (dadu ${d}): satu angka kerugian Fantastis ternyata jauh lebih kecil. Citra Jaksa −3.`); }
        else log(`🧮 Koreksi MA (dadu ${d}): angka Fantastis lolos, tidak dikoreksi.`);
        await ev('koreksi_ma', { d });
      }
      const mutasi = j.citra < C.CITRA_MIN;
      if (mutasi) st('jaksa_dimutasi');
      const skor = [{ seat: 0, role: 'jaksa', aman: j.aman, score: mutasi ? Math.floor(j.aman * 0.7) : j.aman, mutasi, citra: j.citra }]
        .concat(ps.map((p) => ({ seat: p.seat, role: p.role, aman: p.aman, score: p.pengusaha ? p.aman : 0, gagal: !p.pengusaha, usaha: p.usaha.length })));
      skor.forEach((x) => { x.name = name(x.seat); x.tie = rng(); });
      skor.sort((a, b) => (b.score - a.score) || ((b.usaha || 0) - (a.usaha || 0)) || (b.tie - a.tie));
      if (ps.some((p) => p.role === 'umkm' && p.pengusaha)) st('umkm_jadi_pengusaha');
      S.result = { ranking: skor, winner: skor[0].seat };
      S.phase = 'end';
      log(`🏁 Permainan selesai. Juara: ${skor[0].name} (${ROLES[skor[0].role][1]}).`);
      update();
      return S;
    }
    function stop() { stopped = true; if (pending) pending.res(S.prompt ? S.prompt.bot : null); }

    return { S, run, answer, setBot, stop };
  }

  const api = { C, ROLES, SEKTOR, UKURAN, USAHA, PROYEK, KABAR, KALK, createGame, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GedungBundar = api;
})(typeof window !== 'undefined' ? window : globalThis);
