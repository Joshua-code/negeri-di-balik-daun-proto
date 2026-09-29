/* Tutorial Dari Gerobak (3 bab). Dijalankan dengan Tutorial.runChapter(ch, DariGerobak, hooks) dari tutorial.js.
 * Format langkah sama dengan tutorial.js (on: 'start' | 'end' | 'event:<type>' | 'prompt:<kind>', target, text, lock).
 * Untuk prompt `pick` (rencana), lock berupa array id yang wajib dipilih.
 */
(function (root) {
  'use strict';
  const meja = (human) => ['Bu Ratna 🤖', 'Pak Karyo 🤖', 'Mas Doni 🤖', 'Mbak Lia 🤖'].map((name, seat) => (seat === human ? { name: 'Kamu', bot: false, mimpi: 'sarjana' } : { name, bot: true }));
  const mainLot = (S, seat) => S.lots[S.p[seat].lots[0]];

  const CHAPTERS = [
    {
      id: 1, title: 'Dari Gerobak', human: 0, players: meja(0), putaran: 1,
      script: { kabar: [8], ancaman: [{ seat: 2, jenis: 'razia' }, { seat: 3, jenis: 'razia' }], strat: { 1: 'jujur', 2: 'kolusi', 3: 'jujur' } },
      expect: ['prompt:rencana', 'event:bangun', 'prompt:tagihan'],
      steps: [
        { on: 'start', text: 'Selamat datang di <b>Jalan Daun</b>. Kamu, pasanganmu, dan anakmu merintis usaha <b>dari sebuah gerobak</b>. Satu tahun (12 bulan) ke depan, bangun usahamu sambil menjaga keluarga. Tapi hati-hati: aparat di negeri ini punya tarif.' },
        { on: 'start', target: '#keluarga', text: 'Ini <b>keluargamu</b>. Semua orang di sini punya nama. Mereka bergantung padamu. Di bawahnya ada <b>Mimpi</b> keluarga: anak jadi sarjana. Mimpi diisi lewat <b>celengan 🐷</b> sedikit demi sedikit.' },
        { on: 'start', target: '#jalan', text: 'Ini <b>Jalan Daun</b>. Usahamu bertetangga dengan usaha pemain lain dan warga. Usaha yang ramai di sebelahmu memberi <b>+1 pembeli</b>. Kalau tetanggamu disegel, kamu ikut sepi.' },
        { on: 'prompt:rencana', lock: ['bangun', 'izin_resmi'], target: '#prompt', text: 'Setiap bulan semua pemain memilih <b>2 rencana</b> bersamaan. Bangun gerobakmu jadi <b>Warung</b>, lalu mulai urus <b>izin Toko</b> lewat jalur resmi (gratis, tapi 2 bulan, dan berkasnya bisa "hilang"). Pilih keduanya lalu tekan Konfirmasi.' },
        { on: 'event:bangun', target: '#jalan', text: 'Warungmu berdiri! Setiap kavling menyimpan <b>kenangan 📜</b>: kapan dibuka, siapa yang ikut jaga, apa yang menimpanya. Tap kavling untuk membacanya.' },
        { on: 'event:produksi', target: '#keluarga', text: 'Akhir bulan: usaha menghasilkan <b>Daun 🍃</b>. Warung +5, ditambah tetangga yang ramai dan karyawan.' },
        { on: 'prompt:tagihan', target: '#prompt', text: 'Lalu <b>tagihan keluarga</b>. Biaya hidup dan gaji wajib dibayar. Tagihan lain boleh kamu pilih, tapi yang tidak dibayar punya akibat: anak bolos, ibu sakit, motor mogok. <b>Celengan</b> mengisi Mimpi. Uangnya tidak pernah cukup untuk semuanya. Pilih sesukamu.' },
        { on: 'end', text: 'Di akhir tahun, <b>Kekayaan</b> = Daun + nilai usaha + celengan & mimpi. Kekayaan itu dikonversi jadi <b>Dana Offshore</b> untuk dompetmu di Negeri di Balik Daun.<br><br>Bab 1 selesai!' },
      ],
    },
    {
      id: 2, title: 'Digerebek', human: 0, players: meja(0), putaran: 1,
      script: { kabar: [8], ancaman: [{ seat: 0, jenis: 'sidak' }, { seat: 3, jenis: 'razia' }], dadu: [4, 6], strat: { 1: 'jujur', 2: 'kolusi', 3: 'jujur' } },
      setup(S) {
        const p = S.p[0];
        Object.assign(p, { daun: 9, izin: 1, rekaman: 1, karyawan: [{ nama: 'Siti', trait: 'setia', sejak: 0 }] });
        mainLot(S, 0).level = 2;
        mainLot(S, 0).mem.push({ t: 0, text: '🏬 Toko dibuka sebelum izinnya jadi. Siti ikut jaga.' });
        Object.assign(S.p[1], { daun: 10, rekaman: 1 });
      },
      expect: ['prompt:rencana', 'event:ancaman', 'prompt:sidak', 'event:karet'],
      steps: [
        { on: 'start', target: '#jalan', text: 'Bab 2. Kamu nekat membangun <b>Toko</b> sebelum izinnya jadi (tanda ⚠️). Cepat untung, tapi usaha tanpa izin jadi incaran <b>sidak</b> dan <b>penggusuran</b>.' },
        { on: 'prompt:rencana', lock: ['jualan', 'izin_resmi'], target: '#prompt', text: 'Jualan keras untuk tambahan Daun, dan urus izin Toko lewat jalur resmi.' },
        { on: 'event:ancaman', target: '#jalan', text: '<b>Mata Aparat</b> bergerak. Tiap bulan aparat mendatangi beberapa usaha. Usaha besar, tanpa izin, atau yang "berisik" paling sering didatangi. Pemain lain boleh <b>membantu</b>: patungan, meminjamkan rekaman, atau jadi saksi.' },
        { on: 'prompt:sidak', lock: 'viral', target: '#prompt', text: 'Sidak! Pilihanmu: bayar <b>uang damai</b> (cepat, tapi uangnya ke oknum dan kamu jadi "langganan"), <b>viralkan</b> (gratis, tapi berisiko dilaporkan balik), atau <b>biarkan disegel</b> (usaha berhenti 2 bulan dan karyawan bisa dirumahkan). Coba <b>Viralkan</b>.' },
        { on: 'event:karet', target: '#log', text: 'Setelah memviralkan, kamu melempar dadu <b>Pasal Karet</b>: 1–3 = kamu dilaporkan balik dan ditahan. Kali ini aman. Tapi aparat <b>mencatatmu</b>: selama 2 bulan kamu lebih sering didatangi.' },
        { on: 'end', text: 'Tidak ada yang hilang untuk selamanya: usaha yang digusur meninggalkan <b>fondasi</b> sehingga membangun ulang lebih murah. Tapi setiap kejadian tercatat di kenangan kavlingmu dan di <b>Kisah</b> akhir tahun.<br><br>Bab 2 selesai!' },
      ],
    },
    {
      id: 3, title: 'Masuk Sistem', human: 0, players: meja(0), putaran: 1,
      script: { kabar: [8], ancaman: [{ seat: 1, jenis: 'sidak' }, { seat: 2, jenis: 'razia' }, { seat: 3, jenis: 'razia' }], strat: { 1: 'kolusi', 2: 'kolusi', 3: 'jujur' } },
      setup(S) {
        const p = S.p[0];
        Object.assign(p, { daun: 12, izin: 2, jabatan: 'kasi', jabatanSejak: 1, sorotan: 3 });
        p.catat.pejabat = 1; S.jabatan.kasi = 0;
        mainLot(S, 0).level = 2;
        Object.assign(S.p[1], { daun: 14, izin: 1 }); mainLot(S, 1).level = 2;
      },
      expect: ['prompt:rencana', 'prompt:pilih_target', 'prompt:tagihan'],
      steps: [
        { on: 'start', target: '#keluarga', text: 'Bab 3. Setelah bertahun-tahun digerebek, kamu memilih jalan lain: kamu membeli jabatan <b>📋 Kasi Perizinan</b>. Tokomu kini dijaga pasanganmu sendirian (produksi −1). Tapi usahamu kebal sidak, dan kamu menerima <b>tunjangan</b>.' },
        { on: 'prompt:rencana', lock: ['jualan', 'rekam'], target: '#prompt', text: 'Pejabat tetap memilih rencana seperti biasa. Kalau sudah tidak tahan, ada pilihan <b>Mundur</b>.' },
        { on: 'prompt:pilih_target', lock: 0, target: '#prompt', text: 'Setiap bulan kamu <b>memilih siapa yang "ditertibkan"</b> dari dua usaha yang disodorkan sistem. Uang damainya masuk kantongmu, <b>dua kali lipat</b> tarif biasa. Pilih tetanggamu yang Tokonya belum berizin.' },
        { on: 'prompt:tagihan', target: '#prompt', text: 'Sebagai pejabat, celengan mimpi hanya bertambah setengah: tidak ada waktu untuk keluarga. Setiap bulan kamu juga wajib <b>setor ke atasan</b>, dan jumlahnya makin besar.' },
        { on: 'end', target: '#keluarga', text: 'Setiap setoran menaikkan <b>Sorotan</b>-mu. Sorotan 10 = <b>OTT</b>: dicopot, separuh Daun disita. Tetangga yang kamu peras juga bisa memviralkanmu.<br><br>🎉 <b>Tutorial selesai!</b> Coba <b>Latihan vs Bot</b> atau ajak teman di <b>Main Online</b>.' },
      ],
    },
  ];

  const api = { CHAPTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DGTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
