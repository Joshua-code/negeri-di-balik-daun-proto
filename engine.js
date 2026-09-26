/* Jalan Tikus — mesin aturan. Port dari tools/sim_jalan_tikus.py (aturan: docs/03-jalan-tikus.md).
 * Dipakai di browser (window.JalanTikus) dan Node (require).
 * Setiap keputusan lewat ask(): kursi bot dijawab heuristik simulasi, kursi manusia menunggu answer().
 */
(function (root) {
  'use strict';

  const C = {
    PUTARAN: 20, GAJI: [2, 3, 5, 7], NAIK: [0, 6, 14, 24], PUNGLI: [0, 0, 3, 5], REKAYASA: 2, KARTU_TIAP: 4, RP_AWAL: 2, OKNUM_RP_AWAL: 3, N_POS: 4, GAJI_OKNUM: 0, CITRA_MAX: 10, CITRA_VIRAL: 1, CITRA_BONGKAR: 2, CITRA_LAPOR: 1, CITRA_OTT: 1, MUTASI_KALI: 0.8,
    TARIF_86: [2, 4, 6, 9], TILANG: [3, 5, 7, 10], PROSES_RESMI: 2, FEE: 0.2, FEE_BANK: 0.1,
    CITRA_MIN: 9, PINJOL_DAPAT: 5, PINJOL_BAYAR: 7, REMISI: 3, SEL_MEWAH: 2, LAPOR_MIN: 8,
    BERSIH_BERSIH: 1, MUTASI: 1, TUMBAL_CITRA: 2,
  };
  const KELAS = ['Jelata', 'Pedagang', 'Juragan', 'Pengusaha'];
  const BOARD = ('SUBUH KERJA NASIB BANSOS KERJA GUSURAN IZIN PASAR NASIB LAPOR PASAR PINJOL ' +
    'LAPAS KERJA VIRAL NASIB KERJA DEMO IZIN PROYEK NASIB KERJA VIRAL BANK').split(' ');
  const POS_OK = new Set(['KERJA', 'NASIB', 'BANSOS', 'GUSURAN', 'PASAR', 'PINJOL', 'VIRAL', 'DEMO', 'PROYEK']);
  const TILE = {
    SUBUH: ['🌅', 'Subuh', 'Start. Setiap melewati Subuh, utang Pinjol ditagih.'],
    KERJA: ['🛠️', 'Kerja', '+2 Rupiah.'],
    NASIB: ['🎲', 'Nasib', 'Ambil 1 kartu Nasib.'],
    BANSOS: ['🍚', 'Bansos', 'Jelata +3. Juragan & Pengusaha +2 (salah sasaran). Pedagang tidak dapat.'],
    GUSURAN: ['🚜', 'Gusuran', 'Jelata & Pedagang: bayar 1 "uang keamanan" ke Oknum, atau lapak digusur (−3).'],
    IZIN: ['🏛️', 'Kantor Izin', 'Jalur resmi: lewat/berhenti di sini untuk mengajukan berkas izin. Jadi 2 putaran kemudian.'],
    PASAR: ['🧺', 'Pasar', 'Pedagang ke atas +3. Jelata +1 (kuli angkut).'],
    LAPOR: ['📝', 'Lapor Polisi', 'Laporan hanya diproses kalau Sorotan Oknum ≥ 8. Kalau tidak: #PercumaLaporPolisi.'],
    PINJOL: ['📱', 'Pinjol', 'Boleh pinjam +5 sekarang, bayar 7 saat melewati Subuh.'],
    LAPAS: ['🔒', 'Lapas', 'Hanya berkunjung, kecuali sedang dihukum.'],
    VIRAL: ['📹', 'Viral', 'Dapat 1 Kartu Rekaman (maks. 3).'],
    DEMO: ['📢', 'Demo', 'Lewat/berhenti: taruh token Demo. ≥ 2 pendemo dalam satu putaran membatalkan Kabar Istana berikutnya.'],
    PROYEK: ['🏗️', 'Proyek', 'Juragan & Pengusaha +4.'],
    BANK: ['🏦', 'Bank', 'Pengusaha yang berhenti di sini transfer ke luar dengan potongan hanya 10%.'],
  };
  const KABAR = {
    1: ['Operasi Zebra', 'Tarif 86 semua kelas +1 putaran ini.'],
    2: ['Kapolri Baru: Bersih-Bersih!', 'Sorotan Oknum +1.'],
    3: ['Revisi UU ITE Ditunda Lagi', 'Pasal Karet kena di angka 1–3 putaran ini.'],
    4: ['No Viral No Justice', 'Lapor Polisi diproses tanpa syarat putaran ini.'],
    5: ['Amnesti Hari Kemerdekaan', 'Semua yang di Lapas langsung bebas, termasuk Oknum.'],
    6: ['Bansos Jelang Pemilu', 'Semua Jelata +3.'],
    7: ['Tunjangan Dewan Naik', 'Semua Rakyat −1. Token Demo putaran ini dihitung ganda.'],
    8: ['Penertiban PKL', 'Gusuran juga berlaku untuk Juragan putaran ini.'],
    9: ['Skandal Jenderal Viral', 'Sorotan Oknum +1. Oknum tidak boleh Rekayasa putaran ini.'],
    10: ['Pengampunan Pajak', 'Transfer ke Luar Rakyat hanya dipotong 5% putaran ini.'],
    11: ['RUU Perampasan Aset Ditunda Lagi', 'Tidak terjadi apa-apa. Kartu dikocok kembali ke deck.'],
    12: ['KUHAP Baru Berlaku', 'Rekayasa Kasus putaran ini tidak memakai token.'],
    13: ['Harga Beras Naik', 'Semua Rakyat −1.'],
    14: ['Mutasi Serentak', 'Sorotan Oknum −1. Masalahnya dipindah, bukan diselesaikan.'],
  };
  const NASIB = {
    1: ['Anak Sakit, BPJS Ditolak', '−2 Rupiah.'],
    2: ['Orderan Ramai', '+3 Rupiah.'],
    3: ['Ditilang di Jalan Sepi', 'Bayar 1 ke Oknum (Sorotan Oknum +1).'],
    4: ['Berkas Izin "Hilang"', 'Berkas jalur resmi milikmu dibuang.'],
    5: ['Arisan Cair', '+2 Rupiah.'],
    6: ['Dipalak Ormas', '−1 Rupiah.'],
    7: ['Kenal Orang Dalam', '+4 Rupiah, atau calo izin berikutnya gratis.'],
    8: ['Konten Kamu Viral', '+2 Rupiah dan 1 Kartu Rekaman.'],
    9: ['Pabrik Tutup', 'Jelata & Pedagang −2.'],
    10: ['Salah Tangkap', 'Bayar 2 ke Oknum, atau Lapas 1 putaran.'],
    11: ['Uang Kerohiman', '+1 Rupiah.'],
    12: ['Kepepet', 'Boleh ambil +1 Rupiah, lalu dadu 1–3 = Lapas 2 putaran.'],
  };
  const OKNUM = {
    1: ['Buzzer', 'Sampai giliranmu berikutnya, Pasal Karet kena di angka 1–3.'],
    2: ['Razia Gabungan', 'Pasang 1 Pos tambahan sampai giliranmu berikutnya.'],
    3: ['Backing Atasan', '+1 Backing.'],
    4: ['Tukar Barang Bukti', '+4 Rupiah, Sorotan +2.'],
    5: ['Narasi Resmi', 'Reaksi: batalkan 1 Viral terhadapmu. Kalau dibalas Kartu Rekaman kedua: Sorotan +5.'],
    6: ['Uang Keamanan', 'Tawarkan ke 1 Juragan/Pengusaha: bayar 3 agar kebal Pos-mu. Kalau menolak: tarif 86-nya ganda.'],
    7: ['Tes Urine Dadakan', 'Rakyat berikutnya yang kena Razia bayar 86 ganda.'],
    8: ['Tumbal Bawahan', 'Reaksi saat OTT: Sorotan turun ke 6 tanpa kehilangan Pos, tapi Citra −2.'],
    9: ['Konferensi Pers', 'Citra +2.'],
    10: ['Operasi Senyap', 'Rekayasa Kasus tanpa token, tapi Sorotan +2.'],
  };
  const REAKSI = new Set([5, 8]);
  const JT_TILE_EM = (t) => TILE[t][0];

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
   * players: [{name, bot, pid}] — index 0 = Oknum, sisanya Rakyat (1–3 orang).
   * opts: rng, delay (ms jeda bot), putaran, script {dice:{seat:[..]}, karet:[..], kabar:[..], nasib:[..], oknum:[..]},
   *       setup(S), onUpdate(S), onEvent(ev) (boleh mengembalikan Promise → engine menunggu),
   *       strict (throw kalau pilihan bot tidak ada di opsi), stopAfterTurn(S, seat) → true untuk berhenti.
   */
  function createGame(players, opts = {}) {
    const rng = opts.rng || Math.random;
    const script = opts.script || {};
    const delayMs = () => (typeof opts.delay === 'function' ? opts.delay() : opts.delay || 0);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const acak = (a) => shuffle(a.slice()); // urutan acak dulu → seri tidak selalu jatuh ke kursi yang sama
    const d6 = (queue) => (queue && queue.length ? queue.shift() : 1 + Math.floor(rng() * 6));

    const S = {
      t: 0, putaran: opts.putaran || C.PUTARAN, phase: 'play', turn: null, dice: null, kabar: null,
      log: [], events: [], evN: 0, prompt: null, stats: {}, result: null,
      players: players.map((p) => ({ name: p.name, bot: !!p.bot, pid: p.pid || null })),
      o: { seat: 0, rp: C.OKNUM_RP_AWAL, aman: 0, citra: 5, sorotan: 2, backing: 1, rekayasa: C.REKAYASA, nPos: C.N_POS, pos: [],
        posTambahan: null, hand: [], bebasDi: 0, buzzer: false, tesUrine: false, dilindungi: [], tarifGanda: [] },
      rs: players.slice(1).map((p, i) => ({ seat: i + 1, pos: 0, kelas: 0, rp: C.RP_AWAL, aman: 0, izin: false, caloGratis: false,
        berkas: null, lapas: 0, rekaman: 1, utang: 0, demo: false, naikAt: null, strat: 'campur' })),
      f: {}, batalKabar: false,
      decks: { kabar: script.kabar ? script.kabar.slice() : shuffle(Object.keys(KABAR).map(Number)), nasib: [],
        oknum: script.oknum ? script.oknum.slice() : shuffle(Object.keys(OKNUM).map(Number)) },
    };
    let promptSeq = 0, pending = null, stopped = false;
    const o = S.o, rs = S.rs;
    const name = (seat) => S.players[seat].name;
    const st = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
    const update = () => opts.onUpdate && opts.onUpdate(S);
    const log = (msg) => { S.log.push({ t: S.t, msg }); if (S.log.length > 60) S.log.shift(); update(); };
    async function ev(type, data = {}) {
      const e = Object.assign({}, data, { n: ++S.evN, type, t: S.t });
      S.events.push(e); if (S.events.length > 20) S.events.shift();
      update();
      if (opts.onEvent) await opts.onEvent(e, S);
      if (PACE[type]) await pace(PACE[type]);
    }
    // jeda (× delay) setelah tiap jenis kejadian, supaya pemain bisa mengikuti apa yang terjadi
    const PACE = { putaran: 1, kabar: 2.5, pos: 1.2, turn: 0.4, gaji: 0.6, dice: 1, razia_hasil: 1.4, karet: 1.2, petak: 1,
      nasib: 2.5, kartu_oknum: 2.5, naik: 1.2, calo: 1, transfer: 1.5, ott: 1.5, lapas: 1.5, demo: 2, rekaman: 0.8, lapor: 1, aksi: 1.2 };
    const pace = async (k = 1) => { const d = delayMs(); if (d) await sleep(d * k); };

    function resetFlags() {
      S.f = { tarifPlus: 0, karet: 2, laporBebas: false, noRek: false, rekGratis: false, gusurJuragan: false, feeRakyat: null, demoGanda: false };
    }
    resetFlags();

    function ambilOknum(n) {
      for (let i = 0; i < n; i++) if (S.decks.oknum.length && o.hand.length < 3) o.hand.push(S.decks.oknum.pop());
    }
    ambilOknum(2);
    if (opts.setup) opts.setup(S);

    // ---------- ask / answer ----------
    async function ask(seat, prompt, botChoice) {
      const valid = prompt.options.filter((x) => !x.disabled).map((x) => x.id);
      if (opts.strict && prompt.kind !== 'pos' && !valid.includes(botChoice)) {
        throw new Error(`bot choice ${botChoice} not in ${valid} for ${prompt.kind}`);
      }
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
      if (p.kind === 'pos') {
        const need = Math.min(p.pick, p.tiles.length);
        if (!Array.isArray(choice) || new Set(choice).size !== need || !choice.every((x) => p.tiles.includes(x))) return false;
      } else if (!p.options.some((x) => x.id === choice && !x.disabled)) return false;
      pending.res(choice);
      return true;
    }
    function setBot(seat, bot) {
      S.players[seat].bot = bot;
      if (bot && S.prompt && S.prompt.seat === seat && pending) pending.res(S.prompt.bot);
      update();
    }
    const aktif = () => S.t > o.bebasDi;

    // ---------- Sorotan & OTT ----------
    async function naikSorotan(n) {
      o.sorotan = Math.max(0, o.sorotan + n);
      if (o.sorotan < 10) return;
      const options = [];
      if (o.hand.includes(8)) options.push({ id: 'tumbal_kartu', label: 'Kartu Tumbal Bawahan', sub: 'Sorotan → 6, Citra −' + C.TUMBAL_CITRA });
      if (o.backing) options.push({ id: 'backing', label: 'Pakai Backing', sub: 'Sorotan → 7, Backing −1' });
      if (o.nPos > 1) options.push({ id: 'tumbal_pos', label: 'Korbankan bawahan (Tumbal)', sub: '1 Pos hilang permanen, Sorotan → 6, Citra −2' });
      options.push({ id: 'tertangkap', label: 'Pasrah tertangkap', sub: 'Separuh Rupiah disita, Lapas 1 putaran' });
      await ev('ott', { seat: 0 });
      const c = await ask(0, { kind: 'ott', text: '🚨 OTT! Sorotan menyentuh 10. Bagaimana kamu lolos?', options }, options[0].id);
      if (c === 'tumbal_kartu') {
        o.hand.splice(o.hand.indexOf(8), 1); o.sorotan = 6; citra(-C.TUMBAL_CITRA); st('ott_tumbal_kartu');
        log(`OTT! ${name(0)} mengorbankan bawahan (kartu Tumbal). Berita: "oknum bawahan dipecat".`);
      } else if (c === 'backing') {
        o.backing--; o.sorotan = 7; citra(-C.CITRA_OTT); st('ott_backing'); log(`OTT! ${name(0)} diselamatkan Backing.`);
      } else if (c === 'tumbal_pos') {
        o.nPos--; o.pos = o.pos.slice(0, o.nPos); o.sorotan = 6; citra(-2); st('ott_tumbal_pos');
        log(`OTT! ${name(0)} menumbalkan bawahan: 1 Pos hilang permanen.`);
      } else {
        st('ott_tertangkap'); citra(-C.CITRA_OTT); const sita = Math.ceil(o.rp / 2); o.rp -= sita; o.bebasDi = S.t + 1; o.sorotan = 5;
        log(`OTT! ${name(0)} TERTANGKAP. ${sita} Rupiah disita, masuk Lapas. Semua Pos kosong.`);
      }
    }

    async function masukLapas(r, n, sebab) {
      r.lapas = Math.max(r.lapas, n); st('lapas_' + sebab);
      const why = { pasal_karet: 'dilaporkan balik (pasal karet)', rekayasa: 'jadi korban rekayasa kasus', salah_tangkap: 'salah tangkap',
        kepepet: 'ketahuan mengambil barang karena kepepet', penghasutan: 'dituduh menghasut demo' }[sebab];
      log(`🔒 ${name(r.seat)} masuk Lapas ${n} putaran: ${why}.`);
      await ev('lapas', { seat: r.seat, sebab });
    }
    // Citra 0–10: naik lewat tindakan "resmi", turun kalau Oknum dipermalukan di depan publik
    const citra = (n) => { o.citra = Math.max(0, Math.min(C.CITRA_MAX, o.citra + n)); };
    function bayarOknum(r, n) { n = Math.min(n, r.rp); r.rp -= n; o.rp += n; return n; }

    // ---------- Kabar Istana ----------
    async function bukaKabar() {
      resetFlags();
      if (!S.decks.kabar.length) S.decks.kabar = shuffle(Object.keys(KABAR).map(Number));
      const k = S.decks.kabar.pop();
      if (k === 11) { S.decks.kabar.push(k); shuffle(S.decks.kabar); }
      if (S.batalKabar) {
        S.batalKabar = false; st('kabar_dibatalkan_demo');
        S.kabar = { id: k, batal: true };
        log(`📢 Kabar Istana "${KABAR[k][0]}" DIBATALKAN karena demo.`);
        await ev('kabar', { id: k, batal: true });
        return;
      }
      S.kabar = { id: k, batal: false };
      const f = S.f;
      if (k === 1) f.tarifPlus = 1;
      else if (k === 2) { log(`📰 Kabar: ${KABAR[k][0]}`); await naikSorotan(C.BERSIH_BERSIH); }
      else if (k === 3) f.karet = 3;
      else if (k === 4) f.laporBebas = true;
      else if (k === 5) { rs.forEach((r) => { r.lapas = 0; }); o.bebasDi = Math.min(o.bebasDi, S.t - 1); }
      else if (k === 6) rs.forEach((r) => { if (r.kelas === 0) r.rp += 3; });
      else if (k === 7) { rs.forEach((r) => { r.rp = Math.max(0, r.rp - 1); }); f.demoGanda = true; }
      else if (k === 8) f.gusurJuragan = true;
      else if (k === 9) { await naikSorotan(1); f.noRek = true; }
      else if (k === 10) f.feeRakyat = 0.05;
      else if (k === 12) f.rekGratis = true;
      else if (k === 13) rs.forEach((r) => { r.rp = Math.max(0, r.rp - 1); });
      else if (k === 14) o.sorotan = Math.max(0, o.sorotan - C.MUTASI);
      if (k !== 2) log(`📰 Kabar Istana: ${KABAR[k][0]} — ${KABAR[k][1]}`);
      await ev('kabar', { id: k, batal: false });
    }

    // ---------- Nasib ----------
    async function nasibKartu(r) {
      if (!S.decks.nasib.length) S.decks.nasib = script.nasib ? script.nasib.slice() : shuffle(Object.keys(NASIB).map(Number));
      const k = S.decks.nasib.pop();
      log(`🎲 ${name(r.seat)} dapat Nasib: ${NASIB[k][0]} — ${NASIB[k][1]}`);
      await ev('nasib', { seat: r.seat, id: k });
      if (k === 1) r.rp = Math.max(0, r.rp - 2);
      else if (k === 2) r.rp += 3;
      else if (k === 3) { if (bayarOknum(r, 1)) await naikSorotan(1); }
      else if (k === 4) { if (r.berkas !== null) { r.berkas = null; st('berkas_hilang'); } }
      else if (k === 5) r.rp += 2;
      else if (k === 6) r.rp = Math.max(0, r.rp - 1);
      else if (k === 7) {
        const bot = r.strat !== 'resmi' && (r.kelas === 1 || r.kelas === 2) && !r.izin ? 'calo' : 'uang';
        const c = await ask(r.seat, { kind: 'nasib7', text: 'Kenal Orang Dalam! Pilih satu:', options: [
          { id: 'uang', label: '+4 Rupiah', sub: 'Uang tunai sekarang' },
          { id: 'calo', label: 'Calo gratis', sub: 'Izin berikutnya lewat calo tanpa bayar pungli' }] }, bot);
        if (c === 'calo') r.caloGratis = true; else r.rp += 4;
      } else if (k === 8) { r.rp += 2; r.rekaman = Math.min(3, r.rekaman + 1); }
      else if (k === 9) { if (r.kelas <= 1) r.rp = Math.max(0, r.rp - 2); }
      else if (k === 10) {
        const options = [{ id: 'bayar', label: 'Bayar 2 ke Oknum', sub: 'Uang "damai"', disabled: r.rp < 2 },
          { id: 'lapas', label: 'Masuk Lapas 1 putaran', sub: 'Tidak punya uang untuk damai' }];
        const c = await ask(r.seat, { kind: 'nasib10', text: 'Salah Tangkap! Kamu dituduh pelaku.', options }, r.rp >= 2 ? 'bayar' : 'lapas');
        if (c === 'bayar') bayarOknum(r, 2); else await masukLapas(r, 1, 'salah_tangkap');
      } else if (k === 11) r.rp += 1;
      else if (k === 12) {
        const c = await ask(r.seat, { kind: 'nasib12', text: 'Kepepet. Ambil barang orang?', options: [
          { id: 'ambil', label: 'Ambil (+1)', sub: 'Lalu dadu: 1–3 = Lapas 2 putaran' },
          { id: 'tolak', label: 'Jangan', sub: 'Tidak terjadi apa-apa' }] }, r.rp < 2 ? 'ambil' : 'tolak');
        if (c === 'ambil') { r.rp += 1; const d = d6(script.karet); if (d <= 3) await masukLapas(r, 2, 'kepepet'); }
      }
    }

    // ---------- Razia ----------
    async function razia(r) {
      if (o.dilindungi.includes(r.seat)) { log(`${name(r.seat)} lewat Pos tanpa diperiksa (sudah bayar uang keamanan).`); return false; }
      let tarif = C.TARIF_86[r.kelas] + S.f.tarifPlus;
      if (o.tesUrine || o.tarifGanda.includes(r.seat)) tarif *= 2;
      const tilang = C.TILANG[r.kelas];
      const options = [
        { id: '86', label: `Damai "86" (${tarif})`, sub: `Bayar ${tarif} ke Oknum, lanjut jalan · Sorotan Oknum +1`, disabled: r.rp < tarif },
        { id: 'tilang', label: `Tilang resmi (${tilang})`, sub: `Bayar ${tilang} ke kas negara (bukan ke Oknum) · Citra Oknum +1` },
        { id: 'viral', label: 'Rekam & Viralkan 📹', sub: `Buang 1 Kartu Rekaman, tidak bayar · Sorotan Oknum +3 · risiko Pasal Karet`, disabled: !r.rekaman },
      ];
      const bot = r.rekaman && o.sorotan >= 5 ? 'viral' : (tarif <= tilang && r.rp >= tarif ? '86' : 'tilang');
      await ev('razia', { seat: r.seat });
      const c = await ask(r.seat, { kind: 'razia', text: `🚨 Razia! ${name(r.seat)} diberhentikan di Pos.`, options }, bot);
      if (c === 'viral') {
        r.rekaman--; st('viral');
        log(`📹 ${name(r.seat)} merekam & memviralkan Oknum!`);
        let tembus = true;
        if (o.hand.includes(5)) {
          const use = await ask(0, { kind: 'narasi', text: `${name(r.seat)} memviralkanmu. Mainkan Narasi Resmi?`, options: [
            { id: 'ya', label: 'Mainkan Narasi Resmi', sub: 'Viral batal, kecuali dibalas Kartu Rekaman kedua (Sorotan +5)' },
            { id: 'tidak', label: 'Biarkan', sub: 'Sorotan +3' }] }, o.sorotan >= 6 ? 'ya' : 'tidak');
          if (use === 'ya') {
            o.hand.splice(o.hand.indexOf(5), 1);
            log(`🗞️ ${name(0)} merilis "Narasi Resmi".`);
            const balas = await ask(r.seat, { kind: 'balas_narasi', text: 'Oknum merilis Narasi Resmi. Balas dengan rekaman kedua?', options: [
              { id: 'ya', label: 'Buka rekaman kedua', sub: 'Buang 1 Kartu Rekaman lagi · Sorotan Oknum +5', disabled: !r.rekaman },
              { id: 'tidak', label: 'Diam', sub: 'Viral-mu tenggelam' }] }, r.rekaman ? 'ya' : 'tidak');
            if (balas === 'ya') { r.rekaman--; st('narasi_resmi_bocor'); citra(-C.CITRA_VIRAL); log('Narasi resmi terbantah rekaman kedua!'); await naikSorotan(5); }
            else st('narasi_resmi_berhasil');
            tembus = false;
          }
        }
        if (tembus) { citra(-C.CITRA_VIRAL); await naikSorotan(3); }
        const karet = o.buzzer || S.f.karet === 3 ? 3 : 2;
        const d = d6(script.karet);
        await ev('karet', { seat: r.seat, d, karet });
        if (d <= karet) { await masukLapas(r, 2, 'pasal_karet'); return true; }
        log(`Dadu Pasal Karet ${d}: ${name(r.seat)} aman.`);
        await ev('razia_hasil', { seat: r.seat, c: 'viral' });
        return false;
      }
      if (c === '86') {
        o.tesUrine = false; st('uang_86', bayarOknum(r, tarif));
        log(`${name(r.seat)} bayar "86" sebesar ${tarif} ke Oknum.`);
        await naikSorotan(1);
        await ev('razia_hasil', { seat: r.seat, c: '86' });
        return false;
      }
      r.rp = Math.max(0, r.rp - tilang); citra(1); st('tilang_resmi');
      log(`${name(r.seat)} memilih tilang resmi (${tilang}) ke kas negara.`);
      await ev('razia_hasil', { seat: r.seat, c: 'tilang' });
      return true;
    }

    // ---------- Rakyat ----------
    function caloBisa(r) {
      const nxt = r.kelas + 1;
      return (r.kelas === 1 || r.kelas === 2) && !r.izin && (r.caloGratis || r.rp >= C.PUNGLI[nxt]);
    }
    async function kelola(r, tile) {
      // loop pilihan setelah jalan: calo, naik kelas, transfer
      for (;;) {
        const nxt = r.kelas + 1;
        const bisaNaik = r.kelas < 3 && r.izin && r.rp >= C.NAIK[nxt];
        const fee = S.f.feeRakyat !== null ? S.f.feeRakyat : (tile === 'BANK' ? C.FEE_BANK : C.FEE);
        const options = [];
        if (bisaNaik) options.push({ id: 'naik', label: `Naik jadi ${KELAS[nxt]} (${C.NAIK[nxt]})`, sub: `Gaji jadi ${C.GAJI[nxt]}/giliran` });
        if (caloBisa(r)) options.push({ id: 'calo', label: `Izin lewat calo (${r.caloGratis ? 'gratis' : C.PUNGLI[nxt]})`,
          sub: `Izin ${KELAS[nxt]} langsung jadi · uangnya ke Oknum · Sorotan Oknum +1` });
        if (r.kelas === 3 && r.rp > 0) options.push({ id: 'transfer', label: `Transfer ke luar (−${Math.round(fee * 100)}%)`,
          sub: `${r.rp} Rupiah → ${Math.floor(r.rp * (1 - fee))} Harta Aman. Tidak bisa disita.` });
        if (!options.length) return;
        options.push({ id: 'selesai', label: 'Selesai giliran', sub: '' });
        // heuristik bot (sama dengan simulasi)
        let bot = 'selesai';
        const caloBot = r.caloGratis || r.strat === 'belakang' || (r.strat === 'campur' && r.kelas >= 2);
        if (caloBisa(r) && r.berkas === null && caloBot && (r.caloGratis || r.rp >= C.PUNGLI[nxt] + C.NAIK[nxt])) bot = 'calo';
        else if (bisaNaik) bot = 'naik';
        else if (r.kelas === 3 && r.rp > 0 && (tile === 'BANK' || r.rp >= 6)) bot = 'transfer';
        const c = await ask(r.seat, { kind: 'kelola', text: 'Mau apa sebelum giliran selesai?', options }, bot);
        if (c === 'selesai') return;
        if (c === 'calo') {
          if (r.caloGratis) { r.caloGratis = false; log(`${name(r.seat)} dapat izin lewat orang dalam (gratis).`); }
          else { st('pungli', bayarOknum(r, C.PUNGLI[nxt])); log(`${name(r.seat)} bayar calo ${C.PUNGLI[nxt]} → izin ${KELAS[nxt]} langsung jadi.`); await naikSorotan(1); }
          r.izin = true; r.berkas = null;
          await ev('calo', { seat: r.seat });
        } else if (c === 'naik') {
          r.rp -= C.NAIK[nxt]; r.kelas = nxt; r.izin = false;
          if (nxt === 3) r.naikAt = S.t;
          log(`⬆️ ${name(r.seat)} naik kelas jadi ${KELAS[nxt]}!`);
          await ev('naik', { seat: r.seat, kelas: nxt });
        } else if (c === 'transfer') {
          const masuk = Math.floor(r.rp * (1 - fee));
          r.aman += masuk; log(`💸 ${name(r.seat)} transfer ${r.rp} Rupiah ke luar negeri → +${masuk} Harta Aman.`);
          r.rp = 0; await ev('transfer', { seat: r.seat, jumlah: masuk });
        }
      }
    }

    async function giliranRakyat(r) {
      S.turn = r.seat; S.dice = null; update();
      await ev('turn', { seat: r.seat });
      if (r.lapas) {
        const remisi = C.REMISI * r.lapas;
        const options = [
          { id: 'remisi', label: `Beli remisi (${remisi})`, sub: 'Langsung bebas dan main giliran ini', disabled: r.rp < remisi },
          { id: 'sel', label: `Sel mewah (${C.SEL_MEWAH})`, sub: `Tetap dapat gaji ${C.GAJI[r.kelas]}, tidak bergerak`, disabled: r.rp < C.SEL_MEWAH },
          { id: 'jalani', label: 'Jalani hukuman', sub: `Lewati giliran, tanpa gaji (sisa ${r.lapas} putaran)` },
        ];
        const bot = r.kelas >= 2 && r.rp >= remisi + 2 ? 'remisi' : (r.kelas >= 1 && r.rp >= C.SEL_MEWAH ? 'sel' : 'jalani');
        const c = await ask(r.seat, { kind: 'lapas', text: `🔒 Kamu di Lapas (sisa ${r.lapas} putaran).`, options }, bot);
        if (c === 'remisi') { r.rp -= remisi; r.lapas = 0; st('remisi'); log(`${name(r.seat)} membeli remisi, langsung bebas.`); }
        else if (c === 'sel') { r.rp += C.GAJI[r.kelas] - C.SEL_MEWAH; r.lapas--; st('sel_mewah'); log(`${name(r.seat)} menyewa sel mewah.`); return; }
        else { r.lapas--; log(`${name(r.seat)} menjalani hukuman di Lapas.`); await pace(); return; }
      }
      r.rp += C.GAJI[r.kelas];
      log(`${name(r.seat)} (${KELAS[r.kelas]}) terima gaji ${C.GAJI[r.kelas]}.`);
      await ev('gaji', { seat: r.seat });
      if (!S.players[r.seat].bot) await ask(r.seat, { kind: 'roll', text: 'Giliranmu! Lempar dadu untuk jalan.', options: [{ id: 'roll', label: '🎲 Lempar dadu', sub: '' }] }, 'roll');
      const langkah = d6(script.dice && script.dice[r.seat]);
      S.dice = langkah; log(`${name(r.seat)} melempar dadu: ${langkah}.`);
      await ev('dice', { seat: r.seat, d: langkah }); await pace();
      for (let i = 0; i < langkah; i++) {
        r.pos = (r.pos + 1) % 24; update();
        const tile = BOARD[r.pos];
        if (tile === 'SUBUH' && r.utang) {
          if (r.rp >= r.utang) { r.rp -= r.utang; log(`${name(r.seat)} melunasi Pinjol ${r.utang}.`); }
          else { r.rp = 0; r.rekaman = 0; st('pinjol_gagal_bayar'); log(`📱 ${name(r.seat)} gagal bayar Pinjol: uang habis, diteror debt collector.`); }
          r.utang = 0;
        }
        if (tile === 'IZIN' && !r.izin && (r.kelas === 1 || r.kelas === 2) && r.berkas === null) {
          r.berkas = S.t + C.PROSES_RESMI; log(`🏛️ ${name(r.seat)} mengajukan berkas izin resmi (jadi putaran ${r.berkas}).`);
        }
        if (tile === 'DEMO') r.demo = true;
        await pace(0.35);
      }
      // Razia hanya kalau BERHENTI tepat di Pos (lewat saja aman)
      if ((o.pos.includes(r.pos) || o.posTambahan === r.pos) && aktif()) await razia(r);
      if (r.lapas) return;
      const tile = BOARD[r.pos], f = S.f;
      const dapat = { KERJA: 2, PASAR: r.kelas >= 1 ? 3 : 1, PROYEK: r.kelas >= 2 ? 4 : 0, BANSOS: ({ 0: 3, 1: 0 })[r.kelas] ?? 2 }[tile];
      if (dapat !== undefined) {
        r.rp += dapat;
        log(dapat ? `${JT_TILE_EM(tile)} ${name(r.seat)} di ${TILE[tile][1]}: +${dapat} Rupiah.` : `${JT_TILE_EM(tile)} ${name(r.seat)} di ${TILE[tile][1]}: tidak dapat apa-apa.`);
        await ev('petak', { seat: r.seat, tile });
      } else if (tile === 'GUSURAN' && (r.kelas <= 1 || (r.kelas === 2 && f.gusurJuragan))) {
        const c = await ask(r.seat, { kind: 'gusuran', text: '🚜 Satpol datang menggusur lapak.', options: [
          { id: 'bayar', label: 'Bayar uang keamanan (1)', sub: 'Ke Oknum. Lapak aman.', disabled: r.rp < 1 },
          { id: 'gusur', label: 'Biarkan digusur', sub: 'Kehilangan 3 Rupiah' }] }, r.rp >= 1 ? 'bayar' : 'gusur');
        if (c === 'bayar') st('uang_keamanan', bayarOknum(r, 1));
        else { r.rp = Math.max(0, r.rp - 3); st('lapak_digusur'); log(`🚜 Lapak ${name(r.seat)} digusur.`); }
      } else if (tile === 'NASIB') await nasibKartu(r);
      else if (tile === 'VIRAL') { r.rekaman = Math.min(3, r.rekaman + 1); log(`📹 ${name(r.seat)} dapat Kartu Rekaman.`); await ev('rekaman', { seat: r.seat }); }
      else if (tile === 'LAPOR') {
        if (o.sorotan >= C.LAPOR_MIN || f.laporBebas) { r.rp += 1; citra(-C.CITRA_LAPOR); st('laporan_diproses'); log(`📝 Laporan ${name(r.seat)} DIPROSES!`); await naikSorotan(2); }
        else { st('laporan_diabaikan'); log(`📝 Laporan ${name(r.seat)} diabaikan. #PercumaLaporPolisi`); }
        await ev('lapor', { seat: r.seat });
      } else if (tile === 'PINJOL' && !r.utang && r.kelas < 3) {
        const nxt = r.kelas + 1;
        const bot = (r.izin || r.kelas === 0) && r.rp < C.NAIK[nxt] && C.NAIK[nxt] <= r.rp + C.PINJOL_DAPAT ? 'pinjam' : 'tidak';
        const c = await ask(r.seat, { kind: 'pinjol', text: '📱 Aplikasi Pinjol menawarkan dana cepat.', options: [
          { id: 'pinjam', label: `Pinjam +${C.PINJOL_DAPAT}`, sub: `Wajib bayar ${C.PINJOL_BAYAR} saat melewati Subuh. Gagal bayar: uang & Kartu Rekaman habis.` },
          { id: 'tidak', label: 'Tidak', sub: '' }] }, bot);
        if (c === 'pinjam') { r.rp += C.PINJOL_DAPAT; r.utang = C.PINJOL_BAYAR; st('pinjol'); log(`📱 ${name(r.seat)} mengambil Pinjol.`); }
      }
      if (r.lapas) return;
      if (r.berkas !== null && S.t >= r.berkas) { r.izin = true; r.berkas = null; log(`🏛️ Izin resmi ${name(r.seat)} sudah jadi.`); }
      if (r.kelas === 0) r.izin = true; // dagang kecil tidak perlu izin
      await kelola(r, tile);
    }

    // ---------- Oknum ----------
    async function rekayasa(target, sorotan) {
      const c = await ask(target.seat, { kind: 'bongkar', text: `${name(0)} merekayasa kasus terhadapmu!`, options: [
        { id: 'bongkar', label: 'Bongkar pakai Kartu Rekaman', sub: 'Buang 1 Kartu Rekaman · batal · Sorotan Oknum +3', disabled: !target.rekaman },
        { id: 'terima', label: 'Tidak bisa melawan', sub: 'Masuk Lapas 2 putaran' }] }, target.rekaman ? 'bongkar' : 'terima');
      if (c === 'bongkar') {
        target.rekaman--; st('rekayasa_dibongkar'); citra(-C.CITRA_BONGKAR); log(`📹 Rekayasa terhadap ${name(target.seat)} DIBONGKAR rekaman! Citra Oknum −${C.CITRA_BONGKAR}.`); await naikSorotan(3);
      } else {
        await masukLapas(target, 2, 'rekayasa'); citra(2); await naikSorotan(sorotan);
      }
    }

    async function mainKartu(k) {
      o.hand.splice(o.hand.indexOf(k), 1); st('kartu_oknum_' + k);
      log(`🃏 ${name(0)} memainkan ${OKNUM[k][0]}.`);
      await ev('kartu_oknum', { seat: 0, id: k });
      const kaya = rs.filter((r) => r.kelas >= 2 && !r.lapas);
      if (k === 1) o.buzzer = true;
      else if (k === 2) {
        const tiles = BOARD.map((b, i) => i).filter((i) => POS_OK.has(BOARD[i]) && !o.pos.includes(i));
        const bot = [tiles[Math.floor(rng() * tiles.length)]];
        const c = await ask(0, { kind: 'pos', text: 'Pilih 1 petak untuk Pos tambahan.', pick: 1, tiles, options: [] }, bot);
        o.posTambahan = c[0];
      } else if (k === 3) o.backing++;
      else if (k === 4) { o.rp += 4; await naikSorotan(2); }
      else if (k === 6) {
        const target = acak(kaya).sort((a, b) => b.rp - a.rp);
        const tSeat = await ask(0, { kind: 'target', text: 'Tawarkan "uang keamanan" ke siapa?', options: target.map((r) => ({ id: r.seat, label: name(r.seat), sub: `${KELAS[r.kelas]} · ${r.rp} Rupiah` })) }, target[0].seat);
        const r = rs.find((x) => x.seat === tSeat);
        const c = await ask(r.seat, { kind: 'uang_keamanan', text: `${name(0)} menawarkan "uang keamanan" 3 Rupiah.`, options: [
          { id: 'terima', label: 'Bayar 3', sub: 'Kebal semua Pos sampai giliran Oknum berikutnya', disabled: r.rp < 3 },
          { id: 'tolak', label: 'Tolak', sub: 'Tarif 86 kamu jadi ganda' }] }, r.rp >= 5 ? 'terima' : 'tolak');
        if (c === 'terima') { bayarOknum(r, 3); o.dilindungi.push(r.seat); st('uang_keamanan_diterima'); log(`${name(r.seat)} membayar uang keamanan.`); }
        else { o.tarifGanda.push(r.seat); log(`${name(r.seat)} menolak. Tarif 86-nya jadi ganda.`); }
      } else if (k === 7) o.tesUrine = true;
      else if (k === 9) citra(2);
      else if (k === 10) {
        const target = rs.filter((r) => !r.lapas);
        const tSeat = await ask(0, { kind: 'target', text: 'Operasi Senyap: rekayasa kasus siapa?', options: target.map((r) => ({ id: r.seat, label: name(r.seat), sub: `${KELAS[r.kelas]} · 📹×${r.rekaman}` })) }, botTarget(target).seat);
        await rekayasa(rs.find((x) => x.seat === tSeat), 2);
      }
    }
    function botTarget(list) {
      return acak(list).sort((a, b) => ((a.rekaman > 0) - (b.rekaman > 0)) || (b.kelas - a.kelas) || (b.rp - a.rp))[0];
    }

    async function giliranOknum() {
      S.turn = 0; S.dice = null;
      o.buzzer = false; o.posTambahan = null; o.dilindungi = []; o.tarifGanda = [];
      update();
      if (!aktif()) { log(`🔒 ${name(0)} masih di Lapas. Semua Pos kosong.`); await pace(); return; }
      await ev('turn', { seat: 0 });
      if (C.GAJI_OKNUM) { o.rp += C.GAJI_OKNUM; log(`${name(0)} terima gaji aparat ${C.GAJI_OKNUM}.`); }
      // Pos: bot memilih petak dengan harapan setoran terbesar. Rakyat mendarat di 1–6 petak di depannya
      // dengan peluang sama (1/6); Rakyat yang memegang rekaman berbahaya saat Sorotan tinggi.
      const nilai = (i) => rs.reduce((sum, r) => {
        const d = (i - r.pos + 24) % 24;
        if (r.lapas > 1 || d < 1 || d > 6) return sum;
        return sum + C.TARIF_86[r.kelas] * (r.rekaman && o.sorotan >= 5 ? 0.3 : 1);
      }, 0);
      const tujuan = script.pos && script.pos.length ? script.pos.shift()
        : BOARD.map((b, i) => i).filter((i) => POS_OK.has(BOARD[i]))
          .map((i) => [i, nilai(i) + rng() * 0.01]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
      const tiles = BOARD.map((b, i) => i).filter((i) => POS_OK.has(BOARD[i]));
      o.pos = await ask(0, { kind: 'pos', text: `Pasang ${o.nPos} Pos Razia. Rakyat hanya kena razia kalau BERHENTI tepat di Pos.`, pick: o.nPos, tiles, options: [] }, tujuan.slice(0, o.nPos));
      log(`🚨 ${name(0)} memasang Pos Razia.`);
      await ev('pos', { seat: 0 });

      const f = S.f;
      const target = rs.filter((r) => !r.lapas);
      const bisaRek = target.length && !f.noRek && (f.rekGratis || o.rekayasa > 0);
      const kartu = o.hand.filter((k) => !REAKSI.has(k) && (k !== 6 || rs.some((r) => r.kelas >= 2 && !r.lapas)) && (k !== 10 || (!f.noRek && target.length)));
      const options = [
        { id: 'sowan', label: 'Sowan ke atasan (3)', sub: 'Bayar 3 Rupiah → Sorotan −2', disabled: o.rp < 3 },
        { id: 'rekayasa', label: `Rekayasa kasus${f.rekGratis ? ' (gratis)' : ` (token ${o.rekayasa})`}`, sub: 'Target masuk Lapas 2 putaran · Citra +2 · Sorotan +1 · bisa dibongkar rekaman', disabled: !bisaRek },
        { id: 'opres', label: 'Operasi resmi', sub: 'Citra +1 · Sorotan −1 (pencitraan)' },
        { id: 'kartu', label: 'Mainkan kartu', sub: kartu.map((k) => OKNUM[k][0]).join(', ') || 'Tidak ada kartu yang bisa dimainkan', disabled: !kartu.length },
      ];
      // heuristik bot = simulasi
      const kaya = acak(rs.filter((r) => r.kelas >= 2 && !r.lapas)).sort((a, b) => ((a.rekaman > 0) - (b.rekaman > 0)) || (b.rp - a.rp));
      const botRek = kaya.length && S.t >= 3 && !f.noRek;
      let bot = 'opres', botKartu = null;
      const kurangCitra = C.CITRA_MIN - o.citra, sisa = S.putaran - S.t + 1;
      if (o.sorotan >= 8 && o.rp >= 3) bot = 'sowan';
      else if (kurangCitra > 0 && sisa <= kurangCitra + 2) bot = 'opres'; // kejar Citra sebelum game selesai
      else if (o.sorotan >= 7 && o.rp >= 3) bot = 'sowan';
      else if (botRek && f.rekGratis) bot = 'rekayasa';
      else if (botRek && o.rekayasa && kaya[0].rekaman === 0) bot = 'rekayasa';
      else if (botRek && o.hand.includes(10) && o.sorotan <= 6 && kaya[0].rekaman === 0) { bot = 'kartu'; botKartu = 10; }
      else {
        const pref = [[3, true], [4, o.sorotan <= 5], [9, o.citra < C.CITRA_MIN + 2], [6, kaya.length > 0], [7, true], [2, true], [1, rs.reduce((s, r) => s + r.rekaman, 0) >= 2]];
        const hit = pref.find(([k, ok]) => ok && kartu.includes(k));
        if (hit) { bot = 'kartu'; botKartu = hit[0]; }
      }
      const c = await ask(0, { kind: 'aksi', text: 'Pilih 1 aksi Oknum.', options }, bot);
      if (c === 'sowan') { o.rp -= 3; st('sowan'); log(`${name(0)} sowan ke atasan (setor 3).`); await naikSorotan(-2); }
      else if (c === 'opres') { citra(1); log(`${name(0)} menggelar operasi resmi (pencitraan).`); await naikSorotan(-1); }
      else if (c === 'rekayasa') {
        const pilih = S.players[0].bot ? kaya : target;
        const tSeat = await ask(0, { kind: 'target', text: 'Rekayasa kasus terhadap siapa?', options: target.map((r) => ({ id: r.seat, label: name(r.seat), sub: `${KELAS[r.kelas]} · ${r.rp} Rupiah · 📹×${r.rekaman}` })) }, botTarget(pilih).seat);
        if (!f.rekGratis) o.rekayasa--;
        log(`⚖️ ${name(0)} merekayasa kasus terhadap ${name(tSeat)}.`);
        await rekayasa(rs.find((x) => x.seat === tSeat), 1);
      } else if (c === 'kartu') {
        const k = await ask(0, { kind: 'pilih_kartu', text: 'Kartu mana?', options: kartu.map((k) => ({ id: k, label: OKNUM[k][0], sub: OKNUM[k][1] })) }, botKartu !== null ? botKartu : kartu[0]);
        await mainKartu(k);
      }
      if (c === 'sowan' || c === 'opres') await ev('aksi', { seat: 0, c });
      if (o.rp > 0 && aktif()) {
        const t = await ask(0, { kind: 'transfer_oknum', text: 'Pindahkan uang ke luar negeri?', options: [
          { id: 'transfer', label: `Transfer (−20%)`, sub: `${o.rp} Rupiah → ${Math.floor(o.rp * (1 - C.FEE))} Harta Aman · Sorotan +1` },
          { id: 'tidak', label: 'Simpan dulu', sub: 'Rupiah bisa disita kalau kena OTT' }] }, o.rp >= 6 ? 'transfer' : 'tidak');
        if (t === 'transfer') {
          const masuk = Math.floor(o.rp * (1 - C.FEE)); o.aman += masuk;
          log(`💸 ${name(0)} transfer ${o.rp} Rupiah ke luar negeri → +${masuk} Harta Aman.`); o.rp = 0;
          await ev('transfer', { seat: 0, jumlah: masuk });
          await naikSorotan(1);
        }
      }
    }

    // ---------- loop utama ----------
    async function run() {
      for (let t = 1; t <= S.putaran && !stopped; t++) {
        S.t = t; update();
        await ev('putaran', { t });
        await bukaKabar(); if (stopped) break;
        await giliranOknum();
        if (opts.stopAfterTurn && opts.stopAfterTurn(S, 0)) { stopped = true; break; }
        const n = rs.length;
        for (let j = 0; j < n && !stopped; j++) {
          const r = rs[(t + j) % n];
          await giliranRakyat(r);
          if (opts.stopAfterTurn && opts.stopAfterTurn(S, r.seat)) stopped = true;
        }
        if (stopped) break;
        const demo = rs.filter((r) => r.demo);
        if (demo.length * (S.f.demoGanda ? 2 : 1) >= 2) {
          S.batalKabar = true; st('demo_berhasil');
          log(`📢 Demo besar! Kabar Istana putaran berikutnya akan dibatalkan.`);
          await ev('demo', {});
          if (aktif()) {
            const opt = demo.map((r) => ({ id: r.seat, label: name(r.seat), sub: 'Lapas 2 putaran · Sorotan +2' }));
            opt.push({ id: 'tidak', label: 'Biarkan', sub: '' });
            const botPick = o.sorotan <= 7 ? acak(demo).sort((a, b) => b.kelas - a.kelas)[0].seat : 'tidak';
            const c = await ask(0, { kind: 'penghasutan', text: 'Tangkap salah satu pendemo dengan tuduhan penghasutan?', options: opt }, botPick);
            if (c !== 'tidak') { await masukLapas(rs.find((x) => x.seat === c), 2, 'penghasutan'); await naikSorotan(2); }
          }
        }
        rs.forEach((r) => { r.demo = false; });
        if (t % C.KARTU_TIAP === 0) { const n = o.hand.length; ambilOknum(1); if (o.hand.length > n) await ev('ambil_oknum', { seat: 0, id: o.hand[o.hand.length - 1] }); }
      }
      if (stopped) { S.phase = 'stopped'; update(); return S; }
      // skor akhir
      if (o.citra < C.CITRA_MIN) st('oknum_dimutasi');
      const skor = [{ seat: 0, role: 'Oknum', aman: o.aman, score: o.citra >= C.CITRA_MIN ? o.aman : Math.floor(o.aman * C.MUTASI_KALI), mutasi: o.citra < C.CITRA_MIN }]
        .concat(rs.map((r) => ({ seat: r.seat, role: 'Rakyat', kelas: r.kelas, aman: r.aman, score: r.kelas === 3 ? r.aman : 0, rp: r.rp })));
      skor.forEach((s) => { s.name = name(s.seat); s.tie = rng(); });
      skor.sort((a, b) => (b.score - a.score) || ((b.kelas || 0) - (a.kelas || 0)) || ((b.rp || 0) - (a.rp || 0)) || (b.tie - a.tie));
      st('tetap_jelata', rs.filter((r) => r.kelas === 0).length);
      S.result = { ranking: skor, winner: skor[0].seat };
      S.phase = 'end'; S.turn = null;
      log(`🏁 Permainan selesai. Juara: ${skor[0].name} (${skor[0].role}).`);
      await ev('end', {});
      return S;
    }

    return { S, run, answer, setBot, stop: () => { stopped = true; if (pending) pending.res(S.prompt && S.prompt.bot); } };
  }

  const api = { C, KELAS, BOARD, POS_OK: [...POS_OK], TILE, KABAR, NASIB, OKNUM, createGame, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JalanTikus = api;
})(typeof window !== 'undefined' ? window : globalThis);
