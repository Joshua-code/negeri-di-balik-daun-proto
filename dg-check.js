// node prototype/dg-check.js — cek engine Dari Gerobak (docs/07):
// (1) keseimbangan strategi jujur/kolusi/pejabat + metrik busur emosi, (2) semua kursi manusia acak tidak macet,
// (3) uji fokus Perlindungan Korban, (4) privasi rencana, (5) estimasi durasi 25–35 menit, (6) Dana Offshore, (7) tutorial.
// `node prototype/dg-check.js --metrik '{"PROD":[...]}'` hanya mencetak metrik (untuk kalibrasi).
const assert = require('assert');
const DG = require('./dg-engine.js');

// rotasi strategi: tiap match 1 kursi pejabat, sisanya campuran jujur/kolusi; posisi kursi digeser
const STRAT_SET = [['jujur', 'jujur', 'kolusi', 'pejabat'], ['pejabat', 'jujur', 'jujur', 'kolusi'], ['kolusi', 'pejabat', 'jujur', 'jujur'], ['jujur', 'kolusi', 'pejabat', 'jujur'],
  ['kolusi', 'kolusi', 'jujur', 'pejabat'], ['pejabat', 'kolusi', 'kolusi', 'jujur'], ['jujur', 'pejabat', 'kolusi', 'kolusi'], ['kolusi', 'jujur', 'pejabat', 'kolusi']];

async function metrik(n, over = {}) {
  const saved = JSON.parse(JSON.stringify(DG.C)); Object.assign(DG.C, over);
  const m = { win: {}, seats: {}, dana: {}, kaya: {}, mimpi3: {}, mimpiAny: {}, jumlah: {}, seatWin: [0, 0, 0, 0], toko: 0, gerobakAkhir: 0, rugi: 0, pinjol: 0, comeback: 0, comebackN: 0, pejabatJadi: 0, levelAkhir: 0, n };
  for (let i = 0; i < n; i++) {
    const strat = STRAT_SET[i % STRAT_SET.length];
    const g = DG.createGame([0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: true })), { strict: true, rng: DG.mulberry32(i + 1), script: { strat: Object.assign({}, strat) } });
    const S = await g.run();
    const R = S.result.ranking;
    m.seatWin[R[0].seat]++;
    const rankOf = Object.fromEntries(R.map((x, k) => [x.seat, k]));
    // pemain terakhir di bulan 6 → finis top-2?
    const b6 = S.p.slice().sort((a, b) => a.catat.kayaB6 - b.catat.kayaB6)[0];
    m.comebackN++; if (rankOf[b6.seat] <= 1) m.comeback++;
    for (const x of R) {
      const p = S.p[x.seat], s = strat[x.seat];
      m.jumlah[s] = (m.jumlah[s] || 0) + 1;
      if (x === R[0]) m.win[s] = (m.win[s] || 0) + 1;
      m.dana[s] = (m.dana[s] || 0) + x.dana; m.kaya[s] = (m.kaya[s] || 0) + x.kekayaan;
      if (x.mimpiTahap === 3) m.mimpi3[s] = (m.mimpi3[s] || 0) + 1;
      if (x.mimpiTahap >= 1) m.mimpiAny[s] = (m.mimpiAny[s] || 0) + 1;
      if (p.catat.tokoT !== null) m.toko++;
      if (p.catat.levelB6 === 0 && p.lots.every((i) => S.lots[i].level === 0)) m.gerobakAkhir++;
      m.rugi += p.catat.rugi; m.pinjol += p.catat.pinjol > 0 ? 1 : 0; m.levelAkhir += x.level;
      if (p.catat.pejabat) m.pejabatJadi++;
      assert(p.daun >= 0 && x.kekayaan >= 0 && x.dana >= 0, 'nilai negatif');
    }
  }
  Object.keys(saved).forEach((k) => { DG.C[k] = saved[k]; });
  const pemain = 4 * n, pct = (a, b) => Math.round((100 * a) / b);
  const per = (o) => Object.fromEntries(Object.keys(m.jumlah).map((s) => [s, Math.round((o[s] || 0) / m.jumlah[s])]));
  const perPct = (o) => Object.fromEntries(Object.keys(m.jumlah).map((s) => [s, pct(o[s] || 0, m.jumlah[s])]));
  return {
    menangPerKursi: perPct(m.win),   // % menang per kursi yang memakai strategi itu (seimbang = 25)
    seat: m.seatWin.map((x) => pct(x, n)), kekayaan: per(m.kaya), dana: per(m.dana), mimpiTuntas: perPct(m.mimpi3), mimpiMulai: perPct(m.mimpiAny),
    pernahToko: pct(m.toko, pemain), gerobakTerus: pct(m.gerobakAkhir, pemain), rugiPerPemain: +(m.rugi / pemain).toFixed(1),
    pernahPinjol: pct(m.pinjol, pemain), comeback: pct(m.comeback, m.comebackN), levelAkhir: +(m.levelAkhir / pemain).toFixed(1), pejabat: pct(m.pejabatJadi, n),
  };
}

