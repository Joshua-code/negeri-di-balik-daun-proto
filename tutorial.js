/* Skenario Mode Tutorial (5 bab). Dipakai UI (window.Tutorial) dan check.js (require).
 * Setiap bab = match mini dengan dadu/kartu yang diatur. Langkah (steps) dijalankan berurutan:
 *   on: 'start' | 'end' | 'event:<type>' | 'prompt:<kind>'
 *   target: selector elemen yang disorot, text: penjelasan, lock: id opsi yang wajib dipilih, lockTiles: petak yang boleh di-tap.
 */
(function (root) {
  'use strict';
  const rakyat1 = [{ name: 'Oknum (bot)', bot: true }, { name: 'Kamu', bot: false }];
  const hanyaGiliranKamu = (S, seat) => seat === 1;

  const CHAPTERS = [
    {
      id: 1, title: 'Hidup Jelata', human: 1, players: rakyat1, putaran: 1,
      script: { dice: { 1: [3] }, kabar: [11], karet: [6], pos: [[3]] },
      setup(S) { Object.assign(S.o, { nPos: 1, hand: [] }); Object.assign(S.rs[0], { rp: 0, rekaman: 0 }); },
      stopAfterTurn: hanyaGiliranKamu,
      expect: ['prompt:roll', 'prompt:razia'],
      steps: [
        { on: 'start', text: 'Selamat datang di <b>Negeri di Balik Daun</b>. Di <b>Jalan Tikus</b>, rakyat berusaha naik kelas sementara oknum aparat memeras di jalan. Tutorial ini 5 bab singkat.' },
        { on: 'start', target: '#me', text: 'Ini kamu: <b>Rakyat Jelata</b>. Tujuanmu: naik kelas sampai <b>Pengusaha</b>, lalu pindahkan uang ke luar negeri jadi <b>Harta Aman</b>. Di akhir, hanya Harta Aman yang dihitung.' },
        { on: 'event:kabar', target: '#kabar', text: 'Setiap putaran dibuka 1 <b>Kabar Istana</b>: kebijakan atau skandal yang mengubah aturan sebentar. Kali ini: RUU Perampasan Aset… ditunda lagi.' },
        { on: 'event:pos', target: '#board', text: 'Oknum memasang <b>Pos Razia 🚨</b> di jalan. Kamu kena razia kalau <b>berhenti tepat</b> di Pos. Kalau cuma lewat, aman.' },
        { on: 'event:gaji', target: '#me', text: 'Di awal giliran kamu terima <b>gaji</b> sesuai kelas. Jelata: 2 Rupiah.' },
        { on: 'prompt:roll', target: '#prompt', text: 'Tekan <b>Lempar dadu</b> untuk berjalan.' },
        { on: 'prompt:razia', target: '#prompt', text: 'Kena razia! <b>Damai "86"</b>: murah dan tetap jalan, tapi uangnya masuk kantong Oknum. <b>Tilang resmi</b>: lebih mahal, tapi uangnya masuk kas negara, bukan ke Oknum. (Pilihan ketiga, <b>Viralkan</b>, kamu pelajari di Bab 3.) Pilih salah satu.' },
        { on: 'end', target: '#oknum', text: 'Panel Oknum: <b>Sorotan</b> naik setiap kali ia memeras. Kalau menyentuh 10, terjadi <b>OTT</b>. <b>Citra</b> naik kalau ia bertindak "resmi". <br><br>Bab 1 selesai!' },
      ],
    },
    {
      id: 2, title: 'Naik Kelas & Izin', human: 1, players: rakyat1, putaran: 1,
      script: { dice: { 1: [2] }, kabar: [11], pos: [[8]] },
      setup(S) { Object.assign(S.o, { nPos: 1, hand: [] }); Object.assign(S.rs[0], { pos: 5, rp: 9, rekaman: 0 }); },
      stopAfterTurn: hanyaGiliranKamu,
      expect: ['prompt:kelola', 'event:calo'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 2. Kelas menentukan gaji: <b>Jelata 2 → Pedagang 3 → Juragan 5 → Pengusaha 7</b>. Naik kelas butuh uang, dan mulai Juragan butuh <b>izin</b>.' },
        { on: 'prompt:roll', target: '#prompt', text: 'Lempar dadu.' },
        { on: 'prompt:kelola', lock: 'naik', target: '#prompt', text: 'Uangmu cukup untuk jadi <b>Pedagang</b> (biaya 6). Jadi Pedagang tidak perlu izin. Tekan <b>Naik jadi Pedagang</b>.' },
        { on: 'prompt:kelola', lock: 'calo', target: '#prompt', text: 'Untuk jadi Juragan kamu butuh <b>izin</b>. Ada 2 jalan:<br>🏛️ <b>Kantor Izin</b>: gratis, tapi harus lewat kantornya dan baru jadi 2 putaran kemudian.<br>💰 <b>Calo</b>: langsung jadi di mana saja, tapi bayar pungli <b>ke Oknum</b>.<br>Coba lewat calo.' },
        { on: 'event:calo', target: '#oknum', text: 'Lihat: <b>Rupiah Oknum bertambah</b> dan Sorotannya naik. Calo mempercepatmu, tapi menggemukkan saingan terbesarmu. Menurut simulasi, rakyat yang <i>selalu</i> lewat calo justru paling jarang menang.' },
        { on: 'end', target: '[data-tile="6"]', text: 'Ini <b>Kantor Izin</b> (ada satu lagi di seberang papan). Lewati kantor ini saat masih Pedagang/Juragan untuk mengurus izin gratis.<br><br>Bab 2 selesai!' },
      ],
    },
    {
      id: 3, title: 'Viral & OTT', human: 1, players: rakyat1, putaran: 2,
      script: { dice: { 1: [2, 3] }, kabar: [11], karet: [5], pos: [[15], [17]] },
      setup(S) {
        Object.assign(S.o, { nPos: 1, hand: [], sorotan: 9, rp: 0, backing: 1 });
        Object.assign(S.rs[0], { pos: 12, kelas: 2, rp: 0, rekaman: 0 });
      },
      stopAfterTurn: (S, seat) => seat === 1 && S.t === 2,
      expect: ['event:rekaman', 'prompt:razia', 'event:ott', 'event:karet'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 3. Kamu sudah <b>Juragan</b>. Senjata rakyat melawan oknum adalah <b>Kartu Rekaman 📹</b>.' },
        { on: 'prompt:roll', target: '#prompt', text: 'Lempar dadu.' },
        { on: 'event:rekaman', target: '#me', text: 'Kamu berhenti di petak <b>Viral</b> dan dapat <b>Kartu Rekaman</b>. Jumlahnya terlihat semua pemain, jadi Oknum tahu siapa yang "berbahaya".' },
        { on: 'prompt:kelola', lock: 'selesai', target: '#prompt', text: 'Calo tersedia, tapi simpan uangmu dulu. Pilih <b>Selesai giliran</b>.' },
        { on: 'prompt:roll', target: '#prompt', text: 'Putaran baru. Lempar dadu.' },
        { on: 'prompt:razia', lock: 'viral', target: '#prompt', text: 'Pos lagi! Kali ini lawan dengan <b>Rekam & Viralkan</b>: kamu tidak bayar, dan Sorotan Oknum <b>+3</b>.' },
        { on: 'event:ott', target: '#oknum', text: 'Sorotan menyentuh 10 = <b>OTT!</b> Tapi Oknum jarang benar-benar tertangkap: ia bisa diselamatkan <b>Backing</b> atau <b>mengorbankan bawahan</b> (Tumbal). Tetap saja, OTT membuatnya kehilangan sesuatu.' },
        { on: 'event:karet', target: '#log', text: 'Setelah memviralkan, kamu melempar dadu <b>Pasal Karet</b>. Angka 1–2: kamu dilaporkan balik (UU ITE) dan masuk Lapas 2 putaran. Kali ini aman.' },
        { on: 'prompt:kelola', target: '#prompt', text: 'Sekarang bebas: beli izin lewat calo, atau selesai giliran.' },
        { on: 'end', text: 'Ringkasnya: memviralkan itu ampuh tapi berisiko. Oknum juga bisa membalas dengan <b>Rekayasa Kasus</b>; Kartu Rekaman bisa membongkarnya.<br><br>Bab 3 selesai!' },
      ],
    },
    {
      id: 4, title: 'Jadi Pengusaha', human: 1, players: rakyat1, putaran: 1,
      script: { dice: { 1: [3] }, kabar: [11], pos: [[1]] },
      setup(S) {
        Object.assign(S.o, { nPos: 1, hand: [], sorotan: 3 });
        Object.assign(S.rs[0], { pos: 20, kelas: 2, izin: true, rp: 26, rekaman: 1 });
      },
      stopAfterTurn: hanyaGiliranKamu,
      expect: ['prompt:kelola', 'event:transfer'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 4. Kamu Juragan dan sudah punya izin. Saatnya menjadi <b>Pengusaha</b>.' },
        { on: 'prompt:roll', target: '#prompt', text: 'Lempar dadu.' },
        { on: 'prompt:kelola', lock: 'naik', target: '#prompt', text: 'Naik jadi <b>Pengusaha</b> (biaya 24).' },
        { on: 'prompt:kelola', lock: 'transfer', target: '#prompt', text: 'Hanya Pengusaha yang bisa <b>Transfer ke Luar</b>. Potongannya 20%, atau 10% kalau berhenti di 🏦 <b>Bank</b> seperti sekarang. Transfer!' },
        { on: 'event:transfer', target: '#me', text: 'Uangmu kini <b>Harta Aman</b> di luar negeri: tidak bisa disita, tidak kena razia. Inilah yang dilakukan oknum dan pengusaha di dunia nyata.' },
        { on: 'end', text: 'Di akhir permainan (20 putaran), <b>Rupiah yang tersisa hangus</b>. Pemenangnya pemilik Harta Aman terbanyak. Rakyat yang tidak sempat jadi Pengusaha mendapat 0.<br><br>Bab 4 selesai!' },
      ],
    },
    {
      id: 5, title: 'Jadi Oknum', human: 0, players: [{ name: 'Kamu', bot: false }, { name: 'Rakyat (bot)', bot: true }], putaran: 1,
      script: { dice: { 1: [3] }, kabar: [11], karet: [6] },
      setup(S) {
        Object.assign(S.o, { rp: 7, sorotan: 9, backing: 1, hand: [], nPos: 3 });
        Object.assign(S.rs[0], { kelas: 1, rp: 3, rekaman: 1 });
      },
      stopAfterTurn: hanyaGiliranKamu,
      expect: ['prompt:pos', 'prompt:aksi', 'prompt:ott'],
      steps: [
        { on: 'start', target: '#oknum', text: 'Bab 5. Sekarang kamu jadi <b>Oknum Aparat</b>. Kamu memeras lewat Pos Razia, menjaga Citra, dan menghindari OTT.' },
        { on: 'prompt:pos', lockTiles: [1, 2, 3], target: '#board', text: 'Pasang <b>3 Pos Razia</b>. Rakyat maju 1–6 petak, dan hanya kena razia kalau <b>berhenti tepat</b> di Pos. Tap petak yang menyala (1–3), lalu tekan <b>Konfirmasi</b>.' },
        { on: 'prompt:aksi', target: '#prompt', text: 'Setiap giliran kamu punya 1 aksi:<br>• <b>Sowan</b>: setor ke atasan, Sorotan turun.<br>• <b>Rekayasa kasus</b>: jebloskan Rakyat ke Lapas (bisa dibongkar rekaman).<br>• <b>Operasi resmi</b>: pencitraan.<br>Sorotanmu sudah 9. Hati-hati!' },
        { on: 'prompt:ott', target: '#prompt', text: '<b>OTT!</b> Pilih cara lolos. Backing menyelamatkan. Tumbal mengorbankan 1 Pos selamanya. Pasrah = separuh Rupiah disita. Harta Aman yang sudah di luar negeri selalu aman.' },
        { on: 'end', target: '#oknum', text: 'Satu hal lagi: di akhir, <b>Citra harus ≥ 7</b>. Kalau tidak, kamu dimutasi dan Harta Amanmu dikali 0,7.<br><br>🎉 <b>Tutorial selesai!</b> Coba <b>Latihan vs Bot</b> atau ajak teman di <b>Main Online</b>.' },
      ],
    },
  ];

  /** Jalankan satu bab. hooks.step(step) → Promise (UI menampilkan coach). hooks.answer(prompt, step) → pilihan manusia. */
  async function runChapter(ch, JT, hooks) {
    const steps = ch.steps;
    let i = 0;
    const cur = () => steps[i];
    const deep = (o) => JSON.parse(JSON.stringify(o));
    async function flush(on) { while (i < steps.length && cur().on === on) { await hooks.step(cur()); i++; } }
    let answered = 0;
    const game = JT.createGame(ch.players.map((p) => Object.assign({}, p)), {
      rng: JT.mulberry32(ch.id * 7), putaran: ch.putaran, script: deep(ch.script), setup: ch.setup,
      stopAfterTurn: ch.stopAfterTurn, delay: hooks.delay || 0,
      async onEvent(e) { if (i < steps.length && cur().on === 'event:' + e.type) { await hooks.step(cur()); i++; } },
      onUpdate(S) {
        if (hooks.onUpdate) hooks.onUpdate(S);
        const p = S.prompt;
        if (!p || p.id === answered) return;
        answered = p.id;
        const step = i < steps.length && cur().on === 'prompt:' + p.kind ? cur() : null;
        if (step) i++;
        Promise.resolve(hooks.answer(p, step)).then((c) => game.answer(p.seat, p.id, c));
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

  const api = { CHAPTERS, runChapter, autoplay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
