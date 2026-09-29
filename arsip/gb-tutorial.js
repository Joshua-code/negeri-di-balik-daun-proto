/* Skenario tutorial Gedung Bundar (5 bab). Dijalankan dengan Tutorial.runChapter(ch, GedungBundar, hooks) dari tutorial.js.
 * Format bab & langkah sama dengan tutorial.js (on: 'start' | 'end' | 'event:<type>' | 'prompt:<kind>', target, text, lock).
 */
(function (root) {
  'use strict';
  const GB = typeof module !== 'undefined' && module.exports ? require('./gb-engine.js') : root.GedungBundar;
  // kartu Usaha: id = sektor*6 + (0,1,2 Kecil · 3,4 Menengah · 5 Besar). Pangan 0–5, Tambang 6–11, Infra 12–17, Digital 18–23.
  const U = (...ids) => ids.map((id) => Object.assign({}, GB.USAHA[id], { beku: false }));
  const umkm = (p) => [{ name: 'Jaksa (bot)', bot: true }, { name: 'Kamu', bot: false, role: 'umkm' }].concat(p || []);
  const giliranKamu = (S, seat) => seat === 1;
  const giliranJaksa = (S, seat) => seat === 0;

  const CHAPTERS = [
    {
      id: 1, title: 'Hidup UMKM', human: 1, players: umkm(), putaran: 1,
      script: { kabar: [7] },
      setup(S) { Object.assign(S.ps[0], { rp: 1, usaha: U(0, 18) }); S.pasar = U(1, 3, 7, 13); },
      stopAfterTurn: giliranKamu,
      expect: ['prompt:aksi', 'prompt:pilih_usaha', 'event:naik'],
      steps: [
        { on: 'start', text: 'Selamat datang di <b>Gedung Bundar</b>. Di sini pengusaha membangun bisnis, dan jaksa bisa menjerat siapa saja yang "merugikan negara". Tutorial ini 5 bab singkat.' },
        { on: 'start', target: '#me', text: 'Kamu <b>UMKM</b>: modal paling kecil. Tujuanmu membangun <b>kerajaan bisnis</b> paling bernilai: <b>Cuan 💹</b> + nilai Usaha + Aset. Punya <b>3 Usaha</b> = naik kelas jadi <b>Pengusaha</b>.' },
        { on: 'event:kabar', target: '#kabar', text: 'Setiap ronde dibuka 1 <b>Kabar Istana</b>. Kali ini: RUU Perampasan Aset… ditunda lagi.' },
        { on: 'event:produksi', target: '#me', text: '<b>Produksi</b>: setiap Usaha menghasilkan Cuan tiap ronde. Usaha Kecil milik UMKM menghasilkan <b>2</b> (bonus Usaha Rakyat).' },
        { on: 'prompt:aksi', lock: 'beli', target: '#prompt', text: 'Setiap giliran kamu punya <b>1 aksi</b>. Pilih <b>Beli Usaha</b>.' },
        { on: 'prompt:pilih_usaha', target: '#pasar', text: 'Ini <b>Pasar Usaha</b>. Setiap Usaha <b>sektor yang sama</b> dengan yang sudah kamu punya jadi <b>1 lebih murah</b>. Kamu punya Warung (🌾 Pangan), jadi Usaha Pangan lebih murah. Pilih satu.' },
        { on: 'event:naik', target: '#me', text: 'Usaha ketiga! Kamu naik kelas jadi <b>Pengusaha</b>, dan sekarang boleh <b>Beli Aset</b>: Cuan yang aman dari sitaan vonis dan krisis.' },
        { on: 'end', text: 'Jalur Usaha itu aman tapi lambat. Di bab berikutnya ada jalan pintas: <b>Proyek Negara</b>.<br><br>Bab 1 selesai!' },
      ],
    },
    {
      id: 2, title: 'Godaan Proyek', human: 1, players: umkm(), putaran: 1,
      script: { kabar: [7], proyek: [0, 10, 2] },
      setup(S) { Object.assign(S.ps[0], { rp: 0, usaha: U(0) }); },
      stopAfterTurn: giliranKamu,
      expect: ['prompt:pilih_proyek', 'event:proyek'],
      steps: [
        { on: 'start', target: '#proyek', text: 'Bab 2. Ini <b>Proyek Negara</b>: untung besar sekali ambil. Beberapa butuh syarat sektor, misalnya Impor Gula butuh 1 Usaha Pangan.' },
        { on: 'prompt:aksi', lock: 'proyek', target: '#prompt', text: 'Pilih <b>Ambil Proyek Negara</b>.' },
        { on: 'prompt:pilih_proyek', target: '#prompt', text: 'Ambil <b>Impor Gula</b>: +8 Cuan sekarang.' },
        { on: 'event:proyek', target: '#me', text: 'Uangmu naik, tapi lihat <b>👣 Jejak</b>. Menurut Pasal 2/3, <b>setiap untung dari proyek negara = Jejak</b>. Niat jahat tidak perlu dibuktikan. Sebagai UMKM (subkontraktor), Jejakmu dipotong 1, tapi tetap ada.' },
        { on: 'end', target: '#jaksa', text: 'Jaksa hanya bisa menjerat pemain yang punya Jejak. Makin besar Jejak, makin besar "kerugian negara" yang bisa ia hitung.<br><br>Bab 2 selesai!' },
      ],
    },
    {
      id: 3, title: 'Diselidiki', human: 1, players: umkm(), putaran: 2,
      script: { kabar: [7, 7], karet: [5] },
      setup(S) { Object.assign(S.ps[0], { rp: 6, jejak: 3, viral: 1, usaha: U(0) }); },
      stopAfterTurn: (S, seat) => seat === 1 && S.t === 2,
      expect: ['event:perkara', 'prompt:viral', 'prompt:respons', 'event:laci', 'event:upeti'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 3. Kamu punya <b>Jejak 3</b> dari proyek kemarin. Jaksa sedang mencari target.' },
        { on: 'prompt:aksi', lock: 'pas', target: '#prompt', text: 'Kali ini pilih <b>Pas</b> dan lihat apa yang dilakukan Jaksa.' },
        { on: 'event:perkara', target: '#jaksa', text: 'Jaksa memutar <b>Kalkulator Kerugian</b>: Jejak × 1 (Rendah), × 2 (Tinggi), atau × 3 (Fantastis). Angkanya dikarang, dan Usahamu langsung <b>dibekukan ❄️</b>.' },
        { on: 'prompt:viral', lock: 'ya', target: '#prompt', text: 'Senjata UMKM: <b>Viralkan</b>. Sorotan Jaksa +3 dan kamu dapat +1 di sidang. Risikonya: dadu <b>Pasal Karet</b> 1–2, kamu dilaporkan balik dengan UU ITE.' },
        { on: 'prompt:respons', lock: 'setor', target: '#prompt', text: 'Tiga pilihan:<br>🤫 <b>Setor</b> setengah kerugian: kasus "diamankan" ke Laci Jaksa.<br>🧑‍⚖️ <b>Lawan</b> di sidang.<br>🏛️ <b>Minta Istana</b> (butuh 2 Backing).<br>Coba <b>Setor</b>.' },
        { on: 'event:laci', target: '#jaksa', text: 'Kasusmu kini di <b>Laci 🗄️</b> Jaksa. Kasus tidak ditutup, hanya <b>digantung</b>.' },
        { on: 'event:upeti', target: '#jaksa', text: 'Ronde baru: kamu wajib membayar <b>Upeti 2 Cuan</b> per kasus di Laci, setiap ronde. Kalau tidak mampu, kasusnya dibuka lagi. Laci adalah mesin uang Jaksa.' },
        { on: 'end', text: 'Setor itu murah di awal, tapi mengikatmu selamanya. Di bab berikutnya kamu mencoba melawan.<br><br>Bab 3 selesai!' },
      ],
    },
    {
      id: 4, title: 'Sidang & Aset', human: 1, players: umkm(), putaran: 2,
      script: { kabar: [7, 7], sidang: [6] },
      setup(S) { Object.assign(S.ps[0], { rp: 2, jejak: 2, viral: 0, usaha: U(0, 18) }); S.j.rp = 0; S.pasar = U(1, 19, 3, 9); },
      stopAfterTurn: (S, seat) => seat === 1 && S.t === 2,
      expect: ['event:naik', 'prompt:respons', 'prompt:sidang', 'event:sidang', 'event:aset'],
      steps: [
        { on: 'start', target: '#me', text: 'Bab 4. Kamu punya 2 Usaha dan Jejak 2. Uangmu tipis, jadi kalau diselidiki, Setor bukan pilihan.' },
        { on: 'prompt:aksi', lock: 'beli', target: '#prompt', text: 'Beli Usaha ketiga supaya jadi Pengusaha.' },
        { on: 'prompt:pilih_usaha', target: '#pasar', text: 'Pilih Usaha yang terjangkau (harga tertulis di tombol dan kartu).' },
        { on: 'event:naik', target: '#me', text: 'Kamu Pengusaha sekarang. Tapi Jaksa sudah melirik Jejakmu…' },
        { on: 'prompt:respons', lock: 'lawan', target: '#prompt', text: 'Kamu diselidiki. Pilih <b>Lawan di sidang</b>. Peluang menangmu tertulis di tombol.' },
        { on: 'prompt:sidang', target: '#prompt', text: 'Lempar dadu sidang!' },
        { on: 'event:sidang', target: '#log', text: 'Kalau menang, Usahamu dicairkan dan negara membayar ganti rugi… <b>1 Cuan</b>. Tapi <b>Jejakmu tidak hilang</b>: Jaksa bisa menjeratmu lagi dengan "kasus lain" (Kasus Estafet). Kalau kalah: bayar uang pengganti, Usaha disita, masuk Lapas.' },
        { on: 'prompt:aksi', lock: 'aset', target: '#prompt', text: 'Pilih <b>Beli Aset</b>: potong 20%, tapi Aset tidak bisa disita saat vonis dan tidak ikut hilang saat krisis.' },
        { on: 'event:aset', target: '#me', text: 'Cuanmu kini jadi <b>Aset</b>. Nilainya tetap dihitung di akhir, dan tidak ada yang bisa menyitanya.' },
        { on: 'end', text: 'Di akhir permainan, <b>Kekayaan</b> = Cuan + Aset + nilai Usaha yang tidak dibekukan. Peringkat ditentukan Kekayaan.<br><br>Setelah match, Kekayaanmu <b>dikonversi jadi Dana Offshore</b> (juara 40%, ke-2 30%, ke-3 25%, ke-4 20%) dan masuk dompetmu di Negeri di Balik Daun.<br><br>Bab 4 selesai!' },
      ],
    },
    {
      id: 5, title: 'Jadi Jaksa', human: 0, players: [{ name: 'Kamu', bot: false }, { name: 'Konglomerat (bot)', bot: true, role: 'kong' }], putaran: 1,
      script: { kabar: [7], sidang: [1] },
      setup(S) { Object.assign(S.j, { rp: 4, sorotan: 9, backing: 1 }); Object.assign(S.ps[0], { jejak: 4, rp: 0, backing: 0 }); S.proyekBuka = []; },
      stopAfterTurn: giliranJaksa,
      expect: ['prompt:aksi_jaksa', 'prompt:kalkulator', 'prompt:konpers', 'prompt:ott', 'prompt:aset_jaksa'],
      steps: [
        { on: 'start', target: '#jaksa', text: 'Bab 5. Sekarang kamu <b>Jaksa</b>. Uangmu dari <b>setoran</b> dan <b>upeti Laci</b>. <b>Citra</b> dari vonis dan konferensi pers. Di akhir, Citra harus ≥ 5.' },
        { on: 'prompt:aksi_jaksa', lock: 'selidik', target: '#prompt', text: 'Pilih <b>Penyelidikan</b>.' },
        { on: 'prompt:target', target: '#prompt', text: 'Pilih target yang punya Jejak.' },
        { on: 'prompt:kalkulator', lock: 2, target: '#prompt', text: 'Makin besar angkanya, makin besar setoran, tapi makin mudah dibantah di sidang dan bisa <b>dikoreksi MA</b> di akhir. Coba <b>Fantastis</b>.' },
        { on: 'prompt:konpers', lock: 'ya', target: '#prompt', text: '<b>Konferensi Pers</b>: Citra +2 dan target lebih sulit menang. Tapi kalau tersangka akhirnya "diamankan" (Setor/Istana), Citra −3. Pamerkan!' },
        { on: 'prompt:ott', target: '#prompt', text: 'Angka Fantastis menambah Sorotan, dan Sorotanmu menyentuh 10: <b>OTT!</b> Pilih cara lolos. Backing menyelamatkan, dan hampir tidak ada jaksa yang benar-benar tertangkap.' },
        { on: 'prompt:aset_jaksa', target: '#prompt', text: 'Di akhir giliran kamu boleh <b>Beli Aset</b>: Cuan jadi rumah atas nama ipar atau moge (potong 20%). Aset aman dari OTT, tapi <b>pamer harta</b> membuat Sorotan +1. Terserah kamu.' },
        { on: 'end', target: '#jaksa', text: 'Dilema Jaksa: <b>uang</b> datang dari melepas tersangka, <b>Citra</b> datang dari menghukumnya. Tidak bisa dua-duanya dari target yang sama.<br><br>🎉 <b>Tutorial selesai!</b> Coba <b>Latihan vs Bot</b> atau ajak teman di <b>Main Online</b>.' },
      ],
    },
  ];

  const api = { CHAPTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GBTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
