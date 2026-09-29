/* Penjalan Mode Tutorial: runChapter & autoplay (bab-babnya ada di dg-tutorial.js; bab Jalan Tikus lama di arsip/tutorial.js).
 * Setiap bab = match mini dengan dadu/kartu yang diatur. Langkah (steps) dijalankan berurutan:
 *   on: 'start' | 'end' | 'event:<type>' | 'prompt:<kind>'
 *   target: selector elemen yang disorot, text: penjelasan, lock: id opsi yang wajib dipilih, lockTiles: petak yang boleh di-tap.
 */
(function (root) {
  'use strict';
  /** Jalankan satu bab. hooks.step(step) → Promise (UI menampilkan coach). hooks.answer(prompt, step) → pilihan manusia. */
  async function runChapter(ch, JT, hooks) {
    const steps = ch.steps;
    let i = 0;
    const cur = () => steps[i];
    const deep = (o) => JSON.parse(JSON.stringify(o));
    async function flush(on) { while (i < steps.length && cur().on === on) { await hooks.step(cur()); i++; } }
    let answered = 0;
    const dijawab = new Set();
    const game = JT.createGame(ch.players.map((p) => Object.assign({}, p)), {
      rng: JT.mulberry32(ch.id * 7), putaran: ch.putaran, script: deep(ch.script), setup: ch.setup,
      stopAfterTurn: ch.stopAfterTurn, stopAfter: ch.stopAfter, delay: hooks.delay || 0,
      async onEvent(e) { if (i < steps.length && cur().on === 'event:' + e.type) { await hooks.step(cur()); i++; } },
      onUpdate(S) {
        if (hooks.onUpdate) hooks.onUpdate(S);
        // engine lama: satu S.prompt; Dari Gerobak: beberapa S.prompts sekaligus (langkah tutorial hanya untuk kursi ch.human)
        const list = S.prompts ? Object.values(S.prompts) : S.prompt ? [S.prompt] : [];
        for (const p of list) {
          if (dijawab.has(p.id)) continue;
          dijawab.add(p.id); answered = p.id;
          const step = p.seat === ch.human && i < steps.length && cur().on === 'prompt:' + p.kind ? cur() : null;
          if (step) i++;
          Promise.resolve(p.seat === ch.human ? hooks.answer(p, step) : p.bot).then((c) => game.answer(p.seat, p.id, c));
        }
      },
    });
    if (hooks.onGame) hooks.onGame(game);
    await flush('start');
    const S = await game.run();
    await flush('end');
    return { S, done: i === steps.length };
  }

  /** Main otomatis untuk tes: jawaban = opsi yang dikunci, atau pilihan bot. */
  async function autoplay(ch, JT) {
    const prompts = [], events = [], seen = new Set();
    const r = await runChapter(ch, JT, {
      step: async () => {},
      answer(p, step) {
        prompts.push(p.kind); seen.add('prompt:' + p.kind);
        if (step && step.lockTiles) return step.lockTiles;
        if (step && step.lock) return step.lock;
        return new Promise((res) => setImmediate(() => res(p.bot)));
      },
      onUpdate(S) { const e = S.events[S.events.length - 1]; if (e && !events.includes(e.n)) { events.push(e.n); seen.add('event:' + e.type); } },
    });
    if (!r.done) throw new Error(`Tutorial ${ch.id}: tidak semua langkah terpicu`);
    return { prompts, events: [...seen].filter((x) => x.startsWith('event:')).map((x) => x.slice(6)), seen };
  }

  const api = { runChapter, autoplay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
