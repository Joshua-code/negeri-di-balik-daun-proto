// node prototype/mh-check.js — cek engine Meja Hijau: (1) keseimbangan match bot vs tools/sim_meja_hijau.py, (2) semua kursi "manusia" acak tidak macet
// (4 & 5 pemain) + Perlindungan Korban (maks 1 OTT per pemain per perkara), (3) estimasi durasi 15–20 menit, (4) 3 bab tutorial.
const assert = require('assert');
const MH = require('./mh-engine.js');
const tutorial = require('./tutorial.js');
const { CHAPTERS } = require('./mh-tutorial.js');
const { estimasi } = require('./durasi.js');
const NEGO_DETIK = 45;   // rata-rata pemakaian jendela negosiasi online (maks 60 detik, selesai lebih cepat kalau semua Siap)

const pemain = (n, bot) => Array.from({ length: n }, (_, s) => ({ name: 'P' + s, bot }));
// target peluang juara per role (docs/05 §12.1, versi Kekayaan + Dana Offshore 27 Sep 2026). Hakim Anggota memang lebih lemah (majelis butuh dua hakim).
const SIM = { 4: { hakim: 25, panitera: 25, pengacara: 24, rakyat: 26 }, 5: { hakim: 21, anggota: 14, panitera: 20, pengacara: 23, rakyat: 22 } };

async function botGames(n, N) {
  const win = {}, dana = {};
  for (let i = 0; i < N; i++) {
    const g = MH.createGame(pemain(n, true), { strict: true, rng: MH.mulberry32(i + 1) });
    const S = await g.run();
    const r = S.result.ranking[0].role; win[r] = (win[r] || 0) + 1;
    for (const x of S.result.ranking) {
      assert(Number.isInteger(x.kekayaan) && x.kekayaan >= 0 && x.dana >= 0, 'Kekayaan/Dana tidak valid');
      dana[x.role] = (dana[x.role] || 0) + x.dana;
    }
  }
  const roles = Object.keys(SIM[n]);
  return { win: Object.fromEntries(roles.map((r) => [r, Math.round((100 * (win[r] || 0)) / N)])), dana: Object.fromEntries(roles.map((r) => [r, Math.round(dana[r] / N)])) };
}

async function randomHumans(n, N) {
  const kinds = new Set();
  for (let i = 0; i < N; i++) {
    const rng = MH.mulberry32(1000 + i);
    let g, answered = 0;
    const ottDi = new Set();
    g = MH.createGame(pemain(n, false), {
      rng,
      onEvent(e) {
        if (e.type !== 'ott') return;
        const k = e.t + ':' + e.seat;
        assert(!ottDi.has(k), 'Perlindungan Korban gagal: OTT kedua di perkara yang sama');
        ottDi.add(k);
      },
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        kinds.add(p.kind);
        setImmediate(() => {
          const ok = p.options.filter((x) => !x.disabled);
          assert(ok.length, 'prompt tanpa opsi aktif: ' + p.kind);
          assert(g.answer(p.seat, p.id, ok[Math.floor(rng() * ok.length)].id), 'jawaban valid ditolak: ' + p.kind);
        });
      },
    });
    const S = await g.run();
    assert.strictEqual(S.phase, 'end');
    assert(S.p.every((p) => Number.isFinite(p.rp) && p.rp >= 0 && p.aset >= 0), 'Fulus/Aset negatif');
  }
  return kinds;
}

let selesai = false;
process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });

(async () => {
  for (const n of [4, 5]) {
    const { win: b, dana } = await botGames(n, 3000);
    console.log(`3000 match bot ${n} pemain: juara ${Object.entries(b).map(([k, v]) => `${k} ${v}% (target ${SIM[n][k]}%)`).join(' · ')}`);
    for (const k in b) assert(Math.abs(b[k] - SIM[n][k]) <= 6, `${n}p: ${k} menyimpang dari target`);
    const rata = Object.values(dana).reduce((s, x) => s + x, 0) / Object.keys(dana).length;
    console.log(`  Dana Offshore rata-rata (Online, kurs ${MH.C.KURS}): ${Object.entries(dana).map(([k, v]) => `${k} ${v}`).join(' · ')} (rata-rata ${Math.round(rata)}, target ±100)`);
    for (const k in dana) assert(Math.abs(dana[k] - rata) <= 0.2 * rata, `${n}p: Dana ${k} timpang > ±20%`);
    assert(rata >= 80 && rata <= 120, 'Kurs perlu dikalibrasi ulang (rata-rata Dana di luar 80–120)');
  }
  for (const n of [4, 5]) {
    const kinds = await randomHumans(n, 300);
    console.log(`300 match ${n} kursi manusia (jawaban acak): selesai tanpa macet. Prompt teruji: ${[...kinds].sort().join(', ')}`);
  }
  const kursi = (n, human) => Array.from({ length: n }, (_, s) => ({ name: 'P' + s, bot: !human(s) }));
  for (const n of [4, 5]) {
    const d = await estimasi(MH, kursi, { jumlahKursi: n, negoDetik: NEGO_DETIK });
    console.log(`Estimasi durasi ${n} manusia online: ${d.menit} menit (${d.prompt} keputusan, jeda ${d.jedaMenit} menit, ${d.nego} jendela negosiasi)`);
    assert(d.menit >= 15 && d.menit <= 20, `${n} pemain: durasi di luar 15–20 menit`);
  }
  const solo = await estimasi(MH, kursi, { manusia: 0 });
  console.log(`Estimasi durasi latihan 1 manusia vs bot (Hakim): ${solo.menit} menit`);
  for (const ch of CHAPTERS) {
    const r = await tutorial.autoplay(ch, MH);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  selesai = true;
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
