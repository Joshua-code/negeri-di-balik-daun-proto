// node prototype/gb-check.js — cek engine Gedung Bundar: (1) keseimbangan match bot, (2) semua kursi "manusia" acak tidak macet, (3) 5 bab tutorial,
// (4) uji fokus Perlindungan Korban (Jaksa selalu menjerat UMKM), (5) estimasi durasi 15–20 menit.
const assert = require('assert');
const GB = require('./gb-engine.js');
const tutorial = require('./tutorial.js');
const { CHAPTERS } = require('./gb-tutorial.js');
const { estimasi } = require('./durasi.js');
const NEGO_DETIK = 25;   // rata-rata pemakaian jendela negosiasi online per ronde (maks 30 detik)

const ROLES = ['jaksa', 'kong', 'bumn', 'umkm'];
const pemain = (bot) => ROLES.map((r, s) => ({ name: 'P' + s, bot, role: s ? r : undefined }));

async function botGames(n) {
  const win = Object.fromEntries(ROLES.map((r) => [r, 0])), dana = Object.fromEntries(ROLES.map((r) => [r, 0]));
  let umkmNaik = 0;
  for (let i = 0; i < n; i++) {
    const g = GB.createGame(pemain(true), { strict: true, rng: GB.mulberry32(i + 1) });
    const S = await g.run();
    win[S.result.ranking[0].role]++;
    umkmNaik += S.ps.find((p) => p.role === 'umkm').pengusaha;
    for (const x of S.result.ranking) {
      assert(Number.isInteger(x.kekayaan) && x.kekayaan >= 0 && x.dana >= 0, 'Kekayaan/Dana tidak valid');
      dana[x.role] += x.dana;
    }
  }
  return { win: ROLES.map((r) => Math.round((100 * win[r]) / n)), umkmNaik: umkmNaik / n, dana: ROLES.map((r) => Math.round(dana[r] / n)) };
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
    assert(S.ps.every((p) => p.rp >= 0 && p.aset >= 0) && S.j.rp >= 0 && S.j.aset >= 0, 'Cuan/Aset negatif');
  }
  return kinds;
}

// Uji fokus: Jaksa (dikendalikan skrip) selalu menjerat UMKM kalau bisa. Bandingkan peluang juara UMKM dengan/tanpa Perlindungan Korban.
async function fokusUmkm(n, lindung) {
  const simpan = Object.assign({}, GB.C.LINDUNG);
  if (!lindung) Object.keys(GB.C.LINDUNG).forEach((k) => { GB.C.LINDUNG[k] = false; });
  let menang = 0;
  for (let i = 0; i < n; i++) {
    let g, answered = 0;
    const players = ROLES.map((r, s) => ({ name: 'P' + s, bot: s !== 0, role: s ? r : undefined }));
    g = GB.createGame(players, {
      rng: GB.mulberry32(7000 + i),
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        const umkm = S.ps.find((x) => x.role === 'umkm');
        let c = p.bot;
        if (p.kind === 'aksi_jaksa' && umkm.jejak >= 1 && p.options.some((o) => o.id === 'selidik' && !o.disabled)) c = 'selidik';
        if (p.kind === 'target' && p.options.some((o) => o.id === umkm.seat && !o.disabled)) c = umkm.seat;
        if (p.kind === 'kalkulator') c = p.options.filter((o) => !o.disabled).pop().id;
        setImmediate(() => g.answer(p.seat, p.id, c));
      },
    });
    const S = await g.run();
    if (S.result.ranking[0].role === 'umkm') menang++;
  }
  Object.assign(GB.C.LINDUNG, simpan);
  return Math.round((100 * menang) / n);
}

let selesai = false;
process.on('exit', () => { if (!selesai) { console.error('MACET: ada promise yang tidak pernah selesai'); process.exitCode = 1; } });

(async () => {
  const b = await botGames(3000);
  console.log(`3000 match bot: juara Jaksa/Konglomerat/Direksi/UMKM = ${b.win.join('/')}% (target 15–35% tiap role), UMKM jadi Pengusaha ${(b.umkmNaik * 100).toFixed(0)}%`);
  assert(b.win.every((x) => x >= 15 && x <= 35), 'Peluang juara tidak seimbang');
  const rataDana = b.dana.reduce((s, x) => s + x, 0) / 4;
  console.log(`Dana Offshore rata-rata Jaksa/Konglomerat/Direksi/UMKM (Online, kurs ${GB.C.KURS}): ${b.dana.join('/')} (rata-rata ${Math.round(rataDana)}, target ±100)`);
  assert(b.dana.every((x) => Math.abs(x - rataDana) <= 0.2 * rataDana), 'Dana per role timpang > ±20%');
  assert(rataDana >= 80 && rataDana <= 120, 'Kurs perlu dikalibrasi ulang (rata-rata Dana di luar 80–120)');

  const kinds = await randomHumans(300);
  console.log(`300 match semua kursi manusia (jawaban acak): selesai tanpa macet. Jenis prompt teruji: ${[...kinds].sort().join(', ')}`);

  const fOn = await fokusUmkm(1000, true), fOff = await fokusUmkm(1000, false);
  console.log(`Uji fokus (Jaksa selalu menjerat UMKM): UMKM juara ${fOn}% dengan Perlindungan Korban, ${fOff}% tanpa (normal ${b.win[3]}%)`);
  assert(fOn >= 0.7 * b.win[3], 'UMKM terlalu terhukum saat dikeroyok');

  const kursi = (n, human) => ROLES.map((r, s) => ({ name: 'P' + s, bot: !human(s), role: s ? r : undefined }));
  const d = await estimasi(GB, kursi, { negoDetik: NEGO_DETIK });
  console.log(`Estimasi durasi 4 manusia online: ${d.menit} menit (${d.prompt} keputusan, jeda ${d.jedaMenit} menit, ${d.nego} jendela negosiasi)`);
  assert(d.menit >= 15 && d.menit <= 20, 'durasi di luar 15–20 menit');
  const solo = await estimasi(GB, kursi, { manusia: 3 });
  console.log(`Estimasi durasi latihan 1 manusia vs bot (UMKM): ${solo.menit} menit`);

  for (const ch of CHAPTERS) {
    const r = await tutorial.autoplay(ch, GB);
    console.log(`Tutorial ${ch.id}: prompt ${r.prompts.join(' → ')} | event ${r.events.join(',')}`);
    for (const need of ch.expect) assert(r.seen.has(need), `Tutorial ${ch.id} tidak memunculkan ${need}`);
  }
  selesai = true;
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
