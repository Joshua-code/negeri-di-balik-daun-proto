/* Meja Hijau — mesin aturan. Port dari tools/sim_meja_hijau.py (aturan: docs/05-meja-hijau.md).
 * Dipakai di browser (window.MejaHijau) dan Node (require). Protokol sama dengan engine.js (Jalan Tikus):
 * setiap keputusan lewat ask(): kursi bot dijawab heuristik simulasi, kursi manusia menunggu answer().
 * Prompt angka (tarif, amplop, ongkos) tetap memakai options (satu opsi per angka) + prompt.angka {min, max} untuk UI.
 * Info rahasia: S.cur.x (isi amplop, tarif asli), Fulus/Aset oknum, S.priv[seat], S.stats (dibuka di akhir).
 */
(function (root) {
  'use strict';

  const C = {
    PERKARA: 8, PERKARA_5P: 7, BERKAS: 2, BERKAS_5P: 2, DANA_5P: 8, GAJI: { hakim: 1, anggota: 1, panitera: 1, pengacara: 1 },
    GAJI_RAKYAT: [1, 2, 3], NAIK: [0, 5, 10], RP_AWAL: { hakim: 3, anggota: 3, panitera: 0, pengacara: 6, rakyat: 2 }, RP_AWAL_5P: { pengacara: 3 }, KERJA: 2,
    CITRA_AWAL: 5, CITRA_MIN: 6, MUTASI: 0.7, CITRA_ADIL: 1, CITRA_KECIL: 2, CITRA_JANGGAL: 1, CITRA_BEBAS_VIRAL: 2, CITRA_PERS: 2,
    SAKIT_SP: 1, TERCECER_SP: 1, TUNJANGAN: 2, FEE: 0.2,
    VIRAL_AWAL: 2, VIRAL_MAX: 3, VIRAL_PER_MAIN: 2, VIRAL_SP: 3, KAWAL_SP: 1, DAMAI_SP: -2, KARET: 2,
    LANGSUNG_SOR: 2, JANGGAL_SOR: 1, JANGGAL_SOR_VIRAL: 2, JANGGAL_SP_MIN: 5, MARAH: 2,
    KASASI_MIN: 7, KASASI_ANAK: 8, MAKELAR: 6, MAKELAR_KEBAL: 9, KASASI_SOR: 3, KASASI_CITRA: 2, BOCOR_SOR: 3,
    KEADILAN_MENANG: 13, KEADILAN_5P: 12, KASASI_KEADILAN: 1, CEPU_PELUANG: 0.5, CEPU_BONUS: 2, CEPU_SOR: 5,
    PRAPER: 5, PK: 4, PRAPER_SP: 5, SEL_MEWAH: 2, TUMBAL_SOR_HAKIM: 6, TUMBAL_SOR_PANITERA: 3,
    // strategi bot (bukan aturan; sama dengan tools/sim_meja_hijau.py)
    ASK: { rakus: 0.4, ambang: 0.3 }, ASK_5P: 0.8, MARKUP: { tipis: 3, sedang: 5, rakus: 7 }, DAMAI_TAWAR: 0.3, CURIGA: 0.5,
    TERIMA: { rakus: 0.5, ambang: 0.8 },
    // Kekayaan akhir = Fulus + Aset (oknum) / + Nilai Usaha kelas (Keluarga Korban); juara Keadilan + Santunan. KURS: Kekayaan → Dana Offshore (docs/06)
    NILAI_USAHA: [0, 1, 4], SANTUNAN: 25, SANTUNAN_5P: 35, KURS: 15, UANG: 'Fulus', ASET_BOT_RP: 6, ASET_BOT_SOR: 5,
  };
  const BEBAS = 0, RINGAN = 1, BERAT = 2;
  const VONIS = ['Bebas', 'Ringan', 'Berat'];
  const ROLE_OF = ['hakim', 'panitera', 'pengacara', 'rakyat', 'anggota'];
  const ROLES = {
    hakim: ['👨‍⚖️', 'Hakim'], anggota: ['🧑‍⚖️', 'Hakim Anggota'], panitera: ['📁', 'Panitera'],
    pengacara: ['💼', 'Pengacara Makelar'], rakyat: ['🕯️', 'Keluarga Korban'],
  };
  const KELAS = ['Jelata', 'Pedagang', 'Pengusaha'];
  const TERDAKWA = { konglo: ['🎩', 'Konglomerat'], anak: ['🧒', 'Anak Pejabat'], koruptor: ['🏛️', 'Pejabat Korup'], kecil: ['👵', 'Rakyat Kecil'] };
  const TARGET = { konglo: BEBAS, anak: BEBAS, koruptor: RINGAN };
  const ADIL = { konglo: BERAT, anak: BERAT, koruptor: BERAT, kecil: RINGAN };
  // tabel 7.1 docs/05: [nama, jenis, dana, sorotan awal, bukti kuat, nilai keadilan, rujukan]
  const PERKARA = [
    ['Minyak Goreng Langka', 'konglo', 18, 3, true, 3, 'Suap vonis lepas CPO (tarif Rp60 M)'],
    ['Tambang Timah Bolong', 'konglo', 20, 2, false, 3, 'Kasus timah'],
    ['Impor Gula Kilat', 'konglo', 15, 2, false, 3, 'Importir gula'],
    ['Anak Dewan Aniaya Pacar', 'anak', 13, 3, true, 2, 'Vonis bebas dibeli (Tannur)'],
    ['Tabrak Lari Mobil Dinas', 'anak', 11, 2, true, 2, 'Impunitas keluarga pejabat'],
    ['Pesta Narkoba Anak Jenderal', 'anak', 12, 1, false, 2, 'Impunitas keluarga aparat'],
    ['Bansos Disunat', 'koruptor', 11, 2, true, 2, 'Rata-rata vonis koruptor 3 th 4 bln (ICW)'],
    ['Proyek Jalan Fiktif', 'koruptor', 9, 1, false, 2, 'Vonis ringan koruptor'],
    ['Dana Desa Raib', 'koruptor', 10, 1, true, 2, 'Vonis ringan koruptor'],
    ['Nenek Pemungut Kakao', 'kecil', 0, 1, true, 0, 'Nenek Minah'],
    ['Nenek dan Kayu Jati', 'kecil', 0, 0, true, 0, 'Nenek Asyani'],
    ['Sandal Jepit Polisi', 'kecil', 0, 1, true, 0, 'Tajam ke bawah'],
  ].map(([nama, jenis, dana, sp, kuat, nilai, rujukan], id) => ({ id, nama, jenis, dana, sp, kuat, nilai, rujukan }));
  // tabel 7.2 docs/05
  const KABAR = {
    1: ['Ketua MA Baru: "Bersih-Bersih!"', 'Sorotan Hakim, Panitera, Pengacara +1.'],
    2: ['Tunjangan Hakim Naik', 'Tiap Hakim +2 Fulus ("supaya tidak korupsi").'],
    3: ['Makelar MA Terbongkar', 'Kasasi tidak bisa diblokir. Pengacara yang pernah membayar Makelar MA: Sorotan +2.'],
    4: ['Rehabilitasi dari Istana', 'Keluarga Korban −2 Keadilan (vonis lama dihapus).'],
    5: ['Abolisi "Rekonsiliasi"', 'Pemain rantai dengan Sorotan tertinggi: Sorotan −3.'],
    6: ['Remisi 17 Agustus', 'Semua pemain di Lapas langsung bebas.'],
    7: ['Komisi Yudisial Dilemahkan', 'Putusan Janggal tidak menambah Sorotan pribadi.'],
    8: ['Revisi UU ITE Ditunda Lagi', 'Pasal Karet kena di angka 1–3.'],
    9: ['No Viral No Justice', 'Ambang kasasi −2.'],
    10: ['Hari Antikorupsi Sedunia', 'Jalur Langsung Sorotan +4; Beli Aset Hakim/Panitera Sorotan +2.'],
    11: ['Media Sibuk Gosip Artis', 'Sorotan Perkara ini −2.'],
    12: ['RUU Perampasan Aset Ditunda Lagi', 'Tidak terjadi apa-apa. Kartu diselipkan ke bawah deck.'],
  };
  // tabel 7.3 docs/05
  const SIASAT = {
    sakit: ['Sakit Mendadak', 'Setelah respons Keluarga Korban: Sorotan Perkara −1.'],
    pers: ['Jumpa Pers', 'Citra +2.'],
    jadwal: ['Atur Jadwal', 'Lihat 2 kartu Perkara teratas, pilih yang dibuka.'],
    tercecer: ['Berkas Tercecer', 'Setelah Keluarga Korban memviralkan: Sorotan Perkara −1.'],
    praper: ['Praperadilan', 'Bayar 5 dari kas klien ke hakim: perkara gugur (Bebas, tanpa kasasi).'],
    pk: ['PK Diskon', 'Bayar 4 ke Hakim: vonis Berat lama jadi Ringan, +½ Dana Klien lama.'],
  };
  const SIASAT_AWAL = { hakim: ['sakit', 'pers'], anggota: ['sakit', 'pers'], panitera: ['jadwal', 'tercecer'], pengacara: ['praper', 'pk'], rakyat: [] };
  const STRATS = { hakim: ['rakus', 'ambang'], anggota: ['rakus', 'ambang'], panitera: ['tipis', 'sedang', 'rakus'],
    pengacara: ['patuh', 'curiga', 'langsung'], rakyat: ['keadilan', 'damai', 'campur'] };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const Dompet = () => root.NDBDDompet || require('./ndbd-dompet.js');   // konversi Kekayaan → Dana Offshore
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

  /**
   * players: [{name, bot, pid}] — kursi 0 Hakim, 1 Panitera, 2 Pengacara, 3 Keluarga Korban, 4 Hakim Anggota (opsional → varian 5 pemain).
   * opts: rng, delay, putaran (jumlah perkara), script {perkara:[id..], kabar:[..], karet:[..], strat:{seat:'..'}, cepu: seat|null},
   *       setup(S), onUpdate(S), onEvent(ev), strict, stopAfterTurn(S, seat),
   *       onPace(k) (jeda k × delay, untuk estimasi durasi), onPhase('nego', S) → Promise (jendela negosiasi online).
   */
  function createGame(players, opts = {}) {
    const rng = opts.rng || Math.random;
    const script = opts.script || {};
    const delayMs = () => (typeof opts.delay === 'function' ? opts.delay() : opts.delay || 0);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const d6 = (queue) => (queue && queue.length ? queue.shift() : 1 + Math.floor(rng() * 6));
    const n5 = players.length >= 5;

    const S = {
      t: 0, putaran: opts.putaran || (players.length >= 5 ? C.PERKARA_5P : C.PERKARA), phase: 'play', turn: null, kabar: null, cur: null, n5,
      log: [], events: [], evN: 0, logN: 0, prompt: null, stats: {}, result: null, f: {},
      players: players.map((p) => ({ name: p.name, bot: !!p.bot, pid: p.pid || null })),
      p: players.map((pl, seat) => {
        const role = ROLE_OF[seat];
        return { seat, role, rp: (players.length >= 5 && C.RP_AWAL_5P[role] !== undefined ? C.RP_AWAL_5P : C.RP_AWAL)[role], aset: 0, sor: role === 'rakyat' ? 0 : 1, backing: ['hakim', 'anggota', 'pengacara'].includes(role) ? 1 : 0,
          citra: C.CITRA_AWAL, lapas: 0, siasat: SIASAT_AWAL[role].slice(), jc: false, tumbal: role === 'hakim', makelar: false,
          kelas: 0, keadilan: 0, viral: role === 'rakyat' ? C.VIRAL_AWAL : 0, hadir: true,
          ottAt: -1, kebalAt: -1 };   // Perlindungan Korban: perkara OTT terakhir / perkara kebal Lapas
      }),
      priv: players.map(() => ({ log: [], rahasia: null, tahuOngkos: false })),
      cepu: null, beratKaya: [], danaLama: {},   // beratKaya: nomor perkara kaya yang divonis Berat (untuk PK Diskon)
      decks: {
        perkara: script.perkara ? script.perkara.slice().reverse() : shuffle(PERKARA.map((x) => x.id)),
        kabar: script.kabar ? script.kabar.slice().reverse() : shuffle(Object.keys(KABAR).map(Number)),
      },
    };
    const P = S.p, H = P[0], PN = P[1], PG = P[2], R = P[3], A = n5 ? P[4] : null;
    const hakimAll = A ? [H, A] : [H];
    const rantaiRoles = hakimAll.concat([PN, PG]);
    const strat = players.map((pl, seat) => (script.strat && script.strat[seat]) || STRATS[ROLE_OF[seat]][Math.floor(rng() * STRATS[ROLE_OF[seat]].length)]);
    // Kartu Rahasia: 50% ada satu Cepu di antara anggota rantai
    const cepuSeat = script.cepu !== undefined ? script.cepu : rng() < C.CEPU_PELUANG ? rantaiRoles[Math.floor(rng() * rantaiRoles.length)].seat : null;
    S.cepu = cepuSeat;
    rantaiRoles.forEach((p) => { S.priv[p.seat].rahasia = p.seat === cepuSeat ? 'cepu' : 'bersih'; });
    if (opts.setup) opts.setup(S);

    let promptSeq = 0, pending = null, stopped = false;
    const name = (seat) => S.players[seat].name;
    const st = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
    const update = () => opts.onUpdate && opts.onUpdate(S);
    const log = (msg) => { S.log.push({ n: ++S.logN, t: S.t, msg }); if (S.log.length > 60) S.log.shift(); update(); };
    const note = (seat, msg) => { const L = S.priv[seat].log; L.push({ n: ++S.logN, t: S.t, msg }); if (L.length > 40) L.shift(); update(); };
    const PACE = { perkara_baru: 1, kabar: 2.5, perkara: 3.5, gaji: 0.4, amplop: 1.2, damai: 1.2, respons: 1.4, karet: 1.2, simpan: 1,
      putusan: 3.5, kasasi: 3, makelar: 1.5, bocor: 1.5, ott: 1.5, lapas: 1.5, aset: 1.2, cepu: 2.5, praper: 2, pk: 1.5, naik: 1.2, siasat: 1.2 };
    const pace = async (k = 1) => { if (opts.onPace) opts.onPace(k); const d = delayMs(); if (d) await sleep(d * k); };
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
      S.turn = seat;
      if (S.players[seat].bot) { await pace(0.5); return botChoice; }
      S.prompt = Object.assign({ id: ++promptSeq, seat, bot: botChoice }, prompt);
      update();
      const choice = await new Promise((res) => { pending = { id: S.prompt.id, res }; });
      S.prompt = null; pending = null; update();
      return choice;
    }
    // prompt angka: satu opsi per nilai; UI memakai prompt.angka untuk pemilih −/+
    const askAngka = (seat, kind, text, min, max, bot, sub) =>
      ask(seat, { kind, text, sub, angka: { min, max }, options: range(min, max).map((n) => ({ id: n, label: String(n) })) },
        Math.max(min, Math.min(max, Math.round(bot))));
    const yesNo = (seat, kind, text, yes, no, bot) =>
      ask(seat, { kind, text, options: [{ id: 'ya', label: yes[0], sub: yes[1] }, { id: 'tidak', label: no[0], sub: no[1] }] }, bot ? 'ya' : 'tidak');
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

    // ---------- Sorotan & OTT ----------
    async function sorot(p, n) {
      if (p.role === 'rakyat') return;
      if (n > 0 && p.ottAt === S.t) return;   // Perlindungan Korban: maks 1 OTT per pemain per perkara
      p.sor = Math.max(0, p.sor + n);
      if (p.sor < 10) return;
      p.ottAt = S.t;
      st('ott');
      const bisaTumbal = p === H && p.tumbal && !PN.lapas;
      const options = [
        { id: 'tumbal', label: 'Tumbalkan Panitera', sub: `Sekali per game · Sorotanmu → ${C.TUMBAL_SOR_HAKIM} · Panitera Sorotan +${C.TUMBAL_SOR_PANITERA}`, disabled: !bisaTumbal },
        { id: 'backing', label: 'Pakai Backing', sub: 'Buang 1 Backing · Sorotan → 7', disabled: !p.backing },
        { id: 'tertangkap', label: 'Pasrah tertangkap', sub: 'Semua Fulus disita · Lapas 1 perkara · Sorotan → 5' },
      ];
      await ev('ott', { seat: p.seat });
      const c = await ask(p.seat, { kind: 'ott', text: '🚨 OTT! Sorotanmu menyentuh 10. Bagaimana kamu lolos?', options },
        bisaTumbal ? 'tumbal' : p.backing ? 'backing' : 'tertangkap');
      if (c === 'tumbal') {
        p.tumbal = false; p.sor = C.TUMBAL_SOR_HAKIM; st('ott_tumbal');
        log(`🚨 OTT! ${name(p.seat)} menumbalkan Panitera. Berita: "oknum panitera ditangkap".`);
        await sorot(PN, C.TUMBAL_SOR_PANITERA);
      } else if (c === 'backing') {
        p.backing--; p.sor = 7; st('ott_backing'); log(`🚨 OTT! ${name(p.seat)} diselamatkan Backing.`);
      } else {
        st('ott_tertangkap'); st('disita', p.rp);
        const kebal = p.kebalAt === S.t;
        log(`🚨 OTT! ${name(p.seat)} TERTANGKAP. Semua Fulus di tangan disita${kebal ? ' (baru keluar Lapas, jadi tidak masuk lagi)' : ', masuk Lapas 1 perkara'}. Keluarga Korban Keadilan +1.`);
        p.rp = 0; p.sor = 5; R.keadilan += 1;
        if (!p.backing) { p.backing = 1; log(`🛡️ Simpati Publik: jaringan lama ${name(p.seat)} turun tangan (+1 Backing).`); }
        if (!kebal) { p.lapas = 1; await ev('lapas', { seat: p.seat, sebab: 'ott' }); }
      }
    }
    // Beli Aset: Fulus → Aset (potong 20%). Aset tidak bisa disita OTT. Hakim/Panitera: pamer harta, Sorotan +1 (LHKPN).
    async function beliAset(p) {
      const masuk = Math.floor(p.rp * (1 - C.FEE));
      note(p.seat, `🏠 Kamu membelanjakan ${p.rp} Fulus jadi Aset (+${masuk}).`);
      log(`🏠 ${name(p.seat)} membeli aset baru.`);
      p.aset += masuk; p.rp = 0; st('aset_dibeli', masuk);
      await ev('aset', { seat: p.seat, jumlah: masuk });
      if (['hakim', 'anggota', 'panitera'].includes(p.role)) await sorot(p, S.f.antikorupsi ? 2 : 1);
    }

    // ---------- Kabar Istana ----------
    async function bukaKabar() {
      S.f = { karet: C.KARET, kasasiMin: 0, makelarMati: false, janggalNol: false, antikorupsi: false, sp: 0 };
      if (!S.decks.kabar.length) { S.kabar = null; return; }
      const k = S.decks.kabar.pop();
      S.kabar = { id: k };
      log(`📰 Kabar Istana: ${KABAR[k][0]} — ${KABAR[k][1]}`);
      await ev('kabar', { id: k });
      const f = S.f;
      if (k === 1) { for (const p of rantaiRoles) await sorot(p, 1); }
      else if (k === 2) hakimAll.forEach((p) => { p.rp += C.TUNJANGAN; });
      else if (k === 3) { f.makelarMati = true; if (PG.makelar) await sorot(PG, 2); }
      else if (k === 4) { if (R.keadilan) st('rehabilitasi_hapus'); R.keadilan = Math.max(0, R.keadilan - 2); }
      else if (k === 5) { const p = rantaiRoles.slice().sort((a, b) => b.sor - a.sor)[0]; p.sor = Math.max(0, p.sor - 3); }
      else if (k === 6) P.forEach((p) => { p.lapas = 0; });
      else if (k === 7) f.janggalNol = true;
      else if (k === 8) f.karet = 3;
      else if (k === 9) f.kasasiMin = -2;
      else if (k === 10) f.antikorupsi = true;
      else if (k === 11) f.sp = -2;
      else if (k === 12) S.decks.kabar.unshift(k);
    }

    // ---------- kehadiran (Lapas & Sel Mewah) ----------
    async function cekHadir(p) {
      p.hadir = true;
      if (!p.lapas) return;
      p.lapas = 0;
      p.kebalAt = S.t + 1;   // Perlindungan Korban: kebal Lapas di perkara berikutnya
      const dompet = p.rp + (p.role !== 'rakyat' ? p.aset : 0);
      if (dompet >= C.SEL_MEWAH) {
        const c = await yesNo(p.seat, 'sel_mewah', `🔒 Kamu di Lapas. Beli Sel Mewah (${C.SEL_MEWAH}) supaya tetap bisa beraksi di perkara ini?`,
          ['🛋️ Beli Sel Mewah', p.role !== 'rakyat' ? 'Kurang Fulus? Jual sebagian Aset' : `Bayar ${C.SEL_MEWAH} Fulus`], ['Jalani hukuman', 'Absen 1 perkara, tanpa gaji'], dompet >= C.SEL_MEWAH + 2);
        if (c === 'ya') {
          if (p.rp >= C.SEL_MEWAH) p.rp -= C.SEL_MEWAH; else { p.aset -= C.SEL_MEWAH - p.rp; p.rp = 0; }
          st('sel_mewah'); log(`🛋️ ${name(p.seat)} membeli Sel Mewah dan tetap beraksi dari dalam.`);
          return;
        }
      }
      p.hadir = false; st('absen_lapas');
      log(`🔒 ${name(p.seat)} absen perkara ini (di Lapas).`);
    }

    // ---------- helpers ----------
    const tercapai = (target, v) => v === target || (target === RINGAN && v === BEBAS);
    const mogok = (x, t) => strat[x.seat] === 'ambang' && x.citra - C.CITRA_JANGGAL < C.CITRA_MIN && t >= S.putaran - 1;
    const aktif = (p) => p && p.hadir && !p.jc;
    const opsiVonis = (adil, target) => [BEBAS, RINGAN, BERAT].map((v) => ({ id: v, label: `${['🕊️', '⚖️', '⛓️'][v]} ${VONIS[v]}`,
      sub: [v === adil ? 'Putusan Adil' : 'Janggal', target !== undefined && tercapai(target, v) ? 'sesuai keinginan klien' : ''].filter(Boolean).join(' · ') }));

    // ---------- satu perkara ----------
    async function perkara(t) {
      S.cur = null;
      await ev('perkara_baru', { t });
      await bukaKabar(); if (stopped) return;
      for (const p of P) await cekHadir(p);
      for (const p of P) if (p.hadir) p.rp += p.role === 'rakyat' ? C.GAJI_RAKYAT[p.kelas] : C.GAJI[p.role];
      // Siasat Panitera: Atur Jadwal
      const dk = S.decks.perkara;
      if (aktif(PN) && PN.siasat.includes('jadwal') && dk.length >= 2) {
        const a = PERKARA[dk[dk.length - 1]], b = PERKARA[dk[dk.length - 2]];
        const c = await ask(PN.seat, { kind: 'jadwal', text: '📅 Atur Jadwal? Kamu mengintip 2 kartu Perkara teratas. Pilih yang disidangkan sekarang (sekali per game).', options: [
          { id: 'a', label: `${TERDAKWA[a.jenis][0]} ${a.nama}`, sub: a.dana ? `Dana Klien ${a.dana + (n5 ? C.DANA_5P : 0)}` : 'Rakyat Kecil, tanpa klien' },
          { id: 'b', label: `${TERDAKWA[b.jenis][0]} ${b.nama}`, sub: (b.dana ? `Dana Klien ${b.dana + (n5 ? C.DANA_5P : 0)}` : 'Rakyat Kecil, tanpa klien') + ' · pakai Atur Jadwal' },
          { id: 'tidak', label: 'Simpan kartu Siasat', sub: 'Kartu teratas yang disidangkan' }] }, a.dana < b.dana - 3 ? 'b' : 'tidak');
        if (c === 'b') {
          PN.siasat.splice(PN.siasat.indexOf('jadwal'), 1);
          const top = dk.pop(), second = dk.pop(); dk.unshift(top); dk.push(second);
          st('siasat_jadwal'); log(`📅 ${name(PN.seat)} mengatur jadwal sidang.`);
          await ev('siasat', { seat: PN.seat, id: 'jadwal' });
        } else if (c === 'a') {
          PN.siasat.splice(PN.siasat.indexOf('jadwal'), 1); st('siasat_jadwal');
        }
      }
      const card = PERKARA[dk.pop()];
      const dana = card.dana ? card.dana + (n5 ? C.DANA_5P : 0) : 0;
      const adil = ADIL[card.jenis], target = TARGET[card.jenis];
      const cur = S.cur = { card: card.id, dana, sp: Math.max(0, card.sp + S.f.sp), adil, target, route: null, amplop: false, damai: null, respons: null,
        votes: {}, vonis: null, kasasi: false, gugur: false, status: {}, x: { kas: 0, tarif: {}, quote: null, kirim: 0, terima: {}, potong: 0 } };
      log(`⚖️ Perkara ${t}: ${card.nama} — terdakwa ${TERDAKWA[card.jenis][1]}${dana ? `, Dana Klien ${dana}` : ''}.`);
      await ev('perkara', { id: card.id });
      if (opts.onPhase && card.jenis !== 'kecil') await opts.onPhase('nego', S);   // jendela negosiasi (online)
      const hakims = hakimAll.filter(aktif);

      // --- Perkara Tanpa Pembela ---
      if (card.jenis === 'kecil') {
        if (R.hadir) { R.rp += C.KERJA; log(`🛠️ ${name(R.seat)} tidak punya urusan di sini: Kerja, +${C.KERJA} Fulus.`); }
        let berat = 0;
        for (const x of hakims) {
          const v = await ask(x.seat, { kind: 'putusan_kecil', text: `👵 ${card.nama}: terdakwa rakyat kecil tanpa pembela. Putusanmu?`, options: [
            { id: BERAT, label: '⛓️ Berat', sub: `Citra +${C.CITRA_KECIL} (tegas pada rakyat kecil)` },
            { id: RINGAN, label: '⚖️ Ringan', sub: 'Putusan Adil · tanpa Citra' }] }, BERAT);
          cur.votes[x.seat] = v;
          if (v === BERAT) { x.citra += C.CITRA_KECIL; berat++; }
        }
        const votes = Object.values(cur.votes).concat(A ? [RINGAN] : []);
        cur.vonis = votes.length && votes.filter((v) => v === BERAT).length * 2 > votes.length ? BERAT : RINGAN;
        if (cur.vonis === BERAT) st('rakyat_kecil_berat');
        log(`🔨 Putusan: ${VONIS[cur.vonis]}. ${cur.vonis === BERAT ? 'Rakyat kecil dihukum berat, tanpa pembela.' : 'Putusan adil.'}`);
        await ev('putusan', { vonis: cur.vonis, adil });
        await akhirPerkara(t, []);
        return;
      }

      let kas = dana;
      if (PN.hadir) { const b = n5 ? C.BERKAS_5P : C.BERKAS; kas -= b; PN.rp += b; log(`📁 Biaya Berkas: ${name(PN.seat)} mengambil ${b} dari kas klien.`); }
      const pgOk = aktif(PG);
      const rutePn = pgOk && aktif(PN);
      const syncKas = () => { cur.x.kas = kas; };
      syncKas();
      const rantai = new Set();

      // --- Praperadilan ---
      if (pgOk && PG.siasat.includes('praper') && !(card.kuat && cur.sp >= C.PRAPER_SP) && hakims.length) {
        const c = await yesNo(PG.seat, 'praper', `📜 Pakai Praperadilan? Bayar ${C.PRAPER} dari kas klien ke seorang hakim. Kalau diterima, perkara gugur: dihitung Bebas, tanpa kasasi.`,
          ['📜 Ajukan Praperadilan', `Kas klien ${kas} → ${kas - C.PRAPER} · sekali per game`], ['Tidak', 'Lanjut ke negosiasi'], dana >= 12 && kas >= C.PRAPER);
        if (c === 'ya' && kas >= C.PRAPER) {
          PG.siasat.splice(PG.siasat.indexOf('praper'), 1);
          let hp = hakims[0];
          if (hakims.length > 1) {
            const s = aktif(PN) ? await ask(PN.seat, { kind: 'pilih_hakim', text: 'Praperadilan diperiksa hakim tunggal. Kamu yang memilih hakimnya.',
              options: hakims.map((x) => ({ id: x.seat, label: `${ROLES[x.role][0]} ${name(x.seat)}`, sub: ROLES[x.role][1] })) }, hakims[Math.floor(rng() * hakims.length)].seat)
              : hakims[Math.floor(rng() * hakims.length)].seat;
            hp = P[s];
          }
          const ok = await yesNo(hp.seat, 'praper_terima', `📜 Pengacara mengajukan Praperadilan dengan "biaya" ${C.PRAPER} untukmu. Kabulkan?`,
            [`✅ Kabulkan (+${C.PRAPER} Fulus)`, 'Perkara gugur · Sorotanmu +1'], ['❌ Tolak', 'Perkara lanjut disidangkan'], true);
          if (ok === 'ya') {
            kas -= C.PRAPER; hp.rp += C.PRAPER; syncKas();
            note(hp.seat, `📜 Kamu menerima ${C.PRAPER} dari Praperadilan.`);
            cur.gugur = true; cur.vonis = target; st('praperadilan'); st('vonis_dibeli');
            PG.rp += kas; note(PG.seat, `💼 Komisi: sisa kas klien ${kas} jadi milikmu.`);
            log(`📜 Praperadilan dikabulkan ${name(hp.seat)}. Perkara ${card.nama} GUGUR. Tidak ada putusan, tidak ada kasasi.`);
            await ev('praper', { seat: hp.seat });
            await sorot(hp, 1);
            await akhirPerkara(t, [hp, PG]);
            return;
          }
          log(`📜 Praperadilan ditolak ${name(hp.seat)}. Perkara lanjut.`);
        }
      }

      // --- Negosiasi lewat Panitera ---
      for (const x of hakims) {
        const bot = strat[x.seat] && C.ASK[strat[x.seat]] && !mogok(x, t) ? C.ASK[strat[x.seat]] * dana * (n5 ? C.ASK_5P : 1) : 0;
        const v = await askAngka(x.seat, 'tarif', `🤫 Berapa tarifmu untuk vonis yang diinginkan klien (${VONIS[target]})? Pesanmu hanya sampai ke Panitera. 0 = kamu menolak suap.`,
          0, dana, Math.max(1, bot) * (bot > 0 ? 1 : 0), `Dana Klien ${dana} (tercetak di kartu)`);
        cur.x.tarif[x.seat] = v;
        note(x.seat, v ? `🤫 Kamu meminta ${v} lewat Panitera.` : '🤫 Kamu menolak suap.');
        if (aktif(PN)) note(PN.seat, `🤫 ${name(x.seat)} (${ROLES[x.role][1]}) meminta ${v || 'nol: menolak suap'}.`);
      }
      const tarifTotal = Object.values(cur.x.tarif).reduce((a, b) => a + b, 0);
      const semuaMinta = hakims.length === hakimAll.length && hakims.every((x) => cur.x.tarif[x.seat] > 0);
      if (rutePn) {
        const bot = tarifTotal && semuaMinta ? Math.min(tarifTotal + C.MARKUP[strat[PN.seat]], kas - 1) : 0;
        const q = await askAngka(PN.seat, 'relay', `📨 Hakim meminta total ${tarifTotal}. Tarif berapa yang kamu sampaikan ke Pengacara? Selisihnya bisa kamu ambil dari amplop.`,
          0, dana, bot, 'Pengacara tidak tahu tarif asli, kecuali ia memakai Jalur Langsung.');
        cur.x.quote = q;
        note(PN.seat, `📨 Kamu menyampaikan tarif ${q} ke Pengacara.`);
        note(PG.seat, `📨 Panitera: "Tarif Yang Mulia ${q}."`);
        log(`📨 ${name(PN.seat)} menyampaikan pesan hakim ke ${name(PG.seat)}.`);
      }

      // --- Amplop ---
      let dikirim = 0;
      if (pgOk) {
        const s = strat[PG.seat];
        const quote = cur.x.quote;
        const mauSuap = semuaMinta && tarifTotal > 0 && tarifTotal <= kas - 1;
        const ingin = !mauSuap ? 'tidak'
          : (!rutePn || s === 'langsung' || PG.tahuOngkos || (s === 'curiga' && quote > dana * C.CURIGA) || quote > kas - 1) ? 'langsung' : 'panitera';
        let pilih = await ask(PG.seat, { kind: 'amplop', text: `✉️ Kas klien ${kas}. Bagaimana kamu "mengurus" perkara ini?`, options: [
          { id: 'panitera', label: '✉️ Amplop lewat Panitera', sub: quote !== null ? `Panitera bilang tarifnya ${quote}` : 'Panitera tidak hadir', disabled: !rutePn },
          { id: 'langsung', label: '🤝 Jalur Langsung', sub: `Ajak hakim bertemu. Tarif asli terbuka, tapi Sorotanmu & hakim +${S.f.antikorupsi ? 4 : C.LANGSUNG_SOR}`, disabled: !hakims.length },
          { id: 'tidak', label: '🙅 Tidak menyuap', sub: 'Biarkan hakim memutus sendiri' }] }, ingin);
        if (pilih === 'langsung') {
          let semua = true;
          for (const x of hakims) {
            const mau = await yesNo(x.seat, 'bertemu', `🤝 ${name(PG.seat)} mengajakmu bertemu langsung. Terima?`,
              ['Terima', `Sorotanmu +${S.f.antikorupsi ? 4 : C.LANGSUNG_SOR}`], ['Tolak', 'Terlalu berisiko'], strat[x.seat] === 'rakus' && cur.x.tarif[x.seat] > 0);
            if (mau !== 'ya') { semua = false; log(`🙅 ${name(x.seat)} menolak bertemu ${name(PG.seat)}.`); }
          }
          if (semua) {
            cur.route = 'langsung'; st('jalur_langsung');
            for (const x of hakims) note(PG.seat, `🤝 ${name(x.seat)} menyebut tarif aslinya: ${cur.x.tarif[x.seat]}.`);
            if (quote !== null && quote > tarifTotal) {
              PG.tahuOngkos = true; st('ongkos_ketahuan');
              note(PG.seat, `😠 Tarif asli ${tarifTotal}, tapi Panitera bilang ${quote}. Panitera menggelembungkan ${quote - tarifTotal}!`);
            }
            log(`🤝 ${name(PG.seat)} bertemu langsung dengan hakim.`);
            for (const x of [PG].concat(hakims)) await sorot(x, S.f.antikorupsi ? 4 : C.LANGSUNG_SOR);
            for (const x of hakims) {
              if (!aktif(PG) || kas < 1) break;
              const v = await askAngka(PG.seat, 'isi_langsung', `🤝 Berapa yang kamu serahkan langsung ke ${name(x.seat)} (tarif ${cur.x.tarif[x.seat]})?`,
                0, kas, mauSuap ? cur.x.tarif[x.seat] : 0, `Kas klien ${kas}`);
              if (v > 0) { kas -= v; dikirim += v; cur.x.terima[x.seat] = v; }
            }
          } else {
            pilih = await ask(PG.seat, { kind: 'amplop', text: `✉️ Hakim menolak bertemu. Kas klien ${kas}. Lalu?`, options: [
              { id: 'panitera', label: '✉️ Amplop lewat Panitera', sub: quote !== null ? `Panitera bilang tarifnya ${quote}` : 'Panitera tidak hadir', disabled: !rutePn },
              { id: 'tidak', label: '🙅 Tidak menyuap', sub: '' }] }, rutePn && mauSuap && quote <= kas - 1 ? 'panitera' : 'tidak');
          }
        }
        if (pilih === 'panitera') {
          const bot = mauSuap ? Math.min(quote, kas - 1) : 0;
          const isi = await askAngka(PG.seat, 'isi', `✉️ Berapa isi amplop untuk Panitera? (Panitera bilang tarifnya ${quote})`, 0, kas, bot, `Kas klien ${kas}. Sisa kas = komisimu kalau berhasil.`);
          if (isi > 0) {
            kas -= isi; dikirim = isi; cur.route = 'panitera'; rantai.add(PN);
            note(PG.seat, `✉️ Kamu mengirim amplop berisi ${isi} lewat Panitera.`);
            const tarifOk = semuaMinta ? tarifTotal : 0;
            const potong = await askAngka(PN.seat, 'potong', `✉️ Amplop berisi ${isi} ada di tanganmu (tarif hakim ${tarifTotal}). Berapa yang kamu ambil sebelum diteruskan?`,
              0, isi, tarifOk ? Math.max(0, isi - tarifOk) : 0, 'Hakim hanya melihat sisanya. Kalau amplop dikembalikan, Pengacara tahu selisihnya.');
            PN.rp += potong; cur.x.potong = potong; st('ongkos_panitera', potong);
            note(PN.seat, `✉️ Kamu mengambil ${potong} dari amplop.`);
            let sisa = isi - potong;
            if (hakims.length > 1 && sisa > 0) {
              const tk = cur.x.tarif[H.seat] || 0, ta = cur.x.tarif[A.seat] || 0;
              const bot2 = tk + ta ? Math.round((sisa * tk) / (tk + ta)) : sisa;
              const k = await askAngka(PN.seat, 'bagi', `✉️ Sisa ${sisa}. Berapa untuk Hakim Ketua ${name(H.seat)} (minta ${tk})? Sisanya untuk Hakim Anggota ${name(A.seat)} (minta ${ta}).`,
                0, sisa, bot2, 'Tiap hakim hanya melihat bagiannya.');
              cur.x.terima[H.seat] = k; cur.x.terima[A.seat] = sisa - k;
            } else if (hakims.length) cur.x.terima[hakims[0].seat] = sisa;
          } else pilih = 'tidak';
        }
        if (dikirim > 0) {
          rantai.add(PG); cur.amplop = true; st('suap_dikirim', dikirim);
          if (cur.route === 'panitera') log(`✉️ ${name(PG.seat)} menyerahkan sebuah amplop ke ${name(PN.seat)}.`);
          await ev('amplop', { route: cur.route });
        } else log(`🙅 ${name(PG.seat)} tidak mengirim amplop.`);
        syncKas();

        // --- Uang Damai ---
        if (R.hadir && kas > 0) {
          const bot = cur.amplop && kas >= 2 && (R.viral || cur.sp >= 3)
            ? Math.min(kas - (kas > C.MAKELAR + 2 ? C.MAKELAR : 0), Math.max(2, Math.round(dana * C.DAMAI_TAWAR))) : 0;
          const d = await askAngka(PG.seat, 'damai', `🤝 Tawarkan Uang Damai ke Keluarga Korban? Tawaran ini terbuka untuk semua. 0 = tidak menawarkan.`,
            0, kas, bot >= 2 ? bot : 0, `Kas klien ${kas}. Damai: Sorotan Perkara −2 dan korban kehilangan Keadilan.`);
          if (d > 0) { cur.damai = d; log(`🤝 ${name(PG.seat)} menawarkan Uang Damai ${d} ke ${name(R.seat)}.`); await ev('damai', { jumlah: d }); }
        }
      }

      // --- Respons Keluarga Korban ---
      let viralMain = 0;
      if (R.hadir) {
        const s = strat[R.seat], d = cur.damai || 0;
        let bot = 'kawal';
        if (d >= 2 && (s === 'damai' || (s === 'campur' && (d >= 4 || !R.viral)))) bot = 'damai';
        else {
          const n = Math.min(R.viral, s === 'damai' ? 1 : C.VIRAL_PER_MAIN);
          if (n && (cur.amplop || s === 'keadilan')) bot = 'viral' + n;
        }
        const c = await ask(R.seat, { kind: 'respons', text: `🕯️ Perkara ${card.nama}. Sorotan Perkara ${cur.sp}. Apa yang kamu lakukan?`, options: [
          { id: 'damai', label: `🤝 Terima Uang Damai ${d || ''}`, sub: 'Fulus bertambah, tapi tidak ada Keadilan di perkara ini · Sorotan Perkara −2', disabled: !d },
          { id: 'viral1', label: '📹 Viralkan (1 kartu)', sub: `Sorotan Perkara +${C.VIRAL_SP} · dadu Pasal Karet 1–${S.f.karet} = Lapas`, disabled: R.viral < 1 },
          { id: 'viral2', label: '📹📹 Viralkan (2 kartu)', sub: `Sorotan Perkara +${2 * C.VIRAL_SP} · dadu Pasal Karet 2×`, disabled: R.viral < 2 },
          { id: 'kawal', label: '👀 Kawal Sidang', sub: `Sorotan Perkara +${C.KAWAL_SP} · ambil 1 Kartu Viral (maks. ${C.VIRAL_MAX})` }] }, bot);
        cur.respons = c;
        if (c === 'damai') {
          kas -= d; R.rp += d; cur.sp = Math.max(0, cur.sp + C.DAMAI_SP); st('damai_diterima'); st('uang_damai', d);
          log(`🤝 ${name(R.seat)} menerima Uang Damai ${d}. Perkara jadi sepi.`);
          await ev('respons', { c });
        } else if (c === 'kawal') {
          cur.sp += C.KAWAL_SP; R.viral = Math.min(C.VIRAL_MAX, R.viral + 1); st('kawal_sidang');
          log(`👀 ${name(R.seat)} mengawal sidang. Sorotan Perkara ${cur.sp}.`);
          await ev('respons', { c });
        } else {
          viralMain = c === 'viral2' ? 2 : 1;
          R.viral -= viralMain; cur.sp += C.VIRAL_SP * viralMain; st('viral', viralMain);
          log(`📹 ${name(R.seat)} memviralkan perkara ini! Sorotan Perkara ${cur.sp}.`);
          await ev('respons', { c });
          if (aktif(PN) && PN.siasat.includes('tercecer')) {
            const t2 = await yesNo(PN.seat, 'tercecer', `🗂️ Pakai Berkas Tercecer? Sorotan Perkara −${C.TERCECER_SP} (sekali per game).`,
              ['🗂️ Pakai', 'Sebagian bukti "hilang"'], ['Simpan', ''], rantai.has(PN) && cur.sp >= 5);
            if (t2 === 'ya') {
              PN.siasat.splice(PN.siasat.indexOf('tercecer'), 1); cur.sp -= C.TERCECER_SP; st('siasat_tercecer');
              log(`🗂️ Sebagian berkas bukti "tercecer". Sorotan Perkara ${cur.sp}.`); await ev('siasat', { seat: PN.seat, id: 'tercecer' });
            }
          }
          for (let i = 0; i < viralMain; i++) {
            const dd = d6(script.karet);
            await ev('karet', { seat: R.seat, d: dd });
            if (dd <= S.f.karet) {
              R.viral = Math.min(C.VIRAL_MAX, R.viral + 1);
              if (R.kebalAt === S.t) {
                log(`⚖️ Dadu Pasal Karet ${dd}: ${name(R.seat)} dilaporkan balik, tapi baru keluar Lapas, jadi laporannya mandek. Simpati Publik: +1 Kartu Viral.`);
                break;
              }
              R.lapas = 1; st('lapas_pasal_karet');
              log(`⚖️ Dadu Pasal Karet ${dd}: ${name(R.seat)} dilaporkan balik (UU ITE). Absen perkara berikutnya. Simpati Publik: +1 Kartu Viral.`);
              await ev('lapas', { seat: R.seat, sebab: 'pasal_karet' });
              break;
            }
            log(`Dadu Pasal Karet ${dd}: aman.`);
          }
        }
        syncKas();
      }

      // --- Hakim: simpan / kembalikan amplop ---
      const simpan = [];
      for (const x of hakims) {
        const v = cur.x.terima[x.seat] || 0;
        if (!v) continue;
        const tf = cur.x.tarif[x.seat] || 0, s = strat[x.seat];
        const bot = tf > 0 && v >= (C.TERIMA[s] || 1) * tf && !(s === 'ambang' && x.sor >= 7 && !x.backing);
        const c = await yesNo(x.seat, 'simpan', `✉️ Amplop untukmu berisi ${v} (kamu meminta ${tf}). Simpan?`,
          ['💰 Simpan', 'Kamu masuk rantai suap'], ['↩️ Kembalikan', 'Isinya kembali ke Pengacara, dan ia melihat jumlahnya'], bot);
        if (c === 'ya') {
          x.rp += v; simpan.push(x); rantai.add(x); cur.status[x.seat] = 'simpan';
          note(x.seat, `💰 Kamu menyimpan amplop berisi ${v}.`);
        } else {
          kas += v; cur.status[x.seat] = 'kembali'; st('amplop_dikembalikan');
          note(PG.seat, `↩️ ${name(x.seat)} mengembalikan amplop berisi ${v}.${cur.route === 'panitera' && hakims.length === 1 && v < dikirim ? ` Kamu mengirim ${dikirim}: Panitera mengambil ${dikirim - v}!` : ''}`);
          if (cur.route === 'panitera' && hakims.length === 1 && v < dikirim) { PG.tahuOngkos = true; st('ongkos_ketahuan'); }
          log(`↩️ ${name(x.seat)} mengembalikan amplop.`);
        }
        await ev('simpan', { seat: x.seat, simpan: c === 'ya' });
        if (c === 'ya' && x.siasat.includes('sakit')) {
          const sk = await yesNo(x.seat, 'sakit', `🤒 Pakai Sakit Mendadak? Sidang ditunda, Sorotan Perkara −${C.SAKIT_SP} (sekali per game). Sekarang ${cur.sp}.`,
            ['🤒 Pakai', ''], ['Simpan', ''], cur.sp >= 5);
          if (sk === 'ya') {
            x.siasat.splice(x.siasat.indexOf('sakit'), 1); cur.sp -= C.SAKIT_SP; st('siasat_sakit');
            log(`🤒 ${name(x.seat)} mendadak sakit. Sidang ditunda, publik mulai lupa. Sorotan Perkara ${cur.sp}.`); await ev('siasat', { seat: x.seat, id: 'sakit' });
          }
        }
      }
      syncKas();

      // --- Putusan ---
      const ambangKasasi = (card.jenis === 'anak' ? C.KASASI_ANAK : C.KASASI_MIN) + S.f.kasasiMin;
      for (const x of hakims) {
        let bot = adil;
        if (simpan.includes(x)) {
          const akhir = cur.sp + C.MARAH;
          const pasti = akhir >= ambangKasasi && (akhir >= C.MAKELAR_KEBAL || kas < C.MAKELAR);
          bot = pasti && x.sor + C.JANGGAL_SOR + C.JANGGAL_SOR_VIRAL + C.KASASI_SOR >= 10 && !x.backing ? adil : target;
        }
        cur.votes[x.seat] = await ask(x.seat, { kind: 'putusan', text: `🔨 Putusanmu untuk ${card.nama}? Sorotan Perkara ${cur.sp}; kasasi terjadi kalau ≥ ${ambangKasasi} setelah publik marah (+${C.MARAH}).`,
          options: opsiVonis(adil, target) }, bot);
      }
      const votes = hakimAll.map((x) => (aktif(x) ? cur.votes[x.seat] : adil)).concat(A ? [adil] : []);
      let vonis;
      if (votes.length === 1) vonis = votes[0];
      else { const cnt = [0, 0, 0]; votes.forEach((v) => cnt[v]++); const m = cnt.findIndex((c) => c * 2 > votes.length); vonis = m >= 0 ? m : RINGAN; }
      cur.vonis = vonis;
      log(`🔨 Putusan: ${VONIS[vonis]}${vonis === adil ? ' (adil)' : ' (JANGGAL)'}.`);
      await ev('putusan', { vonis, adil });

      // --- Ingkar & Bocorkan ---
      for (const x of simpan) {
        if (tercapai(target, cur.votes[x.seat])) continue;
        st('ingkar');
        if (!aktif(PG) || !rantai.has(PG)) continue;
        const b = await yesNo(PG.seat, 'bocor', `😡 ${name(x.seat)} menyimpan amplop tapi memutus tidak sesuai klien (Ingkar). Bocorkan?`,
          ['📣 Bocorkan', `Sorotan ${name(x.seat)} dan kamu masing-masing +${C.BOCOR_SOR}`], ['Diam', ''], true);
        if (b === 'ya') {
          st('bocorkan'); log(`📣 ${name(PG.seat)} membocorkan bahwa ${name(x.seat)} menerima amplop!`); await ev('bocor', { seat: x.seat });
          await sorot(x, C.BOCOR_SOR); await sorot(PG, C.BOCOR_SOR);
        }
      }

      // --- Putusan Janggal & kasasi ---
      const rantaiArr = [...rantai];
      if (vonis !== adil) {
        if (!S.f.janggalNol) for (const x of rantaiArr) await sorot(x, C.JANGGAL_SOR + (cur.sp >= C.JANGGAL_SP_MIN ? C.JANGGAL_SOR_VIRAL : 0));
        for (const x of hakims) if (cur.votes[x.seat] === vonis) x.citra -= C.CITRA_JANGGAL + (vonis === BEBAS && cur.sp >= C.JANGGAL_SP_MIN ? C.CITRA_BEBAS_VIRAL : 0);
        cur.sp += C.MARAH;
        log(`😠 Publik marah atas putusan janggal. Sorotan Perkara ${cur.sp}.`);
        if (cur.sp >= ambangKasasi) {
          let blok = false;
          if (!S.f.makelarMati && cur.sp < C.MAKELAR_KEBAL && aktif(PG) && kas >= C.MAKELAR) {
            blok = (await yesNo(PG.seat, 'makelar', `🏛️ Kasasi mengancam (Sorotan Perkara ${cur.sp} ≥ ${ambangKasasi}). Bayar Makelar MA ${C.MAKELAR} dari kas klien untuk memblokir?`,
              [`💰 Bayar ${C.MAKELAR}`, `Kas klien ${kas} → ${kas - C.MAKELAR}`], ['Biarkan', 'Kasasi terjadi, putusan dibalik'], true)) === 'ya';
          }
          if (blok) {
            kas -= C.MAKELAR; PG.makelar = true; st('kasasi_diblokir');
            log(`🏛️ Kasasi "diurus" Makelar MA. Putusan ${VONIS[vonis]} bertahan.`); await ev('makelar', {});
          } else {
            cur.kasasi = true; vonis = adil; cur.vonis = adil; st('kasasi');
            R.viral = Math.min(C.VIRAL_MAX, R.viral + 1);
            log(`⚖️ KASASI! Putusan dibalik jadi ${VONIS[adil]}. Semua anggota rantai Sorotan +${C.KASASI_SOR}.`);
            await ev('kasasi', {});
            for (const x of rantaiArr) await sorot(x, C.KASASI_SOR);
            for (const x of hakims) if (rantai.has(x)) x.citra -= C.KASASI_CITRA;
          }
        }
      }
      if (vonis === adil) {
        st('vonis_adil');
        if (!cur.kasasi) for (const x of hakims) if (cur.votes[x.seat] === adil) x.citra += C.CITRA_ADIL;
        if (cur.respons !== 'damai') {
          const k = card.nilai + (cur.kasasi ? C.KASASI_KEADILAN : 0);
          R.keadilan += k; log(`🕯️ Keadilan untuk korban: ${name(R.seat)} Keadilan +${k}.`);
        }
        S.beratKaya.push(t);
      } else st('vonis_dibeli');
      syncKas();

      // --- komisi ---
      if (aktif(PG)) {
        const k = tercapai(target, vonis) ? kas : target === BEBAS && vonis === RINGAN ? Math.floor(kas / 2) : 0;
        PG.rp += k;
        note(PG.seat, k ? `💼 Komisi: ${k} dari sisa kas klien ${kas}.` : `💼 Klien kalah. Sisa kas ${kas} kembali ke klien.`);
      }

      // --- PK Diskon ---
      const pkLama = S.beratKaya.filter((x) => x !== t);
      if (aktif(PG) && PG.siasat.includes('pk') && pkLama.length && PG.rp >= C.PK && aktif(H)) {
        const c = await yesNo(PG.seat, 'pk', `📜 Pakai PK Diskon? Bayar ${C.PK} Fulus ke ${name(H.seat)}: satu vonis Berat lama jadi Ringan, kamu dapat ½ Dana Klien lama.`,
          ['📜 Ajukan PK', 'Keluarga Korban −1 Keadilan'], ['Tidak', ''], true);
        if (c === 'ya') {
          const ok = await yesNo(H.seat, 'pk_terima', `📜 Pengacara mengajukan PK Diskon dengan "biaya" ${C.PK} untukmu. Kabulkan?`,
            [`✅ Kabulkan (+${C.PK})`, 'Sorotanmu +1'], ['❌ Tolak', ''], true);
          PG.siasat.splice(PG.siasat.indexOf('pk'), 1);
          if (ok === 'ya') {
            const bonus = Math.floor((S.danaLama[pkLama[0]] || 0) / 2);
            S.beratKaya.splice(S.beratKaya.indexOf(pkLama[0]), 1);
            PG.rp -= C.PK; H.rp += C.PK; PG.rp += bonus; R.keadilan = Math.max(0, R.keadilan - 1); st('pk');
            note(PG.seat, `📜 PK Diskon: bayar ${C.PK}, dapat ${bonus} dari klien lama.`); note(H.seat, `📜 Kamu menerima ${C.PK} dari PK Diskon.`);
            log(`📜 PK Diskon dikabulkan: vonis Berat perkara ${pkLama[0]} jadi Ringan. Keluarga Korban −1 Keadilan.`);
            await ev('pk', {}); await sorot(H, 1);
          } else log(`📜 PK Diskon ditolak ${name(H.seat)}.`);
        }
      }
      await akhirPerkara(t, [...rantai]);
    }

    // ---------- akhir perkara: Cepu, kelola (Beli Aset, Jumpa Pers, Naik Kelas) ----------
    async function akhirPerkara(t, rantai) {
      const last = t === S.putaran;
      const c = cepuSeat !== null ? P[cepuSeat] : null;
      if (c && !c.jc && rantai.includes(c) && c.hadir) {
        const k = await yesNo(c.seat, 'kedok', `🕵️ Kamu Cepu. Buka kedok sekarang? Semua anggota rantai perkara ini Sorotan +${C.CEPU_SOR}; kamu jadi Justice Collaborator (Sorotan 0, +${C.CEPU_BONUS} Aset) dan keluar dari rantai.`,
          ['🕵️ Buka kedok', 'Sebelum mereka sempat mengamankan Fulus jadi Aset'], ['Tunggu dulu', ''], t >= S.putaran - 1 || c.sor >= 8);
        if (k === 'ya') {
          c.jc = true; c.sor = 0; c.aset += C.CEPU_BONUS; R.keadilan += 1; st('cepu_bongkar');
          log(`🕵️ ${name(c.seat)} ternyata CEPU! Rantai suap perkara ini dibongkar.`);
          await ev('cepu', { seat: c.seat });
          for (const x of rantai) if (x !== c) await sorot(x, C.CEPU_SOR);
        }
      }
      for (const p of [H, A, PN, PG, R]) {
        if (!p || stopped) continue;
        for (let guard = 0; guard < 6; guard++) {
          const s = strat[p.seat];
          const bisaT = p.rp > 0 && p.role !== 'rakyat';
          const pamer = ['hakim', 'anggota', 'panitera'].includes(p.role);
          const opsi = [];
          if (bisaT) opsi.push({ id: 'aset', label: `🏠 Beli Aset: ${p.rp} Fulus → Aset ${Math.floor(p.rp * (1 - C.FEE))}`,
            sub: `Potongan 20% · aman dari sitaan OTT${pamer ? ` · pamer harta: Sorotan +${S.f.antikorupsi ? 2 : 1}` : ''}` });
          if (p.siasat.includes('pers')) opsi.push({ id: 'pers', label: `🎤 Jumpa Pers (Citra +${C.CITRA_PERS})`, sub: `Sekali per game · Citra sekarang ${p.citra}, minimal ${C.CITRA_MIN}` });
          if (p.role === 'rakyat' && p.kelas < 2) opsi.push({ id: 'naik', label: `⬆️ Naik jadi ${KELAS[p.kelas + 1]} (${C.NAIK[p.kelas + 1]})`,
            sub: `Gaji ${C.GAJI_RAKYAT[p.kelas + 1]}/perkara · Nilai Usaha ${C.NILAI_USAHA[p.kelas + 1]}`, disabled: p.rp < C.NAIK[p.kelas + 1] });
          if (!opsi.some((o) => !o.disabled)) break;
          opsi.push({ id: 'selesai', label: '✅ Selesai', sub: bisaT ? 'Fulus di tangan tetap dihitung di akhir, tapi bisa disita kalau OTT' : '' });
          let bot = 'selesai';
          if (p.siasat.includes('pers') && (p.citra < C.CITRA_MIN + 1 || last)) bot = 'pers';
          else if (p.role === 'rakyat' && p.kelas < 2 && p.rp >= C.NAIK[p.kelas + 1] && (s !== 'keadilan' || t >= 3)) bot = 'naik';
          else if (bisaT && !last && ((p.rp >= C.ASET_BOT_RP && p.sor >= C.ASET_BOT_SOR) || (p.sor >= 7 && p.rp >= 2)) && !(pamer && p.sor >= 9)) bot = 'aset';
          const ch = await ask(p.seat, { kind: 'kelola', text: `🏦 Akhir perkara ${t}${last ? ' (terakhir)' : ''}. Fulus di tanganmu ${p.rp}.`, options: opsi }, bot);
          if (ch === 'selesai') break;
          if (ch === 'aset') await beliAset(p);
          else if (ch === 'pers') { p.siasat.splice(p.siasat.indexOf('pers'), 1); p.citra += C.CITRA_PERS; log(`🎤 ${name(p.seat)} menggelar jumpa pers. Citra +${C.CITRA_PERS}.`); await ev('siasat', { seat: p.seat, id: 'pers' }); }
          else if (ch === 'naik') {
            p.rp -= C.NAIK[p.kelas + 1]; p.kelas++;
            log(`⬆️ ${name(p.seat)} naik kelas jadi ${KELAS[p.kelas]}.`); await ev('naik', { seat: p.seat, kelas: p.kelas });
          }
        }
      }
      S.turn = null;
    }

    // ---------- loop utama ----------
    async function run() {
      for (let t = 1; t <= S.putaran && !stopped; t++) {
        S.t = t; update();
        await perkara(t);
        if (S.cur) S.danaLama[t] = S.cur.dana;
        if (opts.stopAfterTurn && opts.stopAfterTurn(S, null)) { stopped = true; break; }
      }
      if (stopped) { S.phase = 'stopped'; S.prompt = null; update(); return S; }
      S.turn = null;
      const menang = n5 ? C.KEADILAN_5P : C.KEADILAN_MENANG;
      // Kekayaan = Fulus + Aset (oknum; Hakim dimutasi ×0,7) / Fulus + Nilai Usaha kelas (+ Santunan kalau juara Keadilan)
      const skor = P.filter((p) => p.role !== 'rakyat').map((p) => {
        const mutasi = (p.role === 'hakim' || p.role === 'anggota') && p.citra < C.CITRA_MIN;
        if (mutasi) st('hakim_dimutasi');
        const kotor = p.rp + p.aset;
        return { seat: p.seat, role: p.role, rp: p.rp, aset: p.aset, kekayaan: mutasi ? Math.floor(kotor * C.MUTASI) : kotor, mutasi, citra: p.citra, cepu: p.seat === cepuSeat };
      });
      const juaraK = R.keadilan >= menang, santunan = n5 ? C.SANTUNAN_5P : C.SANTUNAN;
      const r = { seat: R.seat, role: 'rakyat', keadilan: R.keadilan, kelas: R.kelas, rp: R.rp, usaha: C.NILAI_USAHA[R.kelas], santunan: juaraK ? santunan : 0,
        juaraKeadilan: juaraK, kekayaan: R.rp + C.NILAI_USAHA[R.kelas] + (juaraK ? santunan : 0), gagal: R.kelas < 2 };
      skor.push(r);
      skor.forEach((x) => { x.name = name(x.seat); x.tie = rng(); });
      skor.sort((a, b) => ((b.juaraKeadilan ? 1 : 0) - (a.juaraKeadilan ? 1 : 0)) || (b.kekayaan - a.kekayaan) || (b.tie - a.tie));
      Dompet().konversi(skor, C.KURS);
      S.result = { ranking: skor, winner: skor[0].seat, cepu: cepuSeat, strat, keadilanMenang: menang, uang: C.UANG, kurs: C.KURS };
      S.phase = 'end';
      log(`🏁 Permainan selesai. Juara: ${skor[0].name} (${ROLES[skor[0].role][1]})${r.juaraKeadilan ? ' lewat Keadilan!' : '.'}`);
      await ev('end', {});
      return S;
    }
    function stop() { stopped = true; if (pending) pending.res(S.prompt ? S.prompt.bot : null); }

    return { S, run, answer, setBot, stop };
  }

  const api = { C, VONIS, ROLE_OF, ROLES, KELAS, TERDAKWA, TARGET, ADIL, PERKARA, KABAR, SIASAT, STRATS, createGame, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MejaHijau = api;
})(typeof window !== 'undefined' ? window : globalThis);
