/* Dari Gerobak — mesin aturan (docs/07-dari-gerobak.md). Satu game gabungan Negeri di Balik Daun.
 * Semua pemain merintis usaha keluarga di Jalan Daun; sistem korup (Mata Aparat) adalah NPC; pemain boleh membeli jabatan
 * dan ikut memeras tetangga. Dipakai di browser (window.DariGerobak) dan Node (require).
 *
 * Protokol keputusan: askAll([{seat, prompt, bot}]) → beberapa prompt terbuka BERSAMAAN (S.prompts[seat]).
 * Kursi bot dijawab heuristik; kursi manusia menunggu answer(seat, id, choice). Prompt `pick` = pilih tepat n opsi,
 * prompt `multi` = pilih 0..n opsi (array). Rencana tiap pemain (S.plan) rahasia sampai semua selesai memilih.
 */
(function (root) {
  'use strict';

  const C = {
    BULAN: 12, DAUN_AWAL: 8, IZIN_AWAL: 1, KURS: 3.4, UANG: 'Daun',
    // usaha: Gerobak, Warung, Toko, Ruko, Pabrik
    PROD: [3, 5, 8, 11, 15], BANGUN: [0, 6, 12, 20, 30], NILAI: [2, 6, 14, 24, 38], SLOT: [0, 1, 2, 3, 4],
    FONDASI: 0.5, JUALAN: [2, 3, 4, 5, 6], BIAYA_HIDUP: [1, 1, 2, 3, 4],
    KAR_PROD: 2, KAR_REKRUT: 2, KAR_GAJI: 1,
    IZIN_PROSES: 2, BERKAS_HILANG: 0.25, CALO: [0, 2, 3, 5, 7], CABANG: 9, LOBI: 4, BACKING_MAX: 2, REKAMAN_MAX: 2,
    PROYEK: [0, 0, 8, 11, 14], PROYEK_JEJAK: 2,
    // ancaman
    ANCAMAN: [0, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4], TARIF_86: [1, 1, 2, 2, 3], TILANG: [2, 3, 5, 6, 8],
    DAMAI: [0, 3, 4, 6, 8], KEAMANAN: 2, SEGEL: 2, KARET: 3, RUGI_K: [1, 2, 3], SETOR_RASIO: 0.3, SIDANG_AMBANG: [4, 5, 6], UPETI: 1, LACI_BULAN: 3,
    ISTANA: 2, CAP: 0.4, KEBAL: 1, LAPAS_PROD: 2,
    // keluarga & mimpi
    TAGIHAN: { spp: 1, obat: 1, motor: 1, kondangan: 1 }, TAGIHAN_NAIK: 2, CELENGAN: 2, CELENGAN_PEJABAT: 1, MIMPI_TAHAP: 5, MIMPI_BONUS: [0, 1, 2, 4],
    KOLUSI_MALU: 2, BANTU: 2, BANTU_MIMPI_DARI: 9,
    // pinjol
    PINJOL_BUNGA: 0.25,
    // jabatan
    JABATAN_DARI: 4, JABATAN_SAMPAI: 9, JABATAN_HARGA: 8, JABATAN_PER_LEVEL: 3, SETORAN_ATAS: 1, TUNJANGAN: 5, TAGIH_SENDIRI: 1, OTT: 10, MUTASI_SOR: 8, MUTASI: 0.8, TARIF_PEJABAT: 2,
    LANGGANAN: 0.25, LANGGANAN_BULAN: 2, DICATAT: 2, DICATAT_BULAN: 2,
    LINDUNG: true, LINDUNG_IZIN: 1, LINDUNG_BACKING: 0.7, LINDUNG_IZIN_BACKING: 0.5,
  };
  const LEVEL = ['Gerobak', 'Warung', 'Toko', 'Ruko', 'Pabrik'];
  const LEVEL_EM = ['🛒', '🏪', '🏬', '🏢', '🏭'];
  const JABATAN = {
    kanit: ['👮', 'Kanit Reskrim', 'razia & rekayasa kasus'],
    kasi: ['📋', 'Kasi Perizinan', 'sidak izin, gusuran & calo'],
    jaksa: ['⚖️', 'Jaksa', 'Pasal 2/3 "kerugian negara"'],
  };
  const DOMAIN = { razia: 'kanit', rekayasa: 'kanit', sidak: 'kasi', gusur: 'kasi', pasal23: 'jaksa' };
  const ANCAMAN_NAMA = { razia: '🚨 Razia', sidak: '📋 Sidak Izin', gusur: '🚜 Penertiban', pasal23: '🧮 Pasal 2/3', rekayasa: '⚖️ Rekayasa Kasus' };
  const MIMPI = {
    sarjana: ['🎓', 'Anak jadi sarjana', ['Anak lulus SMA', 'Anak diterima kuliah', 'Anak diwisuda']],
    haji: ['🕋', 'Naik haji Bapak', ['Bapak daftar antrean haji', 'Pelunasan setoran haji', 'Bapak berangkat haji']],
    rumah: ['🏠', 'Rumah sendiri', ['Uang muka kavling', 'Rumah berdiri', 'Pindah ke rumah sendiri']],
    sekolah: ['📚', 'Adik sekolah perawat', ['Adik ikut bimbel', 'Adik masuk akademi', 'Adik jadi perawat']],
  };
  const TAGIHAN = {
    spp: ['🎒', 'SPP Anak', 'Anak bolos sekolah. Mimpi −1.', 'Anak berhenti sekolah dan ikut jualan. Mimpi −3.'],
    obat: ['💊', 'Obat Ibu', 'Pasangan menjaga Ibu di rumah: bulan depan aksi −1.', 'Ibu dirawat di puskesmas: bulan depan aksi −1, Daun −2.'],
    motor: ['🛵', 'Servis Motor', 'Motor mogok: Jualan bulan depan −2.', 'Motor dijual murah. Jualan −2 sampai akhir bulan depan.'],
    kondangan: ['💌', 'Kondangan & Arisan RT', 'Tetangga mulai menjauh: tidak ada yang membantumu bulan depan.', 'Namamu dicoret dari arisan RT.'],
  };
  const KABAR = {
    1: ['Operasi Zebra', 'Tarif "86" semua usaha +1 bulan ini.'],
    2: ['Bansos Jelang Pemilu', 'Gerobak & Warung +2 Daun.'],
    3: ['Harga Bahan Pokok Naik', 'Semua usaha berproduksi −1 bulan ini.'],
    4: ['Revisi UU ITE Ditunda Lagi', 'Pasal Karet kena di dadu 1–3 bulan ini.'],
    5: ['No Viral No Justice', 'Setiap Rekaman di sidang bernilai +2 (bukan +1).'],
    6: ['Amnesti 17 Agustus', 'Semua yang di Lapas pulang.'],
    7: ['Penertiban PKL', 'Satu ancaman tambahan bulan ini, khusus usaha tanpa izin.'],
    8: ['RUU Perampasan Aset Ditunda Lagi', 'Tidak terjadi apa-apa.'],
    9: ['Mutasi Serentak', 'Semua pejabat Sorotan −1, Setoran ke Atas +1 bulan ini.'],
    10: ['THR Lebaran', 'Gaji karyawan dua kali lipat bulan ini. Yang tidak dibayar, pulang kampung dan tidak kembali.'],
    11: ['Berkas Izin "Hilang"', 'Semua izin resmi yang sedang diproses mundur 1 bulan.'],
    12: ['Festival Kuliner Kota', 'Jualan +3 bulan ini.'],
    13: ['KUHAP Baru Berlaku', 'Rekayasa kasus tidak bisa dibongkar dengan Rekaman bulan ini.'],
    14: ['Hari Antikorupsi', 'Pejabat yang menerima setoran bulan ini: Sorotan +2 (bukan +1).'],
  };
  const NAMA = ['Siti', 'Budi', 'Joko', 'Rina', 'Agus', 'Dewi', 'Yanto', 'Lestari', 'Udin', 'Wati', 'Bayu', 'Tini', 'Eko', 'Sri', 'Asep', 'Nur', 'Dedi', 'Yuni', 'Rudi', 'Ani', 'Heru', 'Ratna', 'Imam', 'Mega'];
  const PASANGAN = ['Bu Sari', 'Pak Darto', 'Bu Yati', 'Pak Karno', 'Bu Ningsih', 'Pak Slamet', 'Bu Endang', 'Pak Wahyu'];
  const ANAK = ['Dimas', 'Putri', 'Raka', 'Nabila', 'Fajar', 'Ayu', 'Bima', 'Laras'];
  const TRAIT = { rajin: ['💪', 'rajin', '+1 produksi'], setia: ['🤝', 'setia', 'bertahan 1× saat gaji telat atau usaha disegel'], tulang: ['👨‍👩‍👧', 'tulang punggung keluarga', 'menghidupi 3 adik'] };
  const USAHA_NAMA = ['Nasi Uduk', 'Bakso', 'Kopi', 'Jahit', 'Pecel Lele', 'Martabak', 'Es Teh', 'Soto'];
  // Jalan Daun: 8 kavling melingkar. Pemain di 0,2,4,6; NPC di 1 & 5; lahan kosong di 3 & 7 (rebutan untuk cabang).
  const JALAN = ['P', 'N', 'P', 'E', 'P', 'N', 'P', 'E'];
  const NPC_USAHA = [['Warung Bu Minah', 1], ['Bengkel Pak Udin', 1]];
  const STRATS = ['jujur', 'kolusi', 'pejabat'];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const Dompet = () => root.NDBDDompet || require('./ndbd-dompet.js');

  /**
   * players: [{name, bot, pid, mimpi?, usaha?}] — 4 kursi (bot mengisi sisanya).
   * opts: rng, delay, putaran, script {kabar:[..], ancaman:[..], dadu:[..], strat:{seat:'jujur'|'kolusi'|'pejabat'}},
   *       setup(S), onUpdate(S), onEvent(e,S), onPace(k), onPhase('nego',S), strict, stopAfter(S).
   */
  function createGame(players, opts = {}) {
    const rng = opts.rng || Math.random;
    const script = opts.script || {};
    const delayMs = () => (typeof opts.delay === 'function' ? opts.delay() : opts.delay || 0);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pick1 = (a) => a[Math.floor(rng() * a.length)];
    const d6 = () => (script.dadu && script.dadu.length ? script.dadu.shift() : 1 + Math.floor(rng() * 6));
    const namaPool = shuffle(NAMA.slice()), pasPool = shuffle(PASANGAN.slice()), anakPool = shuffle(ANAK.slice()), usahaPool = shuffle(USAHA_NAMA.slice());
    const mimpiPool = shuffle(Object.keys(MIMPI));

    const S = {
      t: 0, bulan: opts.putaran || C.BULAN, phase: 'play', kabar: null, stage: 'mulai',
      log: [], logN: 0, events: [], evN: 0, prompts: {}, batch: 0, ready: [], plan: {}, stats: {}, result: null, f: {},
      players: players.map((p) => ({ name: p.name, bot: !!p.bot, pid: p.pid || null })),
      lots: JALAN.map((k, i) => ({ i, owner: null, npc: null, name: '', level: 0, segelSampai: 0, fondasi: 0, mem: [], kosong: k === 'E' })),
      p: [], jabatan: { kanit: null, kasi: null, jaksa: null }, sistem: 0, ancamanBulanIni: [],
      decks: { kabar: script.kabar ? script.kabar.slice().reverse() : shuffle(Object.keys(KABAR).map(Number)) },
    };
    const P = S.p;
    const seatLots = [0, 2, 4, 6];
    players.forEach((pl, seat) => {
      const lot = S.lots[seatLots[seat]];
      const usaha = pl.usaha || `${usahaPool[seat]} ${pl.name.replace(/ 🤖$/, '')}`;
      Object.assign(lot, { owner: seat, name: usaha, level: 0 });
      P.push({
        seat, daun: C.DAUN_AWAL, izin: C.IZIN_AWAL, berkas: null, karyawan: [], lots: [lot.i],
        pasangan: pasPool[seat], anak: anakPool[seat], mimpi: { jenis: pl.mimpi || mimpiPool[seat], celengan: 0 },
        sorotan: 0, backing: 0, rekaman: 1, jejak: 0, utang: 0, lapas: 0, kebalSampai: 0, laci: [],
        jabatan: null, jabatanSejak: 0, jabatanBulan: 0, kolusi: 0, luka: { spp: 0, obat: 0, motor: 0, kondangan: 0 },
        aksiMinus: 0, jualanMinus: 0, dijauhi: 0, strat: (script.strat && script.strat[seat]) || 'campur',
        kisah: [], tagihan: [], viralT: -9, targetT: -9, catat: { tokoT: null, levelB6: null, rugi: 0, bantu: 0, kolusi: 0, disita: 0, pinjol: 0, mimpiRaid: 0, pejabat: 0 },
      });
      lot.mem.push({ t: 0, text: `${usaha} mulai dari gerobak. ${P[seat].pasangan} ikut jaga.` });
    });
    NPC_USAHA.forEach(([name, level], k) => Object.assign(S.lots[[1, 5][k]], { npc: k, name, level }));
    if (opts.setup) opts.setup(S);

    let pending = new Map(), idSeq = 0, stopped = false;
    const name = (seat) => S.players[seat].name;
    const st = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
    const update = () => opts.onUpdate && opts.onUpdate(S);
    const log = (msg, extra) => { S.log.push(Object.assign({ n: ++S.logN, t: S.t, msg }, extra || {})); if (S.log.length > 80) S.log.shift(); update(); };
    const PACE = { bulan: 1.5, rekap: 5, kabar: 3, rencana: 2, aksi: 0.5, bangun: 1.5, produksi: 1, ancaman: 1.8, hasil: 1.5, lapas: 2, segel: 2.5, gusur: 2.5,
      sidang: 2, ott: 2, tagihan: 0.8, mimpi: 2.5, karyawan: 1.5, jabatan: 2, bantu: 1.2, karet: 1.2 };
    const pace = async (k = 1) => { if (opts.onPace) opts.onPace(k); const d = delayMs(); if (d) await sleep(d * k); };
    async function ev(type, data = {}) {
      const e = Object.assign({}, data, { n: ++S.evN, type, t: S.t });
      S.events.push(e); if (S.events.length > 24) S.events.shift();
      update();
      if (opts.onEvent) await opts.onEvent(e, S);
      if (PACE[type]) await pace(PACE[type]);
    }
    function ingat(lotOrSeat, text, kind) {
      const lot = typeof lotOrSeat === 'number' ? S.lots[P[lotOrSeat].lots[0]] : lotOrSeat;
      lot.mem.push({ t: S.t, text, kind }); if (lot.mem.length > 30) lot.mem.shift();
    }
    const kisah = (p, text) => { p.kisah.push({ t: S.t, text }); };

    // ---------- askAll / answer ----------
    function valid(p, choice) {
      const ok = p.options.filter((x) => !x.disabled).map((x) => x.id);
      if (p.pick) { const need = Math.min(p.pick, ok.length); return Array.isArray(choice) && choice.length === need && new Set(choice).size === need && choice.every((c) => ok.includes(c)); }
      if (p.multi) return Array.isArray(choice) && new Set(choice).size === choice.length && choice.every((c) => ok.includes(c));
      return ok.includes(choice);
    }
    /** reqs: [{seat, prompt, bot}] → Promise<[jawaban per req]> */
    async function askAll(reqs) {
      if (!reqs.length) return [];
      const batch = ++S.batch;
      const out = new Array(reqs.length);
      const waits = [];
      reqs.forEach((r, k) => {
        if (opts.strict && !valid(r.prompt, r.bot)) throw new Error(`bot choice ${JSON.stringify(r.bot)} tidak valid untuk ${r.prompt.kind}`);
        if (S.players[r.seat].bot) { out[k] = r.bot; if (r.prompt.kind === 'rencana') S.ready.push(r.seat); return; }
        const pr = Object.assign({ id: ++idSeq, seat: r.seat, bot: r.bot, batch }, r.prompt);
        S.prompts[r.seat] = pr;
        waits.push(new Promise((res) => { pending.set(r.seat, { id: pr.id, res: (c) => { out[k] = c; res(); } }); }));
      });
      if (waits.length) { update(); await Promise.all(waits); }
      else await pace(0.4);
      return out;
    }
    const ask = async (seat, prompt, bot) => (await askAll([{ seat, prompt, bot }]))[0];
    function answer(seat, id, choice) {
      const pr = S.prompts[seat], w = pending.get(seat);
      if (!pr || !w || pr.id !== id || w.id !== id || !valid(pr, choice)) return false;
      delete S.prompts[seat]; pending.delete(seat);
      if (pr.kind === 'rencana' && !S.ready.includes(seat)) S.ready.push(seat);
      w.res(choice); update();
      return true;
    }
    function setBot(seat, bot) {
      S.players[seat].bot = bot;
      if (bot && S.prompts[seat]) answer(seat, S.prompts[seat].id, S.prompts[seat].bot);
      update();
    }
    function stop() { stopped = true; for (const seat of [...pending.keys()]) { const pr = S.prompts[seat]; if (pr) answer(seat, pr.id, pr.bot); } }

    // ---------- helper ekonomi ----------
    const lotsOf = (p) => p.lots.map((i) => S.lots[i]);
    const main = (p) => S.lots[p.lots[0]];
    const segel = (lot) => lot.segelSampai >= S.t;
    const diLapas = (p) => p.lapas >= S.t;
    const liar = (p) => lotsOf(p).some((l) => l.level > p.izin);
    const slot = (p) => lotsOf(p).reduce((s, l) => s + C.SLOT[l.level], 0);
    const nilaiAset = (p) => lotsOf(p).reduce((s, l) => s + C.NILAI[l.level], 0);
    const tahapMimpi = (p) => Math.min(3, Math.floor(p.mimpi.celengan / C.MIMPI_TAHAP));
    const tetangga = (lot) => [S.lots[(lot.i + 7) % 8], S.lots[(lot.i + 1) % 8]];
    const hidup = (lot) => (lot.owner !== null || lot.npc !== null) && !segel(lot) && lot.level >= 1;
    function produksiLot(p, lot) {
      if (segel(lot)) return 0;
      let n = C.PROD[lot.level] + tetangga(lot).filter(hidup).length * (lot.level >= 1 ? 1 : 0) + (S.f.bahanNaik ? -1 : 0);
      if (lot.i === p.lots[0] && diLapas(p)) n -= C.LAPAS_PROD;
      if (lot.i === p.lots[0] && p.jabatan) n -= 1;
      return Math.max(0, n);
    }
    function karyawanProd(p) {
      if (lotsOf(p).every(segel)) return 0;
      return p.karyawan.reduce((s, k) => s + C.KAR_PROD + (k.trait === 'rajin' ? 1 : 0), 0);
    }
    const pemasukan = (p) => lotsOf(p).reduce((s, l) => s + produksiLot(p, l), 0) + karyawanProd(p);
    const kekayaanKasar = (p) => p.daun + nilaiAset(p) + p.mimpi.celengan - p.utang;

    /** Bayar `n` Daun ke `ke` ('sistem' | seat | 'negara'). Kurang? tawarkan Celengan Mimpi, sisanya pinjol. */
    async function bayar(p, n, ke, alasan) {
      if (n <= 0) return 0;
      p.catat.out = p.catat.out || {}; p.catat.out[alasan] = (p.catat.out[alasan] || 0) + n;
      if (p.daun < n) {
        const kurang = n - p.daun;
        if (p.mimpi.celengan > 0) {
          const M = MIMPI[p.mimpi.jenis];
          const pakai = Math.min(kurang, p.mimpi.celengan);
          const c = await ask(p.seat, { kind: 'celengan', text: `Daun-mu kurang ${kurang} untuk ${alasan}. Ambil dari Celengan "${M[1]}"?`, options: [
            { id: 'pakai', label: `${M[0]} Pakai celengan (${pakai})`, sub: `Celengan tinggal ${p.mimpi.celengan - pakai}. Mimpi mundur.` },
            { id: 'pinjol', label: '📱 Pinjam pinjol', sub: `Utang +${Math.ceil(kurang * (1 + C.PINJOL_BUNGA))}, bunga ${C.PINJOL_BUNGA * 100}% tiap bulan yang belum lunas` }] },
          p.strat === 'jujur' || S.t >= S.bulan - 2 ? 'pinjol' : 'pakai');
          if (c === 'pakai') {
            p.mimpi.celengan -= pakai; p.daun += pakai; p.catat.mimpiRaid += pakai; st('celengan_dibongkar', pakai);
            const txt = `Uang ${MIMPI[p.mimpi.jenis][1].toLowerCase()} (${pakai}) dipakai untuk ${alasan}.`;
            kisah(p, txt); ingat(p.seat, txt, 'luka'); log(`🐷 ${name(p.seat)} membongkar celengan mimpi untuk ${alasan}.`);
          }
        }
        if (p.daun < n) pinjol(p, n - p.daun);
      }
      p.daun -= n;
      if (typeof ke === 'number') { P[ke].daun += n; P[ke].catat.dapat = (P[ke].catat.dapat || 0) + n; }
      else if (ke === 'sistem') S.sistem += n;
      return n;
    }
    function pinjol(p, n) {
      const u = Math.ceil(n * (1 + C.PINJOL_BUNGA));
      p.daun += n; p.utang += u; p.catat.pinjol += n; st('pinjol', n);
      log(`📱 ${name(p.seat)} terpaksa pinjol ${n} (utang jadi ${p.utang}).`);
      kisah(p, `Terpaksa pinjol ${n} Daun.`);
    }

    // ---------- Kabar Negeri ----------
    async function bukaKabar() {
      S.f = { tarifPlus: 0, bahanNaik: false, karet: C.KARET, viralDua: false, ancamanPlus: 0, thr: false, festival: false, noBongkar: false, antikorupsi: false, setoranPlus: 0 };
      if (!S.decks.kabar.length) S.decks.kabar = shuffle(Object.keys(KABAR).map(Number));
      const k = S.decks.kabar.pop();
      S.kabar = { id: k };
      const f = S.f;
      if (k === 1) f.tarifPlus = 1;
      else if (k === 2) P.forEach((p) => { if (main(p).level <= 1) p.daun += 2; });
      else if (k === 3) f.bahanNaik = true;
      else if (k === 4) f.karet = 3;
      else if (k === 5) f.viralDua = true;
      else if (k === 6) P.forEach((p) => { p.lapas = 0; });
      else if (k === 7) f.ancamanPlus = 1;
      else if (k === 9) { P.forEach((p) => { if (p.jabatan) p.sorotan = Math.max(0, p.sorotan - 1); }); f.setoranPlus = 1; }
      else if (k === 10) f.thr = true;
      else if (k === 11) P.forEach((p) => { if (p.berkas) p.berkas.siap++; });
      else if (k === 12) f.festival = true;
      else if (k === 13) f.noBongkar = true;
      else if (k === 14) f.antikorupsi = true;
      log(`📰 Kabar Negeri: ${KABAR[k][0]} — ${KABAR[k][1]}`);
      await ev('kabar', { id: k });
    }

    // ---------- Rencana (serentak) ----------
    function opsiRencana(p) {
      const m = main(p), cab = p.lots[1] !== undefined ? S.lots[p.lots[1]] : null;
      const biaya = (lot) => Math.ceil(C.BANGUN[lot.level + 1] * (lot.fondasi > lot.level ? C.FONDASI : 1));
      const o = [];
      o.push({ id: 'jualan', label: '🧺 Jualan keras', sub: `+${C.JUALAN[m.level] + (S.f.festival ? 3 : 0) - (p.jualanMinus ? 2 : 0)} Daun` });
      if (m.level < 4) {
        const nx = m.level + 1, b = biaya(m);
        o.push({ id: 'bangun', label: `🔨 Bangun ${LEVEL[nx]}`, sub: `${b} Daun${nx > p.izin ? ' · ⚠️ TANPA IZIN: rawan sidak & gusur' : ' · izin ada'}`, disabled: p.daun < b });
      }
      if (cab && cab.level < 4) {
        const nx = cab.level + 1, b = biaya(cab);
        o.push({ id: 'bangun_cabang', label: `🔨 Bangun cabang jadi ${LEVEL[nx]}`, sub: `${b} Daun${nx > p.izin ? ' · ⚠️ tanpa izin' : ''}`, disabled: p.daun < b });
      }
      if (p.izin < 4) {
        o.push({ id: 'izin_resmi', label: `🏛️ Urus izin ${LEVEL[p.izin + 1]} (resmi)`, sub: p.berkas ? `Sedang diproses, jadi bulan ${p.berkas.siap}` : `Gratis, jadi ${C.IZIN_PROSES} bulan lagi`, disabled: !!p.berkas });
        o.push({ id: 'izin_calo', label: `💼 Izin lewat calo (${C.CALO[p.izin + 1]})`, sub: 'Langsung jadi · uangnya ke Kasi Perizinan · Sorotan +1' });
      }
      o.push({ id: 'rekrut', label: `🙋 Rekrut karyawan (${C.KAR_REKRUT})`, sub: `+${C.KAR_PROD} produksi, gaji ${C.KAR_GAJI}/bulan · slot ${p.karyawan.length}/${slot(p)}`, disabled: p.karyawan.length >= slot(p) || p.daun < C.KAR_REKRUT });
      const kosong = S.lots.filter((l) => l.kosong && l.owner === null);
      if (!cab) o.push({ id: 'cabang', label: `📍 Buka cabang (${C.CABANG})`, sub: kosong.length ? `Lahan kosong: ${kosong.length}. Siapa cepat dia dapat.` : 'Tidak ada lahan kosong', disabled: !kosong.length || p.daun < C.CABANG || m.level < 1 });
      o.push({ id: 'lobi', label: `🤝 Lobi orang dalam (${C.LOBI})`, sub: `+1 Backing (maks ${C.BACKING_MAX}). Melindungi dari sorotan & membuka Minta Istana`, disabled: p.backing >= C.BACKING_MAX || p.daun < C.LOBI });
      o.push({ id: 'rekam', label: '📹 Kumpulkan bukti', sub: `+1 Rekaman (maks ${C.REKAMAN_MAX}). Senjata untuk memviralkan`, disabled: p.rekaman >= C.REKAMAN_MAX });
      if (m.level >= 2) o.push({ id: 'proyek', label: `📜 Ambil proyek negara (+${C.PROYEK[m.level]})`, sub: `Untung besar sekarang · Jejak +${C.PROYEK_JEJAK}: incaran Pasal 2/3` });
      const bebas = Object.keys(JABATAN).filter((k) => !S.jabatan[k]);
      if (!p.jabatan && S.t >= C.JABATAN_DARI && S.t <= C.JABATAN_SAMPAI && bebas.length) {
        const h = hargaJabatan(p);
        o.push({ id: 'jabatan', label: `🎖️ Beli jabatan (${h})`, sub: 'Masuk sistem: kebal & ikut memeras. Usaha dijaga pasangan (−1)', disabled: p.daun < h || p.backing < 1 });
      }
      if (p.jabatan) o.push({ id: 'mundur', label: '🚪 Mundur dari jabatan', sub: 'Kembali mengurus usaha dan keluarga' });
      return o;
    }
    const hargaJabatan = (p) => C.JABATAN_HARGA + C.JABATAN_PER_LEVEL * main(p).level;

    function botRencana(p, opsi) {
      const ok = (id) => opsi.some((o) => o.id === id && !o.disabled);
      const n = Math.min(nAksi(p), opsi.filter((o) => !o.disabled).length);
      const m = main(p), s = p.strat === 'campur' ? 'kolusi' : p.strat;
      const pref = [];
      if (s === 'pejabat' && ok('jabatan') && botBolehJabatan(p)) pref.push('jabatan');
      if (p.jabatan && p.sorotan >= 8 && !p.backing) pref.push('mundur');
      const nx = m.level + 1;
      const izinCukup = nx <= p.izin;
      if (s === 'jujur') {
        if (izinCukup && ok('bangun')) pref.push('bangun');
        if (ok('izin_resmi') && p.izin <= m.level + 1) pref.push('izin_resmi');   // urus izin selangkah lebih dulu
      } else {
        const b = C.BANGUN[nx] || 99;
        if (!izinCukup && ok('izin_calo') && p.daun >= C.CALO[p.izin + 1] + b) pref.push('izin_calo', 'bangun');
        else if (ok('bangun') && (izinCukup || s === 'kolusi')) pref.push('bangun');   // kolusi: bangun dulu, urusan izin "bisa diatur"
        if (ok('izin_resmi') && p.izin <= m.level + 1) pref.push('izin_resmi');
      }
      if (ok('rekrut')) pref.push('rekrut');
      if (ok('cabang') && p.daun >= C.CABANG + 3 && S.t <= 8) pref.push('cabang');
      if (s !== 'jujur' && ok('proyek') && p.jejak <= 2) pref.push('proyek');
      if (ok('bangun_cabang') && (s !== 'jujur' || S.lots[p.lots[1]].level + 1 <= p.izin)) pref.push('bangun_cabang');
      if (s === 'pejabat' && ok('lobi') && S.t >= 2 && S.t <= 8 && !p.backing) pref.push('lobi');
      if (s === 'jujur' && ok('rekam') && p.rekaman < 1) pref.push('rekam');
      if (ok('lobi') && p.jejak >= 2 && p.backing < 2 && s !== 'jujur') pref.push('lobi');
      pref.push('jualan');
      if (ok('rekam')) pref.push('rekam');
      for (const o of opsi) if (!o.disabled) pref.push(o.id);
      const out = [];
      for (const id of pref) if (ok(id) && !out.includes(id) && out.length < n) out.push(id);
      return out;
    }
    const botBolehJabatan = (p) => {
      const manusiaPejabat = P.some((q) => q.jabatan && !S.players[q.seat].bot);
      const botPejabat = P.filter((q) => (q.jabatan || q.catat.pejabat) && S.players[q.seat].bot && q !== p).length;
      return !manusiaPejabat && botPejabat === 0;
    };
    const nAksi = (p) => Math.max(1, 2 - p.aksiMinus - (diLapas(p) ? 1 : 0));

    async function rencana() {
      S.stage = 'rencana'; S.ready = []; S.plan = {};
      const reqs = P.map((p) => {
        const opsi = opsiRencana(p);
        const n = nAksi(p);
        return { seat: p.seat, prompt: { kind: 'rencana', pick: n, text: `Bulan ${S.t}: pilih ${n} rencana${n < 2 ? (diLapas(p) ? ' (kamu ditahan)' : ' (keluarga butuh kamu di rumah)') : ''}.`, options: opsi }, bot: botRencana(p, opsi) };
      });
      const hasil = await askAll(reqs);
      hasil.forEach((h, k) => { S.plan[reqs[k].seat] = h; });
      await ev('rencana', {});
      // urutan eksekusi bergilir tiap bulan (rebutan lahan & jabatan)
      const urut = P.map((p, i) => P[(i + S.t) % P.length]);
      for (const p of urut) for (const a of S.plan[p.seat]) { if (stopped) return; await jalankan(p, a); }
      P.forEach((p) => { p.aksiMinus = 0; p.jualanMinus = Math.max(0, p.jualanMinus - 1); });
    }

    async function jalankan(p, a) {
      const m = main(p);
      if (a === 'jualan') {
        const n = Math.max(0, C.JUALAN[m.level] + (S.f.festival ? 3 : 0) - (p.jualanMinus ? 2 : 0));
        p.daun += n; log(`🧺 ${name(p.seat)} jualan keras: +${n} Daun.`, { seat: p.seat });
      } else if (a === 'bangun' || a === 'bangun_cabang') {
        const lot = a === 'bangun' ? m : S.lots[p.lots[1]];
        if (!lot || lot.level >= 4) return;
        const b = Math.ceil(C.BANGUN[lot.level + 1] * (lot.fondasi > lot.level ? C.FONDASI : 1));
        if (p.daun < b) { log(`${name(p.seat)} batal membangun: uangnya sudah terpakai.`); return; }
        p.daun -= b; lot.level++;
        if (lot.fondasi && lot.fondasi <= lot.level) lot.fondasi = 0;
        const tanpa = lot.level > p.izin;
        if (tanpa) st('bangun_tanpa_izin');
        if (lot.level >= 2 && p.catat.tokoT === null) p.catat.tokoT = S.t;
        const kar = p.karyawan.length ? p.karyawan[Math.floor(rng() * p.karyawan.length)].nama : p.pasangan;
        ingat(lot, `${LEVEL_EM[lot.level]} ${LEVEL[lot.level]} dibuka${tanpa ? ' (izin belum ada)' : ''}. ${kar} ${lot.level >= 3 ? 'memasang papan nama baru' : 'ikut jaga'}.`, 'naik');
        log(`${LEVEL_EM[lot.level]} ${name(p.seat)} membangun ${lot.name} jadi ${LEVEL[lot.level]}${tanpa ? ' — tanpa izin!' : ''}.`, { seat: p.seat });
        await ev('bangun', { seat: p.seat, lot: lot.i, level: lot.level });
      } else if (a === 'izin_resmi') {
        if (!p.berkas && p.izin < 4) { p.berkas = { level: p.izin + 1, siap: S.t + C.IZIN_PROSES }; log(`🏛️ ${name(p.seat)} mengajukan izin ${LEVEL[p.izin + 1]} lewat jalur resmi (jadi bulan ${p.berkas.siap}).`, { seat: p.seat }); }
      } else if (a === 'izin_calo') {
        if (p.izin >= 4) return;
        const b = C.CALO[p.izin + 1], ke = pemegang('kasi', p);
        await bayar(p, b, ke !== null ? ke : 'sistem', 'calo izin');
        p.izin++; p.berkas = null; p.sorotan++; st('calo', b); await kolusi(p, 'lewat calo');
        if (ke !== null) await setoranMasuk(P[ke]);
        log(`💼 ${name(p.seat)} membayar calo ${b}: izin ${LEVEL[p.izin]} langsung jadi.`, { seat: p.seat });
      } else if (a === 'rekrut') {
        if (p.karyawan.length >= slot(p) || p.daun < C.KAR_REKRUT) return;
        p.daun -= C.KAR_REKRUT;
        const k = { nama: namaPool.pop() || 'Karyawan', trait: pick1(Object.keys(TRAIT)), sejak: S.t };
        p.karyawan.push(k);
        const T = TRAIT[k.trait];
        ingat(p.seat, `${k.nama} mulai bekerja (${T[1]}).`, 'orang');
        log(`🙋 ${name(p.seat)} merekrut ${k.nama} ${T[0]} (${T[1]}).`, { seat: p.seat });
        await ev('karyawan', { seat: p.seat, nama: k.nama, trait: k.trait, masuk: true });
      } else if (a === 'cabang') {
        const kosong = S.lots.filter((l) => l.kosong && l.owner === null);
        if (!kosong.length || p.lots[1] !== undefined || p.daun < C.CABANG) { log(`📍 ${name(p.seat)} kalah cepat: lahannya sudah diambil.`); return; }
        const dekat = kosong.sort((x, y) => jarak(x.i, m.i) - jarak(y.i, m.i));
        let lot = dekat[0];
        if (dekat.length > 1) {
          const c = await ask(p.seat, { kind: 'lahan', text: 'Pilih lahan untuk cabang.', options: dekat.map((l) => ({ id: l.i, label: `Kavling ${l.i + 1}`, sub: `Bertetangga dengan ${tetangga(l).map((x) => x.name || 'lahan kosong').join(' & ')}` })) }, dekat[0].i);
          lot = S.lots[c];
        }
        p.daun -= C.CABANG; lot.owner = p.seat; lot.level = 0; lot.name = `${m.name} Cabang`; p.lots.push(lot.i);
        ingat(lot, `Cabang dibuka. ${p.anak} ikut membantu sepulang sekolah.`, 'naik');
        log(`📍 ${name(p.seat)} membuka cabang di kavling ${lot.i + 1}.`, { seat: p.seat });
        await ev('bangun', { seat: p.seat, lot: lot.i, level: 0, cabang: true });
      } else if (a === 'lobi') {
        if (p.backing >= C.BACKING_MAX || p.daun < C.LOBI) return;
        p.daun -= C.LOBI; S.sistem += C.LOBI; p.backing++; st('lobi', C.LOBI);
        log(`🤝 ${name(p.seat)} melobi orang dalam: +1 Backing.`, { seat: p.seat });
      } else if (a === 'rekam') {
        if (p.rekaman < C.REKAMAN_MAX) { p.rekaman++; log(`📹 ${name(p.seat)} mengumpulkan bukti (+1 Rekaman).`, { seat: p.seat }); }
      } else if (a === 'proyek') {
        if (m.level < 2) return;
        p.daun += C.PROYEK[m.level]; p.jejak += C.PROYEK_JEJAK; p.sorotan++; st('proyek');
        ingat(p.seat, `Menang proyek negara (+${C.PROYEK[m.level]}). Ada jejak yang tertinggal.`, 'jejak');
        log(`📜 ${name(p.seat)} mengambil proyek negara: +${C.PROYEK[m.level]} Daun, Jejak +${C.PROYEK_JEJAK}.`, { seat: p.seat });
      } else if (a === 'jabatan') {
        const bebas = Object.keys(JABATAN).filter((k) => !S.jabatan[k]);
        const h = hargaJabatan(p);
        if (!bebas.length || p.jabatan || p.daun < h || p.backing < 1) { log(`🎖️ ${name(p.seat)} gagal membeli jabatan: kursinya sudah terisi.`); return; }
        const botPos = bebas.includes('kasi') ? 'kasi' : bebas[0];
        const pos = bebas.length > 1 ? await ask(p.seat, { kind: 'pilih_jabatan', text: 'Jabatan mana yang kamu beli?', options: bebas.map((k) => ({ id: k, label: `${JABATAN[k][0]} ${JABATAN[k][1]}`, sub: `Mengendalikan ${JABATAN[k][2]}` })) }, botPos) : bebas[0];
        p.daun -= h; S.sistem += h; p.backing--; p.jabatan = pos; p.jabatanSejak = S.t; p.catat.pejabat = 1; S.jabatan[pos] = p.seat; st('jabatan_dibeli');
        kisah(p, `Membeli jabatan ${JABATAN[pos][1]}. ${p.pasangan} kini menjaga ${m.name} sendirian.`);
        ingat(p.seat, `Pemiliknya jadi ${JABATAN[pos][1]}. ${p.pasangan} menjaga usaha sendirian.`, 'jabatan');
        log(`🎖️ ${name(p.seat)} kini ${JABATAN[pos][0]} ${JABATAN[pos][1]}. Ia masuk ke dalam sistem.`, { seat: p.seat });
        await ev('jabatan', { seat: p.seat, pos, masuk: true });
      } else if (a === 'mundur') {
        if (p.jabatan) await lepasJabatan(p, 'mundur');
      }
    }
    const jarak = (a, b) => Math.min((a - b + 8) % 8, (b - a + 8) % 8);

    async function lepasJabatan(p, sebab) {
      const pos = p.jabatan; S.jabatan[pos] = null; p.jabatan = null;
      const txt = sebab === 'mundur' ? `Mundur dari ${JABATAN[pos][1]} dan kembali ke usaha.` : sebab === 'copot' ? `Dicopot dari ${JABATAN[pos][1]}: setoran ke atas macet.` : `Kena OTT, dicopot dari ${JABATAN[pos][1]}.`;
      kisah(p, txt); ingat(p.seat, txt, 'jabatan');
      log(`🎖️ ${name(p.seat)}: ${txt}`, { seat: p.seat });
      await ev('jabatan', { seat: p.seat, pos, masuk: false, sebab });
    }
    const pemegang = (pos, kecuali) => (S.jabatan[pos] !== null && S.jabatan[pos] !== kecuali.seat ? S.jabatan[pos] : null);
    async function kolusi(p, apa) {
      p.kolusi++; p.catat.kolusi++; st('kolusi');
      if (p.kolusi % C.KOLUSI_MALU !== 0) return;
      const setia = p.karyawan.find((k) => k.trait === 'setia');
      if (setia && rng() < 0.5) {
        p.karyawan.splice(p.karyawan.indexOf(setia), 1);
        const txt = `${setia.nama} berhenti: "Saya kerja jujur, Bos. Saya tidak mau ikut ${apa}."`;
        kisah(p, txt); ingat(p.seat, txt, 'luka'); log(`😔 ${txt}`, { seat: p.seat });
        await ev('karyawan', { seat: p.seat, nama: setia.nama, masuk: false, sebab: 'malu' });
      } else {
        const txt = `${p.anak} bertanya, "Kenapa kita harus kasih amplop terus?" Tidak ada yang bisa menjawab.`;
        kisah(p, txt); log(`😶 ${txt}`, { seat: p.seat });
      }
    }
    async function setoranMasuk(pj) {
      await naikSorotan(pj, S.f.antikorupsi ? 2 : 1);
    }

    // ---------- Produksi ----------
    async function produksi() {
      for (const p of P) {
        const n = pemasukan(p) + (p.jabatan ? C.TUNJANGAN : 0);
        p.daun += n;
        if (p.berkas && S.t < p.berkas.siap && rng() < C.BERKAS_HILANG) {
          p.berkas = null; st('berkas_hilang');
          log(`📂 Berkas izin ${name(p.seat)} "hilang" di kantor. Harus mengajukan dari awal.`, { seat: p.seat });
          kisah(p, 'Berkas izin "hilang" di kantor. Mengulang dari awal.');
        }
        if (p.berkas && S.t >= p.berkas.siap) { p.izin = p.berkas.level; p.berkas = null; log(`🏛️ Izin ${LEVEL[p.izin]} ${name(p.seat)} akhirnya jadi, lewat jalur resmi.`, { seat: p.seat }); }
      }
      log(`🏭 Produksi bulan ${S.t}: ${P.map((p) => `${name(p.seat)} +${pemasukan(p) + (p.jabatan ? C.TUNJANGAN : 0)}`).join(' · ')}.`);
      await ev('produksi', {});
    }

    // ---------- Mata Aparat ----------
    function jenisUntuk(p) {
      const opsi = [['razia', 3]];
      if (liar(p)) { opsi.push(['sidak', 5]); if (main(p).level <= 2) opsi.push(['gusur', 3]); }
      if (p.jejak >= 1 || main(p).level >= 3) opsi.push(['pasal23', 2 + p.jejak * 2]);
      if (S.t - p.viralT <= 2) opsi.push(['rekayasa', 4]);
      const tot = opsi.reduce((s, x) => s + x[1], 0);
      let r = rng() * tot;
      for (const [k, w] of opsi) { r -= w; if (r < 0) return k; }
      return 'razia';
    }
    function jenisDomain(pos, p) {
      if (pos === 'kanit') return p && S.t - p.viralT <= 2 ? 'rekayasa' : 'razia';
      if (pos === 'kasi') return p && !liar(p) ? 'razia' : 'sidak';
      return p && !cocok(p, 'pasal23') ? 'razia' : 'pasal23';
    }
    function bobot(p) {
      let w = 1 + main(p).level * 1.5 + p.sorotan / 2 + (liar(p) ? 3 : 0) + p.jejak + Math.max(0, p.daun - 15) / 5;
      if (!liar(p) && p.backing) w *= C.LINDUNG_IZIN_BACKING;
      else if (p.backing) w *= C.LINDUNG_BACKING;
      else if (!liar(p)) w *= C.LINDUNG_IZIN;
      if (p.ottSampai >= S.t) w *= 2;
      if (p.langgananSampai >= S.t) w *= C.LANGGANAN;   // sudah "setor rutin": dibiarkan
      if (p.dicatatSampai >= S.t) w *= C.DICATAT;       // pembangkang: dicatat aparat
      return Math.min(w, 9);
    }
    const bolehTarget = (p) => !C.LINDUNG || (!(p.kebalSampai >= S.t) && p.targetT !== S.t);
    function undi(calon) {
      const tot = calon.reduce((s, c) => s + c.w, 0);
      let r = rng() * tot;
      for (const c of calon) { r -= c.w; if (r < 0) return c; }
      return calon[calon.length - 1];
    }
    async function mataAparat() {
      S.stage = 'ancaman';
      const n = (C.ANCAMAN[S.t] || 3) + S.f.ancamanPlus;
      const dipakai = new Set();
      const antre = [];
      for (const pos of Object.keys(JABATAN)) if (S.jabatan[pos] !== null) for (let j = 0; j < C.TAGIH_SENDIRI; j++) antre.push(pos);
      for (let k = 0; k < n + antre.length && !stopped; k++) {
        const posSendiri = k < antre.length ? antre[k] : null;
        const calonP = P.filter((p) => bolehTarget(p) && !dipakai.has(p.seat)).map((p) => ({ p, w: bobot(p) }));
        const calonN = S.lots.filter((l) => l.npc !== null && !segel(l) && !dipakai.has('n' + l.npc)).map((l) => ({ npc: l, w: 1.2 }));
        const calon = calonP.concat(calonN);
        if (!calon.length) break;
        const scripted = script.ancaman && script.ancaman.length ? script.ancaman.shift() : null;
        let c = scripted ? (scripted.seat !== undefined ? calon.find((x) => x.p && x.p.seat === scripted.seat) : null) || undi(calon) : undi(calon);
        let jenis = scripted && scripted.jenis ? scripted.jenis : posSendiri ? jenisDomain(posSendiri, c.p) : c.p ? jenisUntuk(c.p) : pick1(['razia', 'sidak']);
        // pemegang jabatan pada domain ini memilih dari 2 kandidat (atau melepas keduanya)
        const pos = posSendiri || DOMAIN[jenis], holder = S.jabatan[pos];
        if (holder !== null && holder !== undefined) {
          const lain = calon.filter((x) => x !== c && !(x.p && x.p.seat === holder));
          const cand = [c].filter((x) => !(x.p && x.p.seat === holder));
          if (lain.length && cand.length < 2) cand.push(undi(lain));
          if (!cand.length) continue;
          const pj = P[holder];
          const label = (x) => (x.p ? `${name(x.p.seat)} — ${main(x.p).name} (${LEVEL[main(x.p).level]})` : x.npc.name);
          const botPick = cand.slice().sort((a, b) => (b.p ? b.p.daun : 3) - (a.p ? a.p.daun : 3))[0];
          const ch = await ask(holder, { kind: 'pilih_target', text: `${JABATAN[pos][0]} Sebagai ${JABATAN[pos][1]}, siapa yang kamu "tertibkan" bulan ini? (${ANCAMAN_NAMA[jenis]})`,
            options: cand.map((x, i) => ({ id: i, label: label(x), sub: x.p ? `Daun ${x.p.daun} · Sorotan ${x.p.sorotan}` : 'Usaha warga (NPC)' }))
              .concat([{ id: 'lepas', label: '🙈 Lepaskan semua', sub: 'Tidak menagih bulan ini · Sorotanmu −1' }]) }, pj.sorotan >= 7 || (S.t === S.bulan && pj.sorotan >= C.MUTASI_SOR - 2) ? 'lepas' : cand.indexOf(botPick));
          if (ch === 'lepas') { pj.sorotan = Math.max(0, pj.sorotan - 1); st('pejabat_lepas'); log(`🙈 ${name(holder)} melepas target bulan ini.`); continue; }
          c = cand[ch];
        }
        if (c.p) { dipakai.add(c.p.seat); c.p.targetT = S.t; }
        else dipakai.add('n' + c.npc.npc);
        if (c.p && c.p.jabatan === pos) continue;   // kebal di domain sendiri
        if (c.npc) await ancamanNpc(c.npc, jenis);
        else await ancaman(c.p, cocok(c.p, jenis) ? jenis : 'razia', pos);
      }
      S.stage = 'play';
    }
    async function ancamanNpc(lot, jenis) {
      const pos = DOMAIN[jenis], holder = S.jabatan[pos];
      if (jenis === 'sidak' || rng() < 0.4) {
        lot.segelSampai = S.t + C.SEGEL; st('npc_disegel');
        lot.mem.push({ t: S.t, text: 'Disegel. Pemiliknya tidak sanggup bayar "uang damai".' });
        log(`📋 ${lot.name} disegel aparat. Pemiliknya tidak sanggup bayar.`);
        await ev('segel', { lot: lot.i, npc: true });
      } else {
        const n = 2; st('npc_setor', n);
        if (holder !== null && holder !== undefined) { P[holder].daun += n; await setoranMasuk(P[holder]); } else S.sistem += n;
        log(`🚨 ${lot.name} kena ${ANCAMAN_NAMA[jenis].slice(2)}, membayar ${n} "uang damai".`);
        await ev('ancaman', { lot: lot.i, npc: true, jenis });
      }
    }

    /** Jendela solidaritas: pemain lain boleh membantu korban (serentak). */
    async function solidaritas(korban, jenis) {
      const penolong = P.filter((q) => q !== korban && q.jabatan !== DOMAIN[jenis] && !diLapas(q));
      if (!penolong.length || korban.dijauhi >= S.t) {
        if (korban.dijauhi >= S.t) log(`💌 Tidak ada tetangga yang datang membantu ${name(korban.seat)}.`);
        return { daun: 0, rekaman: 0, saksi: 0, nama: [] };
      }
      const m = main(korban);
      const reqs = penolong.map((q) => {
        const tetanggaan = tetangga(m).some((l) => l.owner === q.seat) || q.lots.some((i) => tetangga(S.lots[i]).includes(m));
        const s = q.strat === 'campur' ? 'kolusi' : q.strat;
        const mau = s === 'jujur' ? q.daun >= 4 : s === 'kolusi' ? tetanggaan && q.daun >= 7 : false;
        const opsi = [
          { id: 'patungan', label: `🤲 Patungan ${C.BANTU} Daun`, sub: 'Uangmu untuk membantunya bayar', disabled: q.daun < C.BANTU },
          { id: 'rekam', label: '📹 Pinjamkan Rekaman', sub: 'Buktimu untuk memviralkan kasusnya', disabled: !q.rekaman },
        ];
        if (jenis === 'pasal23') opsi.push({ id: 'saksi', label: '🧑‍⚖️ Jadi saksi', sub: '+1 di sidang · Sorotanmu +1' });
        opsi.push({ id: 'diam', label: '🤐 Diam saja', sub: tetanggaan ? 'Kalau usahanya tutup, keramaianmu ikut turun' : '' });
        return { seat: q.seat, prompt: { kind: 'solidaritas', korban: korban.seat, text: `${ANCAMAN_NAMA[jenis]} menimpa ${name(korban.seat)} (${m.name}). Mau membantu?`, options: opsi },
          bot: mau ? (q.daun >= C.BANTU ? 'patungan' : q.rekaman ? 'rekam' : 'diam') : 'diam' };
      });
      await ev('ancaman', { seat: korban.seat, jenis, solidaritas: true });
      const hasil = await askAll(reqs);
      const bantu = { daun: 0, rekaman: 0, saksi: 0, nama: [] };
      for (let k = 0; k < reqs.length; k++) {
        const q = P[reqs[k].seat], c = hasil[k];
        if (c === 'diam') continue;
        if (c === 'patungan' && q.daun >= C.BANTU) { q.daun -= C.BANTU; korban.daun += C.BANTU; bantu.daun += C.BANTU; }
        else if (c === 'rekam' && q.rekaman) { q.rekaman--; bantu.rekaman++; }
        else if (c === 'saksi') { bantu.saksi++; q.sorotan++; }
        else continue;
        bantu.nama.push(name(q.seat)); q.catat.bantu++; st('solidaritas');
        if (S.t >= C.BANTU_MIMPI_DARI) { q.mimpi.celengan += 1; }
        ingat(korban.seat, `${name(q.seat)} datang membantu saat ${ANCAMAN_NAMA[jenis].slice(2).toLowerCase()}.`, 'bantu');
        kisah(q, `Membantu ${name(korban.seat)} saat ${ANCAMAN_NAMA[jenis].slice(2).toLowerCase()}.`);
      }
      if (bantu.nama.length) { log(`🤲 ${bantu.nama.join(', ')} membantu ${name(korban.seat)}.`, { seat: korban.seat }); await ev('bantu', { seat: korban.seat, dari: bantu.nama }); }
      else log(`🤐 Tidak ada yang membantu ${name(korban.seat)}.`);
      return bantu;
    }
    function simpati(p) { if (C.LINDUNG && !p.rekaman) { p.rekaman = 1; log(`📹 Simpati publik: warganet membela ${name(p.seat)} (+1 Rekaman).`); } }
    const capRugi = (p, n) => (C.LINDUNG ? Math.min(n, Math.max(1, Math.floor(C.CAP * Math.max(0, kekayaanKasar(p))))) : n);

    async function viral(p, pos, rekaman) {
      p.rekaman = Math.max(0, p.rekaman - rekaman); p.viralT = S.t; p.dicatatSampai = S.t + C.DICATAT_BULAN; st('viral');
      const holder = S.jabatan[pos];
      if (holder !== null && holder !== undefined && holder !== p.seat) await naikSorotan(P[holder], 3);
      const d = d6();
      await ev('karet', { seat: p.seat, d });
      if (d <= S.f.karet) {
        await masukLapas(p, 'pasal karet (dilaporkan balik karena unggahannya)');
        st('lapas_karet');
        return false;
      }
      log(`Dadu Pasal Karet ${d}: ${name(p.seat)} aman.`);
      return true;
    }
    async function masukLapas(p, sebab) {
      p.lapas = S.t + 1; p.kebalSampai = Math.max(p.kebalSampai, S.t + C.KEBAL); simpati(p);
      const txt = `${name(p.seat)} ditahan: ${sebab}. ${p.pasangan} menjaga ${main(p).name} sendirian.`;
      kisah(p, `Ditahan: ${sebab}.`); ingat(p.seat, txt, 'luka'); log(`🔒 ${txt}`, { seat: p.seat });
      p.catat.rugi++; st('lapas');
      await ev('lapas', { seat: p.seat });
    }
    async function disegel(p, lot) {
      lot.segelSampai = S.t + C.SEGEL; p.kebalSampai = Math.max(p.kebalSampai, S.t + C.KEBAL); p.catat.rugi++; st('segel');
      const pergi = [];
      if (lotsOf(p).every((l) => segel(l))) {
        for (const k of p.karyawan.slice()) {
          if (k.trait === 'setia' && !k.bertahan) { k.bertahan = true; continue; }
          p.karyawan.splice(p.karyawan.indexOf(k), 1); pergi.push(k);
        }
      }
      const txt = `Disegel ${C.SEGEL} bulan.${pergi.length ? ` ${pergi.map((k) => k.nama).join(', ')} dirumahkan.` : ''}`;
      ingat(lot, txt, 'luka'); kisah(p, `${lot.name} disegel.${pergi.length ? ` ${pergi.map((k) => k.nama + (k.trait === 'tulang' ? ' (yang menghidupi 3 adiknya)' : '')).join(', ')} dirumahkan.` : ''}`);
      log(`📋 ${lot.name} DISEGEL ${C.SEGEL} bulan.${pergi.length ? ` ${pergi.map((k) => k.nama).join(', ')} dirumahkan.` : ''}`, { seat: p.seat });
      simpati(p);
      await ev('segel', { seat: p.seat, lot: lot.i, pergi: pergi.map((k) => k.nama) });
    }
    async function digusur(p, lot) {
      const dari = lot.level;
      lot.fondasi = Math.max(lot.fondasi, dari); lot.level = Math.max(0, dari - 1); p.kebalSampai = Math.max(p.kebalSampai, S.t + C.KEBAL); p.catat.rugi++; st('gusur');
      while (p.karyawan.length > slot(p)) { const k = p.karyawan.pop(); kisah(p, `${k.nama} kehilangan pekerjaan setelah penggusuran.`); }
      const txt = `Digusur: ${LEVEL[dari]} dibongkar jadi ${LEVEL[lot.level]}. Fondasinya masih ada.`;
      ingat(lot, txt, 'luka'); kisah(p, `${lot.name} digusur (${LEVEL[dari]} → ${LEVEL[lot.level]}).`);
      log(`🚜 ${lot.name} DIGUSUR: ${LEVEL[dari]} → ${LEVEL[lot.level]}.`, { seat: p.seat });
      simpati(p);
      await ev('gusur', { seat: p.seat, lot: lot.i, dari, ke: lot.level });
    }

    const cocok = (p, jenis) => (jenis === 'sidak' || jenis === 'gusur' ? liar(p) : jenis === 'pasal23' ? p.jejak >= 1 || main(p).level >= 3 : true);
    async function ancaman(p, jenis, pos = DOMAIN[jenis]) {
      const holder = S.jabatan[pos];
      const ke = holder !== null && holder !== undefined && holder !== p.seat ? holder : 'sistem';
      const m = main(p), lvl = m.level;
      const pelaku = ke === 'sistem' ? 'aparat' : name(ke);
      const kali = (n) => (typeof ke === 'number' ? Math.ceil(n * C.TARIF_PEJABAT) : n);   // pejabat pemain menaikkan "tarif"
      const setor = async (n, alasan) => { p.langgananSampai = S.t + C.LANGGANAN_BULAN; await bayar(p, n, ke, alasan); if (typeof ke === 'number') await setoranMasuk(P[ke]); await kolusi(p, alasan); st('setoran_' + jenis, n); };
      p.catat.target = (p.catat.target || 0) + 1;
      log(`${ANCAMAN_NAMA[jenis]} mendatangi ${m.name} (${name(p.seat)})${ke === 'sistem' ? '' : `, atas perintah ${name(ke)}`}.`, { seat: p.seat });
      await ev('ancaman', { seat: p.seat, jenis, oleh: ke });
      const s = p.strat === 'campur' ? 'kolusi' : p.strat;
      if (jenis === 'razia') {
        const tarif = kali(C.TARIF_86[lvl] + S.f.tarifPlus), tilang = C.TILANG[lvl];
        const c = await ask(p.seat, { kind: 'razia', text: `🚨 Razia di depan ${m.name}! ${pelaku === 'aparat' ? 'Aparat' : pelaku} minta "uang koordinasi".`, options: [
          { id: '86', label: `💵 Damai "86" (${tarif})`, sub: `Ke ${pelaku}. Cepat beres.` },
          { id: 'tilang', label: `🧾 Tilang resmi (${tilang})`, sub: 'Lebih mahal, tapi uangnya ke kas negara' },
          { id: 'viral', label: '📹 Rekam & viralkan', sub: `Tidak bayar · ${pelaku === 'aparat' ? '' : `Sorotan ${pelaku} +3 · `}dadu Pasal Karet 1–${S.f.karet} = ditahan`, disabled: !p.rekaman }] },
        s === 'jujur' ? (p.rekaman ? 'viral' : 'tilang') : '86');
        if (c === '86') { await setor(tarif, 'uang 86'); log(`💵 ${name(p.seat)} membayar "86" ${tarif}.`, { seat: p.seat }); }
        else if (c === 'tilang') { await bayar(p, tilang, 'negara', 'tilang'); st('tilang'); p.dicatatSampai = S.t + C.DICATAT_BULAN; log(`🧾 ${name(p.seat)} memilih tilang resmi (${tilang}).`, { seat: p.seat }); }
        else { log(`📹 ${name(p.seat)} memviralkan razia itu!`, { seat: p.seat }); await viral(p, pos, 1); }
        await ev('hasil', { seat: p.seat, jenis, c });
        return;
      }
      if (jenis === 'rekayasa') {
        const c = await ask(p.seat, { kind: 'rekayasa', text: `⚖️ ${name(p.seat)} dijadikan kambing hitam sebuah kasus!`, options: [
          { id: 'bongkar', label: '📹 Bongkar dengan rekaman', sub: `Kasus batal${pelaku === 'aparat' ? '' : ` · Sorotan ${pelaku} +3`}`, disabled: !p.rekaman || S.f.noBongkar },
          { id: 'tebus', label: `💵 Tebus (${kali(4 + lvl)})`, sub: `Ke ${pelaku}. Kasusnya "hilang".` },
          { id: 'terima', label: '🔒 Tidak bisa melawan', sub: 'Ditahan 1 bulan: aksimu tinggal 1, usaha utama −1' }] },
        p.rekaman && !S.f.noBongkar ? 'bongkar' : s === 'jujur' ? 'terima' : 'tebus');
        if (c === 'bongkar') {
          p.rekaman--; st('rekayasa_dibongkar'); log(`📹 Rekayasa terhadap ${name(p.seat)} dibongkar rekaman!`, { seat: p.seat });
          if (typeof ke === 'number') await naikSorotan(P[ke], 3);
        } else if (c === 'tebus') await setor(kali(4 + lvl), 'tebusan kasus');
        else await masukLapas(p, 'kambing hitam kasus rekayasa');
        await ev('hasil', { seat: p.seat, jenis, c });
        return;
      }
      const bantu = await solidaritas(p, jenis);
      const lot = lotsOf(p).find((l) => l.level > p.izin) || m;
      if (jenis === 'sidak' || jenis === 'gusur') {
        const tarif = kali(jenis === 'sidak' ? C.DAMAI[Math.max(1, lot.level)] : C.KEAMANAN + lot.level);
        const kalah = jenis === 'sidak' ? `Disegel ${C.SEGEL} bulan (tidak berproduksi; karyawan bisa dirumahkan)` : `${LEVEL[lot.level]} dibongkar jadi ${LEVEL[Math.max(0, lot.level - 1)]} (fondasi tersisa)`;
        const c = await ask(p.seat, { kind: jenis, text: `${ANCAMAN_NAMA[jenis]}: ${lot.name} (${LEVEL[lot.level]}) tidak punya izin.${bantu.nama.length ? ` Dibantu ${bantu.nama.join(', ')}.` : ''}`, options: [
          { id: 'damai', label: `💵 Bayar "uang damai" (${tarif})`, sub: `Ke ${pelaku}. Usaha aman.` },
          { id: 'viral', label: `📹 Viralkan (${p.rekaman + bantu.rekaman} rekaman)`, sub: `Tanpa bayar · 4+ di dadu = batal; setiap rekaman +1 · Pasal Karet 1–${S.f.karet}`, disabled: !(p.rekaman + bantu.rekaman) },
          { id: 'terima', label: jenis === 'sidak' ? '📋 Biarkan disegel' : '🚜 Biarkan digusur', sub: kalah }] },
        s === 'jujur' ? (p.rekaman + bantu.rekaman >= 2 ? 'viral' : p.daun >= tarif + 4 ? 'damai' : 'terima') : 'damai');
        if (c === 'damai') { await setor(tarif, 'uang damai'); log(`💵 ${name(p.seat)} membayar "uang damai" ${tarif}.`, { seat: p.seat }); await ev('hasil', { seat: p.seat, jenis, c }); return; }
        if (c === 'viral') {
          const r = p.rekaman + bantu.rekaman; p.rekaman += bantu.rekaman;
          const d = d6() + r;
          log(`📹 ${name(p.seat)} memviralkan ${jenis === 'sidak' ? 'sidak' : 'penggusuran'} itu (dadu+rekaman ${d}).`, { seat: p.seat });
          const aman = await viral(p, pos, r);
          if (d >= 5) { st('viral_berhasil'); ingat(lot, `Warganet membela. ${jenis === 'sidak' ? 'Segel' : 'Penggusuran'} dibatalkan.`, 'bantu'); log(`✅ Viral berhasil: ${jenis === 'sidak' ? 'segel' : 'penggusuran'} dibatalkan!`, { seat: p.seat }); await ev('hasil', { seat: p.seat, jenis, c, ok: true }); return; }
          log(`Viral kurang ramai. Aparat tetap jalan.`, { seat: p.seat });
        }
        if (jenis === 'sidak') await disegel(p, lot); else await digusur(p, lot);
        await ev('hasil', { seat: p.seat, jenis, c });
        return;
      }
      // Pasal 2/3
      let k = 1;
      if (typeof ke === 'number') {
        k = await ask(ke, { kind: 'kalkulator', text: `🧮 Kalkulator Kerugian Negara untuk ${m.name} (Jejak ${p.jejak}, usaha ${LEVEL[lvl]}).`, options: [0, 1, 2].map((i) => ({ id: i, label: `${['Rendah', 'Tinggi', 'Fantastis'][i]} ×${C.RUGI_K[i]} → ${(p.jejak + lvl) * C.RUGI_K[i]}`, sub: `Makin besar, makin besar setoran, tapi target menang sidang di ≥ ${C.SIDANG_AMBANG[i]}${i === 2 ? ' · Sorotanmu +1' : ''}` })) }, p.daun >= 10 ? 1 : 2);
        if (k === 2) await naikSorotan(P[ke], 1);
      } else k = p.jejak >= 3 ? 2 : 1;
      const rugi = (p.jejak + lvl) * C.RUGI_K[k], setorN = kali(Math.ceil(rugi * C.SETOR_RASIO)), ambang = C.SIDANG_AMBANG[k];
      m.segelSampai = Math.max(m.segelSampai, S.t);   // dibekukan selama proses (bulan ini)
      const rek = p.rekaman + bantu.rekaman, bonusRek = S.f.viralDua ? 2 : 1;
      const mod = Math.min(3, rek) * bonusRek + bantu.saksi;
      const c = await ask(p.seat, { kind: 'pasal23', text: `🧮 ${m.name} dijerat Pasal 2/3: "kerugian negara" ${rugi}! Usaha dibekukan.${bantu.nama.length ? ` Dibantu ${bantu.nama.join(', ')}.` : ''}`, options: [
        { id: 'setor', label: `🤫 "Amankan perkara" (${setorN})`, sub: `Ke ${pelaku}. Kasus masuk laci: upeti ${C.UPETI}/bulan selama ${C.LACI_BULAN} bulan` },
        { id: 'lawan', label: `🧑‍⚖️ Lawan di sidang (${Math.round(Math.max(0, Math.min(6, 7 - ambang + mod)) / 6 * 100)}% + amplop)`, sub: `Dadu +${mod} (rekaman & saksi) ≥ ${ambang}. Kalah: bayar hingga ${capRugi(p, rugi)}, usaha turun 1 level, ditahan` },
        { id: 'istana', label: `🏛️ Minta Istana (${C.ISTANA} Backing)`, sub: 'Kasus dihapus dari atas', disabled: p.backing < C.ISTANA }] },
      p.backing >= C.ISTANA ? 'istana' : s === 'jujur' && mod >= 1 ? 'lawan' : p.daun + p.mimpi.celengan >= setorN ? 'setor' : 'lawan');
      if (c === 'istana') {
        p.backing -= C.ISTANA; p.jejak = 0; st('istana'); ingat(p.seat, 'Kasus Pasal 2/3 dihapus lewat "jalur Istana".', 'jejak');
        log(`🏛️ Kasus ${name(p.seat)} dihapus lewat jalur Istana.`, { seat: p.seat }); await ev('hasil', { seat: p.seat, jenis, c }); return;
      }
      if (c === 'setor') {
        await setor(setorN, 'mengamankan perkara'); p.laci = [{ ke, sampai: S.t + C.LACI_BULAN }]; p.jejak = 0;
        ingat(p.seat, `Membayar ${setorN} untuk "mengamankan perkara". Kasusnya disimpan di laci.`, 'jejak');
        log(`🤫 ${name(p.seat)} "mengamankan perkara" (${setorN}). Kasusnya masuk laci.`, { seat: p.seat }); await ev('hasil', { seat: p.seat, jenis, c }); return;
      }
      // lawan: boleh menyelipkan amplop lewat panitera (NPC)
      const amp = await ask(p.seat, { kind: 'amplop', text: `✉️ Panitera berbisik: "Hakim bisa dibantu." Selipkan amplop?`, options: [
        { id: 0, label: 'Tidak', sub: 'Percaya pada keadilan' },
        { id: 3, label: '✉️ Amplop 3', sub: '+1 di dadu sidang' },
        { id: 6, label: '✉️ Amplop 6', sub: '+2 di dadu sidang' }] }, s === 'jujur' ? 0 : p.daun >= 8 ? 6 : p.daun >= 4 ? 3 : 0);
      if (amp) { await bayar(p, amp, 'sistem', 'amplop sidang'); await kolusi(p, 'menyuap hakim'); st('amplop', amp); }
      const d = d6(), total = d + mod + amp / 3;
      const menang = total >= ambang;
      log(`🧑‍⚖️ Sidang ${name(p.seat)}: dadu ${d} +${mod + amp / 3} vs ambang ${ambang}.`, { seat: p.seat });
      await ev('sidang', { seat: p.seat, d, mod: mod + amp / 3, ambang, menang });
      if (menang) {
        p.jejak = 0; p.daun += 1; st('menang_sidang');
        ingat(p.seat, `Menang di pengadilan. Negara membayar ganti rugi 1 Daun.${bantu.saksi ? ' Tetangga bersaksi.' : ''}`, 'bantu');
        log(`✅ ${name(p.seat)} MENANG sidang. Ganti rugi dari negara: 1 Daun.`, { seat: p.seat });
        if (typeof ke === 'number') await naikSorotan(P[ke], 1);
      } else {
        const n = capRugi(p, rugi);
        await bayar(p, n, 'negara', 'uang pengganti'); p.catat.disita += n; st('uang_pengganti', n);
        if (m.level > 0) { m.fondasi = Math.max(m.fondasi, m.level); m.level--; }
        p.jejak = 0;
        ingat(m, `Kalah di sidang Pasal 2/3. Uang pengganti ${n}, usaha disita sebagian.`, 'luka');
        log(`⛓️ ${name(p.seat)} kalah sidang: uang pengganti ${n}, ${m.name} turun jadi ${LEVEL[m.level]}.`, { seat: p.seat });
        while (p.karyawan.length > slot(p)) { const kk = p.karyawan.pop(); kisah(p, `${kk.nama} dirumahkan setelah usaha disita.`); }
        await masukLapas(p, 'divonis Pasal 2/3');
      }
      await ev('hasil', { seat: p.seat, jenis, c });
    }

    // ---------- Sorotan & OTT pejabat ----------
    async function naikSorotan(pj, n) {
      if (!pj.jabatan) { pj.sorotan += n; return; }
      if (pj.ottT === S.t && n > 0) return;   // maks 1 OTT per bulan
      pj.sorotan = Math.max(0, pj.sorotan + n);
      if (pj.sorotan < C.OTT) return;
      pj.ottT = S.t; st('ott');
      await ev('ott', { seat: pj.seat });
      const c = await ask(pj.seat, { kind: 'ott', text: `🚨 OTT! Sorotanmu menyentuh ${C.OTT}.`, options: [
        { id: 'backing', label: '🛡️ Pakai Backing', sub: 'Sorotan → 7', disabled: !pj.backing },
        { id: 'tertangkap', label: '⛓️ Pasrah', sub: 'Dicopot, separuh Daun disita, jadi incaran 2 bulan' }] }, pj.backing ? 'backing' : 'tertangkap');
      if (c === 'backing') { pj.backing--; pj.sorotan = 7; log(`🛡️ ${name(pj.seat)} lolos OTT berkat Backing.`, { seat: pj.seat }); return; }
      const sita = Math.ceil(pj.daun / 2); pj.daun -= sita; pj.catat.disita += sita; pj.sorotan = 4; pj.ottSampai = S.t + 2; st('ott_tertangkap');
      await lepasJabatan(pj, 'ott');
      log(`⛓️ ${name(pj.seat)} tertangkap OTT: ${sita} Daun disita.`, { seat: pj.seat });
    }

    // ---------- Tagihan keluarga ----------
    const biayaTagihan = (p, k) => C.TAGIHAN[k] + (main(p).level >= 3 ? C.TAGIHAN_NAIK - 1 : 0);
    async function tagihan() {
      S.stage = 'tagihan';
      P.forEach((p) => { p.laci = p.laci.filter((k) => k.sampai >= S.t); });
      const reqs = [];
      for (const p of P) {
        const tipe = shuffle(Object.keys(TAGIHAN)).slice(0, main(p).level >= 2 ? 2 : 1);
        p.tagihan = tipe;
        const gaji = p.karyawan.length * C.KAR_GAJI * (S.f.thr ? 2 : 1), hidup = C.BIAYA_HIDUP[main(p).level] + p.laci.length * C.UPETI;
        const opsi = tipe.map((k) => ({ id: k, label: `${TAGIHAN[k][0]} ${TAGIHAN[k][1]} (${biayaTagihan(p, k)})`, sub: `Kalau tidak dibayar: ${TAGIHAN[k][p.luka[k] ? 3 : 2]}` }));
        const cel = p.jabatan ? C.CELENGAN_PEJABAT : C.CELENGAN;
        const M = MIMPI[p.mimpi.jenis];
        opsi.push({ id: 'celengan', label: `${M[0]} Isi celengan "${M[1]}" (${C.CELENGAN})`, sub: `Tahap ${tahapMimpi(p)}/3 · celengan ${p.mimpi.celengan}${p.jabatan ? ` · pejabat: hanya +${cel} (tidak ada waktu untuk keluarga)` : ''}` });
        if (p.utang) opsi.push({ id: 'utang', label: `📱 Lunasi pinjol (${p.utang})`, sub: `Bunga ${C.PINJOL_BUNGA * 100}% kalau ditunda` });
        const wajib = gaji + hidup;
        // bot: sisakan uang untuk bangun; jujur mengutamakan keluarga & mimpi
        let sisa = p.daun - wajib;
        const bot = [];
        const s = p.strat === 'campur' ? 'kolusi' : p.strat;
        const urutan = (p.utang ? ['utang'] : []).concat(s === 'jujur' ? ['spp', 'obat', 'celengan', 'motor', 'kondangan'] : ['obat', 'spp', 'motor', 'kondangan', 'celengan']);
        for (const id of urutan) {
          const o = opsi.find((x) => x.id === id); if (!o) continue;
          const biaya = id === 'utang' ? p.utang : id === 'celengan' ? C.CELENGAN : biayaTagihan(p, id);
          const nx = main(p).level + 1, target = nx <= 4 ? C.BANGUN[nx] : 0;
          const keluarga = id === 'spp' || id === 'obat' || id === 'utang';
          const cad = S.t >= S.bulan - 1 ? 0 : Math.ceil(target * (s === 'jujur' ? (keluarga ? 0 : 0.35) : (keluarga ? 0.3 : 0.7)));
          if (id === 'celengan' && s !== 'jujur' && S.t < S.bulan - 2 && sisa < target) continue;
          if (sisa - biaya >= cad || (id === 'utang' && sisa >= biaya)) { bot.push(id); sisa -= biaya; }
        }
        reqs.push({ seat: p.seat, prompt: { kind: 'tagihan', multi: true, wajib, text: `🧾 Akhir bulan ${S.t}. Wajib: biaya hidup ${hidup}${p.laci.length ? ` (termasuk upeti laci ${p.laci.length * C.UPETI})` : ''} + gaji ${p.karyawan.length} karyawan ${gaji}${S.f.thr ? ' (THR!)' : ''} = ${wajib}. Pilih tagihan yang dibayar.`, options: opsi }, bot });
      }
      const hasil = await askAll(reqs);
      for (let k = 0; k < reqs.length; k++) {
        const p = P[reqs[k].seat], pilih = hasil[k];
        // wajib: gaji & hidup
        const gajiTotal = p.karyawan.length * C.KAR_GAJI * (S.f.thr ? 2 : 1);
        await bayar(p, C.BIAYA_HIDUP[main(p).level], 'hidup', 'biaya hidup');
        for (const kasus of p.laci) { await bayar(p, C.UPETI, kasus.ke, 'upeti laci'); if (typeof kasus.ke === 'number') await setoranMasuk(P[kasus.ke]); }
        if (gajiTotal) {
          if (p.daun >= gajiTotal) p.daun -= gajiTotal;
          else {
            // gaji telat: yang tidak setia pergi
            const bisa = Math.floor(p.daun / (C.KAR_GAJI * (S.f.thr ? 2 : 1)));
            p.daun -= bisa * C.KAR_GAJI * (S.f.thr ? 2 : 1);
            const tidak = p.karyawan.slice(bisa);
            for (const kk of tidak) {
              if (kk.trait === 'setia' && !kk.bertahan) { kk.bertahan = true; log(`🤝 ${kk.nama} tetap bekerja walau gajinya telat.`, { seat: p.seat }); continue; }
              p.karyawan.splice(p.karyawan.indexOf(kk), 1);
              const txt = `${kk.nama} berhenti karena gaji tidak dibayar${kk.trait === 'tulang' ? ', padahal ia menghidupi 3 adiknya' : ''}.`;
              kisah(p, txt); ingat(p.seat, txt, 'luka'); log(`😔 ${txt}`, { seat: p.seat }); st('karyawan_pergi');
              await ev('karyawan', { seat: p.seat, nama: kk.nama, masuk: false, sebab: 'gaji' });
            }
          }
        }
        for (const id of p.tagihan) {
          if (pilih.includes(id)) { await bayar(p, biayaTagihan(p, id), 'hidup', TAGIHAN[id][1]); p.luka[id] = 0; continue; }
          const kedua = p.luka[id] >= 1; p.luka[id]++; st('tagihan_' + id);
          const akibat = TAGIHAN[id][kedua ? 3 : 2];
          if (id === 'spp') p.mimpi.celengan = Math.max(0, p.mimpi.celengan - (kedua ? 3 : 1) * (p.mimpi.jenis === 'sarjana' ? 2 : 1));
          else if (id === 'obat') { p.aksiMinus = 1; if (kedua) p.daun = Math.max(0, p.daun - 2); }
          else if (id === 'motor') p.jualanMinus = kedua ? 2 : 1;
          else if (id === 'kondangan') p.dijauhi = S.t + 1;
          kisah(p, `${TAGIHAN[id][1]} tidak terbayar: ${akibat}`);
          log(`${TAGIHAN[id][0]} ${name(p.seat)}: ${akibat}`, { seat: p.seat });
        }
        if (pilih.includes('utang') && p.utang) { const u = p.utang; if (p.daun >= u) { p.daun -= u; p.utang = 0; log(`📱 ${name(p.seat)} melunasi pinjol.`, { seat: p.seat }); } }
        if (pilih.includes('celengan') && p.daun >= C.CELENGAN) {
          const before = tahapMimpi(p);
          p.daun -= C.CELENGAN; p.mimpi.celengan += p.jabatan ? C.CELENGAN_PEJABAT : C.CELENGAN;
          if (tahapMimpi(p) > before) {
            const M = MIMPI[p.mimpi.jenis], txt = M[2][tahapMimpi(p) - 1];
            kisah(p, `🎉 ${txt}!`); ingat(p.seat, `🎉 ${txt}.`, 'mimpi'); log(`${M[0]} ${name(p.seat)}: ${txt}!`, { seat: p.seat });
            await ev('mimpi', { seat: p.seat, tahap: tahapMimpi(p) });
          }
        }
        if (p.utang) p.utang = Math.ceil(p.utang * (1 + C.PINJOL_BUNGA / 2));
      }
      await ev('tagihan', {});
      // pejabat: setoran ke atas
      for (const p of P) if (p.jabatan) {
        p.jabatanBulan++;
        const n = C.SETORAN_ATAS + Math.floor((S.t - p.jabatanSejak) / 2) + S.f.setoranPlus;
        if (p.daun >= n) { p.daun -= n; S.sistem += n; st('setoran_atas', n); log(`⬆️ ${name(p.seat)} menyetor ${n} ke atasan.`, { seat: p.seat }); }
        else await lepasJabatan(p, 'copot');
      }
      S.stage = 'play';
    }

    // ---------- loop utama ----------
    async function run() {
      for (let t = 1; t <= S.bulan && !stopped; t++) {
        S.t = t; update();
        await ev('bulan', { t });
        P.forEach((p) => { p.sorotan = Math.max(0, p.sorotan - 1); });
        await bukaKabar(); if (stopped) break;
        await rencana(); if (stopped) break;
        await produksi();
        await mataAparat(); if (stopped) break;
        await tagihan(); if (stopped) break;
        if (t === 6) P.forEach((p) => { p.catat.levelB6 = main(p).level; p.catat.kayaB6 = kekayaanKasar(p); });
        await ev('rekap', { t });   // ringkasan bulan: siapa naik, siapa jatuh
        if (opts.onPhase && t < S.bulan) await opts.onPhase('nego', S);
        if (opts.stopAfter && opts.stopAfter(S)) stopped = true;
      }
      if (stopped) { S.phase = 'stopped'; S.prompts = {}; update(); return S; }
      // akhir
      const skor = P.map((p) => {
        const tahap = tahapMimpi(p);
        const bonus = C.MIMPI_BONUS[tahap];
        const mutasi = !!p.jabatan && p.sorotan >= C.MUTASI_SOR;
        const kotor = p.daun + nilaiAset(p) + p.mimpi.celengan + bonus - p.utang;
        return { seat: p.seat, name: name(p.seat), strat: p.strat, daun: p.daun, aset: nilaiAset(p), celengan: p.mimpi.celengan, mimpiTahap: tahap, mimpiBonus: bonus, utang: p.utang,
          jabatan: p.jabatan, pernahPejabat: !!p.catat.pejabat, mutasi, level: main(p).level, kekayaan: Math.max(0, Math.floor(mutasi ? kotor * C.MUTASI : kotor)), tie: rng() };
      });
      skor.sort((a, b) => (b.kekayaan - a.kekayaan) || (b.mimpiTahap - a.mimpiTahap) || (b.tie - a.tie));
      Dompet().konversi(skor, C.KURS);
      S.result = { ranking: skor, winner: skor[0].seat, uang: C.UANG, kurs: C.KURS, sistem: S.sistem };
      S.phase = 'end'; S.stage = 'end'; S.prompts = {};
      log(`🏁 Tahun berakhir. Keluarga paling sejahtera: ${skor[0].name}.`);
      await ev('end', {});
      return S;
    }

    return { S, run, answer, setBot, stop };
  }

  /** Versi publik state untuk disiarkan host: rencana & prompt orang lain disembunyikan. */
  function redactPublic(S) {
    const pub = JSON.parse(JSON.stringify(S, (k, v) => (k === 'decks' ? undefined : v)));
    pub.plan = {}; pub.prompts = {};
    pub.ready = (S.ready || []).slice();
    if (S.phase !== 'end') pub.p.forEach((p) => { p.kisah = p.kisah.slice(-6); });
    return pub;
  }
  /** Bagian rahasia untuk satu kursi. */
  const privateFor = (S, seat) => ({ prompt: S.prompts[seat] || null, plan: S.plan && S.plan[seat] ? S.plan[seat] : null });

  const api = { C, LEVEL, LEVEL_EM, JABATAN, DOMAIN, ANCAMAN_NAMA, MIMPI, TAGIHAN, KABAR, TRAIT, JALAN, STRATS, createGame, mulberry32, redactPublic, privateFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DariGerobak = api;
})(typeof window !== 'undefined' ? window : globalThis);
