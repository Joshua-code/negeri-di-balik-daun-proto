/* Skenario tutorial Meja Hijau (3 bab, docs/05 §11). Dijalankan dengan Tutorial.runChapter(ch, MejaHijau, hooks) dari tutorial.js.
 * Format bab & langkah sama dengan tutorial.js (on: 'start' | 'end' | 'event:<type>' | 'prompt:<kind>', target, text, lock).
 * Kursi: 0 Hakim, 1 Panitera, 2 Pengacara, 3 Keluarga Korban.
 */
(function (root) {
  'use strict';
  const BOT = ['Yang Mulia 🤖', 'Pak Panitera 🤖', 'Bang Pengacara 🤖', 'Bu Korban 🤖'];
  const meja = (human) => BOT.map((name, seat) => (seat === human ? { name: 'Kamu', bot: false } : { name, bot: true }));
  const tanpaSiasat = (S, kecuali) => S.p.forEach((p) => { if (p.seat !== kecuali) p.siasat = []; });

  const CHAPTERS = [
    {
      id: 1, title: 'Keluarga Korban', human: 3, players: meja(3), putaran: 1,
      script: { perkara: [0], kabar: [12], karet: [6, 6], strat: { 0: 'rakus', 1: 'sedang', 2: 'patuh' }, cepu: null },
      setup(S) { tanpaSiasat(S, -1); },
      expect: ['prompt:respons', 'event:kasasi'],
      steps: [
        { on: 'start', text: 'Selamat datang di <b>Meja Hijau</b>. Di sini putusan pengadilan bisa dibeli: pengacara menyuap hakim lewat panitera, dan keluarga korban berusaha memaksa keadilan. Tutorial ini 3 bab singkat.' },
        { on: 'start', target: '#me', text: 'Kamu <b>Keluarga Korban</b>. Kamu langsung juara kalau <b>Keadilan ⚖️ mencapai 13</b>, plus <b>Santunan</b> 25 Fulus. Keadilan didapat saat putusan akhir sama dengan <b>Putusan Adil</b> di kartu perkara. Kalau tidak tercapai, kamu bersaing lewat <b>Kekayaan</b>: Fulus 💵 + nilai usaha dari naik kelas.' },
        { on: 'event:perkara', target: '#perkara', text: 'Ini <b>kartu Perkara</b>. Terdakwanya konglomerat dengan <b>Dana Klien 18</b>: uang yang dipakai pengacara untuk "mengurus" perkara. Klien ingin <b>Bebas</b>, padahal Putusan Adil-nya <b>Berat</b>. Perhatikan meter <b>Sorotan Perkara</b>.' },
        { on: 'event:amplop', target: '#meja', text: 'Pengacara baru saja menyerahkan <b>amplop</b> ke Panitera. Semua orang melihat amplopnya, tapi <b>tidak ada yang tahu isinya</b> kecuali yang memegangnya.' },
        { on: 'event:damai', target: '#meja', text: 'Pengacara menawarimu <b>Uang Damai</b>. Uang membantumu naik kelas, tapi kalau diterima, perkara ini tidak memberi Keadilan dan Sorotan Perkara turun.' },
        { on: 'prompt:respons', lock: 'viral2', target: '#prompt', text: 'Senjatamu adalah <b>Kartu Viral 📹</b>: tiap kartu Sorotan Perkara +3. Kalau putusannya janggal dan Sorotan Perkara cukup tinggi, terjadi <b>kasasi</b>. Risikonya dadu <b>Pasal Karet</b>: 1–2 = kamu dilaporkan balik. Pakai <b>2 kartu</b>.' },
        { on: 'event:putusan', target: '#perkara', text: 'Hakim sudah "dibeli": putusannya <b>Bebas</b>, jadi <b>janggal</b>. Publik marah, Sorotan Perkara +2. Semua yang ikut rantai suap juga kena Sorotan.' },
        { on: 'event:kasasi', target: '#perkara', text: '<b>KASASI!</b> Sorotan Perkara ≥ 9, terlalu viral untuk diblokir Makelar MA. Putusan dibalik jadi Berat, dan kamu dapat <b>Keadilan 3 + 1</b> bonus kasasi.' },
        { on: 'end', target: '#me', text: 'Tanpa viral, putusan janggal itu akan bertahan. <i>No viral no justice.</i><br><br>Bab 1 selesai! Sekarang coba duduk di kursi <b>Panitera</b>.' },
      ],
    },
    {
      id: 2, title: 'Panitera', human: 1, players: meja(1), putaran: 1,
      script: { perkara: [3], kabar: [12], strat: { 0: 'rakus', 2: 'patuh', 3: 'keadilan' }, cepu: null },
      setup(S) { tanpaSiasat(S, -1); S.p[3].viral = 0; },
      expect: ['prompt:relay', 'prompt:potong', 'event:putusan'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 2. Kamu <b>Panitera</b>. Kamu tidak memutus apa pun, tapi <b>semua pesan dan amplop antara Hakim dan Pengacara lewat kamu</b>. Informasi adalah uangmu.' },
        { on: 'event:perkara', target: '#perkara', text: 'Perkara baru. Dana Klien 13. Kamu langsung mendapat <b>Biaya Berkas 2</b> dari kas klien, legal dan pasti.' },
        { on: 'prompt:relay', lock: 8, target: '#prompt', text: 'Hakim berbisik: tarifnya <b>5</b> (lihat panel 🔒 Rahasiaku). Pengacara tidak tahu angka asli. Sampaikan tarif <b>8</b>: selisih 3 jadi "ongkos"-mu.' },
        { on: 'prompt:potong', lock: 3, target: '#prompt', text: 'Pengacara percaya dan mengirim amplop berisi 8. Ambil <b>3</b>, teruskan 5 ke Hakim. Hakim menerima persis tarifnya, jadi ia tidak curiga.' },
        { on: 'event:putusan', target: '#log', text: 'Hakim memutus sesuai keinginan klien. Semua senang, <b>kecuali korban</b>. Kamu mendapat 2 + 3 tanpa memutus apa pun.' },
        { on: 'prompt:kelola', target: '#prompt', text: 'Akhir perkara: kamu boleh <b>Beli Aset 🏠</b>. Fulus jadi Aset (potong 20%) yang tidak bisa disita OTT. Tapi Pejabat yang pamer harta kena Sorotan +1 (LHKPN). Fulus yang tidak dibelikan tetap dihitung di akhir. Pilih sesukamu.' },
        { on: 'end', target: '#me', text: 'Risikomu: kalau Pengacara memakai <b>Jalur Langsung</b>, tarif asli terbuka dan ongkosmu ketahuan. Dan saat Hakim kena OTT, kamulah yang <b>ditumbalkan</b>.<br><br>Bab 2 selesai! Terakhir: kursi <b>Hakim</b>.' },
      ],
    },
    {
      id: 3, title: 'Hakim', human: 0, players: meja(0), putaran: 2,
      script: { perkara: [7, 9], kabar: [12], strat: { 1: 'sedang', 2: 'patuh', 3: 'keadilan' }, cepu: null },
      setup(S) { tanpaSiasat(S, -1); S.p[0].siasat = ['pers']; S.p[3].viral = 0; },
      expect: ['prompt:tarif', 'prompt:simpan', 'prompt:putusan', 'prompt:putusan_kecil'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 3. Kamu <b>Hakim</b>. Tujuanmu Kekayaan terbanyak (Fulus + Aset), <b>tapi Citra harus ≥ 6</b> di akhir. Kalau tidak, kamu dimutasi dan Kekayaan ×0,7. Citramu sekarang 5.' },
        { on: 'prompt:tarif', lock: 3, target: '#prompt', text: 'Perkara pejabat korup, Dana Klien 9. Klien ingin vonis <b>Ringan</b>. Sebut tarifmu. Pesan ini hanya sampai ke Panitera. Minta <b>3</b>.' },
        { on: 'prompt:simpan', lock: 'ya', target: '#prompt', text: 'Amplop sampai berisi 3, sesuai permintaanmu. Kalau isinya kurang, kamu bisa <b>mengembalikannya</b>, dan Pengacara akan tahu Panitera memotong. Kali ini <b>simpan</b>.' },
        { on: 'prompt:putusan', lock: 1, target: '#prompt', text: 'Kamu bebas memutus apa saja. Tapi kalau menyimpan amplop lalu memutus Adil (<b>Ingkar</b>), Pengacara bisa membocorkanmu. Putuskan <b>Ringan</b>, "vonis ringan koruptor" yang biasa itu. Putusan Janggal: Citra −1.' },
        { on: 'prompt:kelola', target: '#prompt', text: 'Citramu turun ke 4. Kamu bisa memakai <b>Jumpa Pers</b> (Citra +2, sekali per game), atau menyimpannya untuk nanti.' },
        { on: 'prompt:putusan_kecil', lock: 2, target: '#prompt', text: 'Perkara berikutnya: <b>nenek pemungut kakao</b>. Tidak ada klien, tidak ada pembela. Memvonis <b>Berat</b> memberimu <b>Citra +2</b>, cara termurah memulihkan nama baik. Game ini sengaja membuat pilihan ini terasa kejam.' },
        { on: 'end', target: '#me', text: 'Begitulah Meja Hijau: <b>tajam ke bawah, tumpul ke atas</b>. Laporan Korban di akhir match akan mencatat setiap vonis seperti ini.<br><br>Setelah match, Kekayaanmu <b>dikonversi jadi Dana Offshore</b> (juara 40%, ke-2 30%, ke-3 25%, ke-4 20%) dan masuk dompetmu di Negeri di Balik Daun.<br><br>🎉 <b>Tutorial selesai!</b> Coba <b>Latihan vs Bot</b> dengan role lain, atau ajak teman di <b>Main Online</b>.' },
      ],
    },
  ];

  const api = { CHAPTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MHTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
