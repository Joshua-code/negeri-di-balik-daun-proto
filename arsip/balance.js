// node prototype/balance.js '{"TARIF_86":[1,3,5,7]}' — uji keseimbangan dengan match bot (semua Rakyat strategi "campur").
const JT = require('./engine.js');

async function run(over = {}, n = 2000, strats = ['campur', 'campur', 'campur']) {
  const saved = JSON.parse(JSON.stringify(JT.C));
  Object.assign(JT.C, over);
  const win = [0, 0, 0, 0], st = {};
  let reach = 0, reachAt = 0, kayaO = 0, kayaR = 0, asetO = 0, danaO = 0, danaR = 0, mutasi = 0; const citra = [];
  for (let i = 0; i < n; i++) {
    const g = JT.createGame([0, 1, 2, 3].map((s) => ({ name: 'P' + s, bot: true })), {
      rng: JT.mulberry32(i + 1), setup(S) { S.rs.forEach((r, j) => { r.strat = strats[j]; }); },
    });
    const S = await g.run();
    win[S.result.winner]++;
    asetO += S.o.aset; citra.push(S.o.citra);
    for (const x of S.result.ranking) { if (x.seat === 0) { kayaO += x.kekayaan; danaO += x.dana; } else { kayaR += x.kekayaan; danaR += x.dana; } } if (S.o.citra < JT.C.CITRA_MIN) mutasi++;
    for (const r of S.rs) { if (r.kelas === 3) { reach++; reachAt += r.naikAt; } }
    for (const k in S.stats) st[k] = (st[k] || 0) + S.stats[k];
  }
  Object.keys(saved).forEach((k) => { JT.C[k] = saved[k]; });
  const pct = (x) => Math.round((100 * x) / n);
  return {
    oknum: pct(win[0]), rakyat: win.slice(1).map(pct), pengusaha: Math.round((100 * reach) / (3 * n)),
    putaranPengusaha: +(reachAt / Math.max(reach, 1)).toFixed(1), kayaOknum: Math.round(kayaO / n), kayaRakyat: Math.round(kayaR / (3 * n)), asetOknum: Math.round(asetO / n),
    danaOknum: Math.round(danaO / n), danaRakyat: Math.round(danaR / (3 * n)), aset: +((st.aset_dibeli || 0) / n).toFixed(1),
    ott: +(((st.ott_backing || 0) + (st.ott_tumbal_pos || 0) + (st.ott_tumbal_kartu || 0) + (st.ott_tertangkap || 0)) / n).toFixed(1),
    razia: +(((st.uang_86 || 0)) / n).toFixed(1),
    mutasi: pct(mutasi), citraMedian: citra.sort((a, b) => a - b)[n >> 1],
  };
}
module.exports = { run };
if (require.main === module) {
  const over = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  run(over).then((r) => console.log(JSON.stringify(over), '→', JSON.stringify(r)));
}
