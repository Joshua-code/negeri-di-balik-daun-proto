// node prototype/gb-check.js — cek engine Gedung Bundar: (1) keseimbangan match bot, (2) semua kursi "manusia" acak tidak macet, (3) 5 bab tutorial.
const assert = require('assert');
const GB = require('./gb-engine.js');
const tutorial = require('./tutorial.js');
const { CHAPTERS } = require('./gb-tutorial.js');

const ROLES = ['jaksa', 'kong', 'bumn', 'umkm'];
const pemain = (bot) => ROLES.map((r, s) => ({ name: 'P' + s, bot, role: s ? r : undefined }));

async function botGames(n) {
  const win = Object.fromEntries(ROLES.map((r) => [r, 0]));
  let umkmNaik = 0;
  for (let i = 0; i < n; i++) {
    const g = GB.createGame(pemain(true), { strict: true, rng: GB.mulberry32(i + 1) });
    const S = await g.run();
    win[S.result.ranking[0].role]++;
    umkmNaik += S.ps.find((p) => p.role === 'umkm').pengusaha;
  }
  return { win: ROLES.map((r) => Math.round((100 * win[r]) / n)), umkmNaik: umkmNaik / n };
}

async function randomHumans(n) {
  const kinds = new Set();
  for (let i = 0; i < n; i++) {
    const rng = GB.mulberry32(1000 + i);
    let g, answered = 0;
    g = GB.createGame(pemain(false), {
      rng,
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        kinds.add(p.kind);
        setImmediate(() => {
          const ok = p.options.filter((x) => !x.disabled);
          assert(ok.length, 'prompt tanpa opsi aktif: ' + p.kind);
          // jangan terus-menerus "kembali"/setoran: acak tapi condong ke aksi nyata supaya match selesai
          const nyata = ok.filter((x) => x.id !== 'kembali' && x.id !== 'setoran');
          const pool = nyata.length && rng() < 0.9 ? nyata : ok;
          const c = pool[Math.floor(rng() * pool.length)].id;
          assert(g.answer(p.seat, p.id, c), 'jawaban valid ditolak: ' + p.kind);
        });
      },
    });
    const S = await g.run();
    assert.strictEqual(S.phase, 'end');
    assert(S.ps.every((p) => p.rp >= 0) && S.j.rp >= 0, 'Rupiah negatif');
  }
  return kinds;
}

let selesai = false;
process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });

(async () => {
  const b = await botGames(3000);
  console.log(`3000 match bot: juara Jaksa/Konglomerat/Direksi/UMKM = ${b.win.join('/')}% (sim: 23/29/20/28), UMKM jadi Pengusaha ${(b.umkmNaik * 100).toFixed(0)}%`);
  assert(b.win.every((x) => x >= 15 && x <= 35), 'Peluang juara tidak seimbang');

  const kinds = await randomHumans(300);
  console.log(`300 match semua kursi manusia (jawaban acak): selesai tanpa macet. Jenis prompt teruji: ${[...kinds].sort().join(', ')}`);

  for (const ch of CHAPTERS) {
    const r = await tutorial.autoplay(ch, GB);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  selesai = true;
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
