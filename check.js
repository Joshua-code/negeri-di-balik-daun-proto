// node prototype/check.js — cek port engine: (1) match bot vs hasil simulasi Python, (2) semua kursi "manusia" acak tidak macet.
const assert = require('assert');
const JT = require('./engine.js');
const tutorial = require('./tutorial.js');

async function botGames(n) {
  const wins = { oknum: 0, rakyat: 0 };
  let pengusaha = 0;
  for (let i = 0; i < n; i++) {
    const players = [0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: true }));
    const g = JT.createGame(players, { strict: true, rng: JT.mulberry32(i + 1) });
    const S = await g.run();
    wins[S.result.winner === 0 ? 'oknum' : 'rakyat']++;
    pengusaha += S.rs.filter((r) => r.kelas === 3).length;
  }
  return { oknum: wins.oknum / n, pengusaha: pengusaha / (3 * n) };
}

async function randomHumans(n) {
  const kinds = new Set();
  for (let i = 0; i < n; i++) {
    const rng = JT.mulberry32(1000 + i);
    const players = [0, 1, 2, 3].map((s) => ({ name: 'H' + s, bot: false }));
    let g, answered = 0;
    g = JT.createGame(players, {
      rng,
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        kinds.add(p.kind);
        setImmediate(() => {
          let c;
          if (p.kind === 'pos') {
            const t = p.tiles.slice(); c = [];
            while (c.length < Math.min(p.pick, t.length)) c.push(t.splice(Math.floor(rng() * t.length), 1)[0]);
          } else {
            const ok = p.options.filter((x) => !x.disabled);
            assert(ok.length, 'prompt tanpa opsi aktif: ' + p.kind);
            c = ok[Math.floor(rng() * ok.length)].id;
          }
          assert(g.answer(p.seat, p.id, c), 'jawaban valid ditolak: ' + p.kind);
        });
      },
    });
    const S = await g.run();
    assert.strictEqual(S.phase, 'end');
  }
  return kinds;
}

(async () => {
  const b = await botGames(3000);
  console.log(`3000 match bot: Oknum juara ${(b.oknum * 100).toFixed(0)}% (sim Python 36%), Rakyat jadi Pengusaha ${(b.pengusaha * 100).toFixed(0)}% (sim 70–76%)`);
  assert(b.oknum >= 0.25 && b.oknum <= 0.5, 'Oknum juara di luar 25–50%');

  const kinds = await randomHumans(300);
  console.log(`300 match semua kursi manusia (jawaban acak): selesai tanpa macet. Jenis prompt teruji: ${[...kinds].sort().join(', ')}`);

  for (const ch of tutorial.CHAPTERS) {
    const r = await tutorial.autoplay(ch, JT);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