async function randomHumans(n) {
  const kinds = new Set();
  for (let i = 0; i < n; i++) {
    const rng = DG.mulberry32(1000 + i);
    let g;
    const seen = new Set();
    g = DG.createGame([0, 1, 2, 3].map((s) => ({ name: 'H' + s, bot: false })), {
      rng,
      onUpdate(S) {
        for (const pr of Object.values(S.prompts)) {
          if (seen.has(pr.id)) continue;
          seen.add(pr.id); kinds.add(pr.kind);
          const delay = Math.floor(rng() * 3);
          setTimeout(() => {
            // jawaban basi harus ditolak
            assert(!g.answer(pr.seat, pr.id + 99999, pr.bot), 'id basi diterima');
            const ok = pr.options.filter((x) => !x.disabled).map((x) => x.id);
            let c;
            if (pr.pick) { const t = ok.slice(); c = []; while (c.length < Math.min(pr.pick, ok.length)) c.push(t.splice(Math.floor(rng() * t.length), 1)[0]); }
            else if (pr.multi) c = ok.filter(() => rng() < 0.5);
            else c = ok[Math.floor(rng() * ok.length)];
            if (i % 7 === 0 && rng() < 0.05) { g.setBot(pr.seat, true); return; }   // pemain keluar di tengah batch
            assert(g.answer(pr.seat, pr.id, c), 'jawaban valid ditolak: ' + pr.kind);
          }, delay);
        }
      },
    });
    const S = await g.run();
    assert.strictEqual(S.phase, 'end');
    assert(S.p.every((p) => p.daun >= 0 && p.utang >= 0), 'Daun negatif');
  }
  return kinds;
}

// Uji fokus: pejabat skrip + NPC selalu mengincar kursi 1.
async function fokus(n, lindung, incar = true) {
  const simpan = DG.C.LINDUNG; DG.C.LINDUNG = lindung;
  let menang = 0, maxPerBulan = 0, maxHit = 0;
  for (let i = 0; i < n; i++) {
    const per = {};
    const g = DG.createGame([0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: true })), {
      rng: DG.mulberry32(7000 + i),
      script: { strat: { 0: 'pejabat', 1: 'jujur', 2: 'kolusi', 3: 'jujur' }, ancaman: incar ? Array.from({ length: 60 }, () => ({ seat: 1 })) : [] },
      onEvent(e, S) {
        if (e.type === 'ancaman' && e.seat === 1 && !e.solidaritas) { per[e.t] = (per[e.t] || 0) + 1; maxPerBulan = Math.max(maxPerBulan, per[e.t]); }
      },
    });
    const S = await g.run();
    if (S.result.winner === 1) menang++;
  }
  DG.C.LINDUNG = simpan;
  return { menang: Math.round((100 * menang) / n), maxPerBulan };
}

async function privasi() {
  let dicek = 0;
  const g = DG.createGame([0, 1, 2, 3].map((s) => ({ name: 'H' + s, bot: s > 1 })), {
    rng: DG.mulberry32(5),
    onUpdate(S) {
      for (const pr of Object.values(S.prompts)) {
        const pub = JSON.stringify(DG.redactPublic(S));
        assert(!pub.includes('"prompts":{"') && pub.includes('"plan":{}'), 'state publik membocorkan prompt/rencana');
        if (pr.kind === 'rencana') { const lain = DG.privateFor(S, pr.seat === 0 ? 1 : 0); assert(!lain.prompt || lain.prompt.seat !== pr.seat); }
        dicek++;
        if (!pr._j) { pr._j = 1; setImmediate(() => g.answer(pr.seat, pr.id, pr.bot)); }
      }
    },
  });
  await g.run();
  return dicek;
}

