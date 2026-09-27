// node prototype/check.js — cek engine: (1) keseimbangan match bot, (2) semua kursi "manusia" acak tidak macet, (3) 5 bab tutorial,
// (4) uji fokus Perlindungan Korban (Oknum selalu menarget Rakyat yang sama), (5) estimasi durasi 15–20 menit.
const assert = require('assert');
const JT = require('./engine.js');
const tutorial = require('./tutorial.js');
const { estimasi } = require('./durasi.js');

async function botGames(n) {
  const wins = { oknum: 0, rakyat: 0 }, seat = [0, 0, 0, 0];
  let pengusaha = 0;
  for (let i = 0; i < n; i++) {
    const players = [0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: true }));
    const g = JT.createGame(players, { strict: true, rng: JT.mulberry32(i + 1) });
    const S = await g.run();
    wins[S.result.winner === 0 ? 'oknum' : 'rakyat']++; seat[S.result.winner]++;
    pengusaha += S.rs.filter((r) => r.kelas === 3).length;
  }
  return { oknum: wins.oknum / n, pengusaha: pengusaha / (3 * n), seat: seat.map((x) => Math.round((100 * x) / n)) };
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

// Uji fokus: Oknum (dikendalikan skrip) selalu menarget kursi 1 (Rekayasa, Operasi Senyap, Penghasutan) kalau bisa.
async function fokus(n, lindung) {
  const simpan = JT.C.LINDUNG; JT.C.LINDUNG = lindung;
  let menang = 0;
  for (let i = 0; i < n; i++) {
    let g, answered = 0;
    g = JT.createGame([0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: s !== 0 })), {
      rng: JT.mulberry32(9000 + i),
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        const ok = (id) => p.options.some((o) => o.id === id && !o.disabled);
        let c = p.bot;
        if (p.kind === 'aksi' && ok('rekayasa') && S.t >= 2) c = 'rekayasa';
        if ((p.kind === 'target' || p.kind === 'penghasutan') && ok(1)) c = 1;
        setImmediate(() => g.answer(p.seat, p.id, c));
      },
    });
    const S = await g.run();
    if (S.result.winner === 1) menang++;
  }
  JT.C.LINDUNG = simpan;
  return Math.round((100 * menang) / n);
}

let selesai = false;
process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });

(async () => {
  const b = await botGames(3000);
  console.log(`3000 match bot: juara per kursi Oknum/R1/R2/R3 = ${b.seat.join('/')}% (target ±25% masing-masing), Rakyat jadi Pengusaha ${(b.pengusaha * 100).toFixed(0)}%`);
  assert(b.seat.every((x) => x >= 18 && x <= 32), 'Peluang juara tidak seimbang');

  const kinds = await randomHumans(300);
  console.log(`300 match semua kursi manusia (jawaban acak): selesai tanpa macet. Jenis prompt teruji: ${[...kinds].sort().join(', ')}`);

  const fOn = await fokus(1000, true), fOff = await fokus(1000, false);
  console.log(`Uji fokus (Oknum selalu menarget Rakyat kursi 1): kursi 1 juara ${fOn}% dengan Perlindungan Korban, ${fOff}% tanpa (normal ${b.seat[1]}%)`);
  assert(fOn >= 0.7 * b.seat[1], 'Rakyat terlalu terhukum saat dikeroyok');

  const kursi = (n, human) => [0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: !human(s) }));
  const d = await estimasi(JT, kursi, { n: 10 });
  console.log(`Estimasi durasi 4 manusia online: ${d.menit} menit (${d.prompt} keputusan, jeda ${d.jedaMenit} menit)`);
  assert(d.menit >= 15 && d.menit <= 20, 'durasi di luar 15–20 menit');
  const solo = await estimasi(JT, kursi, { n: 10, manusia: 1 });
  console.log(`Estimasi durasi latihan 1 manusia vs bot (Rakyat): ${solo.menit} menit`);

  for (const ch of tutorial.CHAPTERS) {
    const r = await tutorial.autoplay(ch, JT);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  selesai = true;
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
