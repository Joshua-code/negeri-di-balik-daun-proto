// Cek ndbd-dompet.js: konversi Kekayaan → Dana Offshore dan kredit dompet yang idempoten. Dipanggil dari check.js.
const assert = require('assert');
const D = require('./ndbd-dompet.js');

const r = D.konversi([{ kekayaan: 40 }, { kekayaan: 30 }, { kekayaan: 20 }, { kekayaan: 10 }, { kekayaan: -3 }], 10);
assert.deepStrictEqual(r.map((x) => x.dana), [160, 90, 50, 20, 0]);
assert.strictEqual(D.danaMode(160, 'latihan'), 80);
assert.strictEqual(D.danaMode(160, 'tutorial'), 0);

const a = D.kredit({ matchId: 'jt-TES-1', game: 'jt', mode: 'online', role: 'Oknum', peringkat: 1, n: 4, kekayaan: 40, dana: 160 });
const b = D.kredit({ matchId: 'jt-TES-1', game: 'jt', mode: 'online', role: 'Oknum', peringkat: 1, n: 4, kekayaan: 40, dana: 160 });
assert(a.baru && !b.baru && D.saldo() === 160, 'kredit dompet tidak idempoten');
D.kredit({ matchId: 'gb-TES-1', game: 'gb', mode: 'latihan', role: 'UMKM', peringkat: 4, n: 4, kekayaan: 0, dana: 0 });
assert(!D.kredit({ matchId: 'gb-TES-1', game: 'gb', dana: 0 }).baru, 'match dengan Dana 0 terkredit dua kali');
assert(D.bonusTutorial('mh').baru && !D.bonusTutorial('mh').baru && D.saldo() === 160 + D.BONUS_TUTORIAL);
assert.strictEqual(D.riwayat().length, 3);
console.log('Dompet: konversi, pengali mode, kredit idempoten, bonus tutorial sekali — OK');
