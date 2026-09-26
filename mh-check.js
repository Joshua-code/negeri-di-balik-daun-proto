// node prototype/mh-check.js — cek engine Meja Hijau: (1) keseimbangan match bot vs tools/sim_meja_hijau.py, (2) semua kursi "manusia" acak tidak macet (4 & 5 pemain), (3) 3 bab tutorial.
const assert = require('assert');
const MH = require('./mh-engine.js');
const tutorial = require('./tutorial.js');
const { CHAPTERS } = require('./mh-tutorial.js');

const pemain = (n, bot) => Array.from({ length: n }, (_, s) => ({ name: 'P' + s, bot }));
// peluang juara per role di tools/sim_meja_hijau.py (docs/05 §12.1)
const SIM = { 4: { hakim: 22, panitera: 22, pengacara: 26, rakyat: 29 }, 5: { hakim: 24, anggota: 15, panitera: 20, pengacara: 19, rakyat: 22 } };

async function botGames(n, N) {
  const win = {};
  for (let i = 0; i < N; i++) {
    const g = MH.createGame(pemain(n, true), { strict: true, rng: MH.mulberry32(i + 1) });
    const S = await g.run();
    const r = S.result.ranking[0].role; win[r] = (win[r] || 0) + 1;
  }
  return Object.fromEntries(Object.keys(SIM[n]).map((r) => [r, Math.round((100 * (win[r] || 0)) / N)]));
}

async function randomHumans(n, N) {
  const kinds = new Set();
  for (let i = 0; i < N; i++) {
    const rng = MH.mulberry32(1000 + i);
    let g, answered = 0;
    g = MH.createGame(pemain(n, false), {
      rng,
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
    assert(S.p.every((p) => Number.isFinite(p.rp) && p.rp >= 0 && p.aman >= 0), 'Rupiah/Harta Aman negatif');
  }
  return kinds;
}

let selesai = false;
process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });

(async () => {
  for (const n of [4, 5]) {
    const b = await botGames(n, 3000);
    console.log(`3000 match bot ${n} pemain: juara ${Object.entries(b).map(([k, v]) => `${k} ${v}% (sim ${SIM[n][k]}%)`).join(' · ')}`);
    for (const k in b) assert(Math.abs(b[k] - SIM[n][k]) <= 6, `${n}p: ${k} menyimpang dari simulasi`);
  }
  for (const n of [4, 5]) {
    const kinds = await randomHumans(n, 300);
    console.log(`300 match ${n} kursi manusia (jawaban acak): selesai tanpa macet. Prompt teruji: ${[...kinds].sort().join(', ')}`);
  }
  for (const ch of CHAPTERS) {
    const r = await tutorial.autoplay(ch, MH);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  selesai = true;
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
