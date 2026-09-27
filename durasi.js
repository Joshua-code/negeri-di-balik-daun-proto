// Estimasi durasi satu match (menit) untuk check.js / gb-check.js / mh-check.js.
// Durasi = jeda engine di kecepatan Normal (onPace, 1000 ms per unit) + waktu pikir manusia per prompt
// + jendela negosiasi online (onPhase('nego')). Manusia disimulasikan menjawab dengan pilihan bot.
const DETIK_KEPUTUSAN = 6;   // rata-rata waktu pikir per keputusan manusia
const DETIK_TAP = 2;         // prompt dengan satu pilihan aktif (mis. "Lempar dadu"): cukup satu ketukan
const NORMAL_DETIK = 1;      // 1 unit jeda = 1000 ms di kecepatan Normal

async function estimasi(lib, pemain, { n = 20, manusia = 'semua', negoDetik = 0, jumlahKursi = 4 } = {}) {
  let menit = 0, prompt = 0, jeda = 0, nego = 0;
  for (let i = 0; i < n; i++) {
    const human = (seat) => manusia === 'semua' || manusia === seat;
    let g, answered = 0, pc = 0, pj = 0, pn = 0, pd = 0;
    g = lib.createGame(pemain(jumlahKursi, human), {
      rng: lib.mulberry32(4242 + i),
      onPace(k) { pj += k; },
      async onPhase(kind) { if (kind === 'nego') pn++; },
      onUpdate(S) {
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id; pc++;
        pd += p.options.filter((o) => !o.disabled).length > 1 || p.angka || p.pick ? DETIK_KEPUTUSAN : DETIK_TAP;
        setImmediate(() => g.answer(p.seat, p.id, p.bot));
      },
    });
    await g.run();
    menit += (pj * NORMAL_DETIK + pd + pn * negoDetik) / 60;
    prompt += pc; jeda += pj; nego += pn;
  }
  return { menit: +(menit / n).toFixed(1), prompt: Math.round(prompt / n), jedaMenit: +((jeda * NORMAL_DETIK) / 60 / n).toFixed(1), nego: +(nego / n).toFixed(1) };
}

module.exports = { estimasi, DETIK_KEPUTUSAN, DETIK_TAP };