// Durasi: jeda engine (onPace) + per batch prompt, waktu manusia terlama di batch itu + jendela negosiasi.
async function durasi(n, { manusia = [0, 1, 2, 3], negoDetik = 25 } = {}) {
  // rencana: membaca kabar + memilih 2 dari ±10 aksi; tagihan: menimbang keluarga vs usaha; ancaman: membaca kartu dilema
  const DETIK = { rencana: 20, tagihan: 12, solidaritas: 7 }, LAIN = 8;
  let total = 0;
  for (let i = 0; i < n; i++) {
    let jeda = 0, nego = 0;
    const batchMax = new Map(), seen = new Set();
    let g;
    g = DG.createGame([0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: !manusia.includes(s) })), {
      rng: DG.mulberry32(4242 + i), script: { strat: { 0: 'kolusi', 1: 'jujur', 2: 'pejabat', 3: 'kolusi' } },
      onPace(k) { jeda += k; },
      async onPhase(kind) { if (kind === 'nego' && manusia.length >= 2) nego++; },
      onUpdate(S) {
        for (const pr of Object.values(S.prompts)) {
          if (seen.has(pr.id)) continue; seen.add(pr.id);
          const d = DETIK[pr.kind] || (pr.options.filter((o) => !o.disabled).length > 1 ? LAIN : 2);
          batchMax.set(pr.batch, Math.max(batchMax.get(pr.batch) || 0, d));
          setImmediate(() => g.answer(pr.seat, pr.id, pr.bot));
        }
      },
    });
    await g.run();
    total += (jeda + [...batchMax.values()].reduce((s, x) => s + x, 0) + nego * negoDetik) / 60;
  }
  return +(total / n).toFixed(1);
}

module.exports = { metrik, durasi };

if (require.main === module) {
  let selesai = false;
  process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });
  (async () => {
    const iM = process.argv.indexOf('--metrik');
    if (iM > 0) {
      const over = process.argv[iM + 1] ? JSON.parse(process.argv[iM + 1]) : {};
      console.log(JSON.stringify(await metrik(+(process.env.N || 1200), over)));
      selesai = true; return;
    }
    const m = await metrik(3000);
    console.log('3000 match bot:', JSON.stringify(m));
    const W = m.menangPerKursi;
    assert(Object.values(W).every((x) => x >= 18 && x <= 34), 'strategi tidak seimbang (menang per kursi di luar 18–34%)');
    assert(m.seat.every((x) => x >= 20 && x <= 30), 'posisi kursi tidak seimbang');
    assert(m.mimpiTuntas.jujur >= m.mimpiTuntas.kolusi && m.mimpiTuntas.jujur >= m.mimpiTuntas.pejabat, 'yang jujur harus paling sering menuntaskan mimpi');
    assert(m.pernahToko >= 70, 'kurang dari 70% pemain pernah punya Toko');
    assert(m.gerobakTerus <= 5, 'terlalu banyak yang tetap gerobak');
    assert(m.rugiPerPemain >= 1 && m.rugiPerPemain <= 3, 'kejadian rugi per pemain di luar 1–3');
    assert(m.comeback >= 15, 'pemain terbawah di bulan 6 hampir tidak pernah bangkit');
    const rata = Object.values(m.dana).reduce((s, x) => s + x, 0) / Object.keys(m.dana).length;
    assert(rata >= 80 && rata <= 120, `kurs perlu dikalibrasi (rata-rata Dana ${Math.round(rata)})`);
    assert(Object.values(m.dana).every((x) => Math.abs(x - rata) <= 0.2 * rata), 'Dana per strategi timpang > ±20%');
    require('./dompet-check.js');

    const kinds = await randomHumans(300);
    console.log(`300 match semua kursi manusia (jawaban acak, urutan acak dalam batch): selesai. Prompt: ${[...kinds].sort().join(', ')}`);

    const on = await fokus(800, true), off = await fokus(800, false), normal = await fokus(800, true, false);
    console.log(`Uji fokus (pejabat & NPC mengincar kursi 1): menang ${on.menang}% dengan Perlindungan Korban (maks ${on.maxPerBulan} ancaman/bulan), ${off.menang}% tanpa (normal ${normal.menang}%)`);
    assert(on.maxPerBulan <= 1, 'lebih dari 1 ancaman per bulan pada korban');
    assert(on.menang >= 0.7 * normal.menang, 'korban yang dikeroyok terlalu terhukum');

    const dicek = await privasi();
    console.log(`Privasi: ${dicek} state publik dicek, tidak ada rencana/prompt yang bocor`);

    const d4 = await durasi(8), d1 = await durasi(8, { manusia: [1], negoDetik: 0 });
    console.log(`Estimasi durasi: 4 manusia online ${d4} menit · latihan 1 manusia ${d1} menit`);
    assert(d4 >= 25 && d4 <= 35, 'durasi online di luar 25–35 menit');
    assert(d1 >= 15 && d1 <= 28, 'durasi latihan di luar 15–28 menit');

    try {
      const tutorial = require('./tutorial.js'), { CHAPTERS } = require('./dg-tutorial.js');
      for (const ch of CHAPTERS) {
        const r = await tutorial.autoplay(ch, DG);
        console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')}`);
        for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
      }
    } catch (e) { if (e.code === 'MODULE_NOT_FOUND') console.log('(tutorial belum ada)'); else throw e; }
    selesai = true;
    console.log('OK');
  })().catch((e) => { console.error(e); process.exit(1); });
}
