const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const midtransClient = require('midtrans-client');

// Inisialisasi Midtrans Core API / Snap
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || 'Rahasia',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'Rahasia'
});

// Buat folder uploads jika belum ada
const uploadsDir = './public/uploads/paket';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadsBahanDir = './public/uploads/bahan-baku';
if (!fs.existsSync(uploadsBahanDir)) {
    fs.mkdirSync(uploadsBahanDir, { recursive: true });
}

// Konfigurasi multer untuk upload gambar paket
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'paket-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Konfigurasi multer untuk upload gambar bahan baku
const storageBahan = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsBahanDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bahan-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadBahan = multer({
    storage: storageBahan,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
        }
    }
});
const app = express();

// 1. Konfigurasi Database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'databaseprma-rev-2'
});

// Cek koneksi database
db.connect((err) => {
    if (err) {
        console.error('❌ Gagal koneksi ke database:', err);
    } else {
        console.log('✅ Berhasil koneksi ke databaseprma!');
        // Cek dan tambahkan kolom sumber ke tabel pembelian_bahan jika belum ada
        db.query("SHOW COLUMNS FROM `pembelian_bahan` LIKE 'sumber'", (colErr, rows) => {
            if (!colErr && rows && rows.length === 0) {
                db.query("ALTER TABLE `pembelian_bahan` ADD COLUMN `sumber` VARCHAR(50) DEFAULT 'Prediksi'", (alterErr) => {
                    if (alterErr) {
                        console.error('❌ Error tambah kolom sumber ke pembelian_bahan:', alterErr);
                    } else {
                        console.log('✅ Kolom sumber berhasil ditambahkan ke pembelian_bahan!');
                    }
                });
            }
        });

        // Pastikan kolom status di pre_order mendukung tipe VARCHAR(50) termasuk nilai 'hangus'
        db.query("ALTER TABLE `pre_order` MODIFY COLUMN `status` VARCHAR(50) DEFAULT 'pending'", (alterErr) => {
            if (alterErr) {
                console.error('❌ Error update kolom status pre_order:', alterErr);
            } else {
                console.log('✅ Kolom status pre_order berhasil disesuaikan!');
                // Perbaiki data lama yang bernilai kosong/batal jika status_pembayaran = 'hangus'
                db.query("UPDATE `pre_order` SET `status` = 'hangus' WHERE (`status` = '' OR `status` IS NULL OR `status` = 'batal') AND `status_pembayaran` = 'hangus'");
            }
        });
    }
});

// 2. Setting Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'rahasia-rumah-makan-apel',
    resave: false,
    saveUninitialized: true
}));



// ============================================
// FUNGSI HELPER: KURANGI STOK BAHAN BAKU
// ============================================
function kurangiStokBahanBaku(penjualan_id, callback) {
    // 1. Ambil semua menu yang terjual dalam penjualan ini
    const queryDetail = `
        SELECT dp.menu_id, dp.jumlah_porsi 
        FROM detail_penjualan dp 
        WHERE dp.penjualan_id = ?
    `;

    db.query(queryDetail, [penjualan_id], (err, detailResults) => {
        if (err) {
            console.error(' Error ambil detail penjualan:', err);
            return callback(err);
        }

        if (detailResults.length === 0) {
            return callback(null);
        }

        // 2. Untuk setiap menu, ambil resep (bahan + jumlah)
        const queryResep = `
            SELECT r.bahan_id, r.jumlah_butuh 
            FROM resep r 
            WHERE r.menu_id = ?
        `;

        let totalBahan = {};
        let processedMenus = 0;

        detailResults.forEach(detail => {
            db.query(queryResep, [detail.menu_id], (err, resepResults) => {
                if (err) {
                    console.error('❌ Error ambil resep:', err);
                } else {
                    resepResults.forEach(resep => {
                        const bahanId = resep.bahan_id;
                        const totalButuh = parseFloat(resep.jumlah_butuh) * parseInt(detail.jumlah_porsi);

                        if (!totalBahan[bahanId]) {
                            totalBahan[bahanId] = 0;
                        }
                        totalBahan[bahanId] += totalButuh;
                    });
                }

                processedMenus++;

                // 3. Setelah semua menu diproses, update stok
                if (processedMenus === detailResults.length) {
                    console.log(' Total bahan yang dibutuhkan:', totalBahan);

                    const bahanIds = Object.keys(totalBahan);
                    let updatedStocks = 0;

                    bahanIds.forEach(bahanId => {
                        const totalKurang = totalBahan[bahanId];

                        const queryUpdateStok = `
                            UPDATE stok_bahan 
                            SET stok_tersedia = stok_tersedia - ? 
                            WHERE bahan_id = ?
                        `;

                        db.query(queryUpdateStok, [totalKurang, bahanId], (err) => {
                            if (err) {
                                console.error('❌ Error update stok bahan:', err);
                            } else {
                                console.log(`✅ Stok bahan ${bahanId} dikurangi ${totalKurang}`);
                            }

                            updatedStocks++;
                            if (updatedStocks === bahanIds.length) {
                                callback(null);
                            }
                        });
                    });
                }
            });
        });
    });
}

// ============================================
// 4. ROUTE LOGIN UNIVERSAL (PEMILIK & PELANGGAN)
// ============================================
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';

    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Error query database:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan di server' });
        }

        if (results.length > 0) {
            // Simpan data user ke session
            req.session.user = {
                id: results[0].id_user,
                username: results[0].username,
                role: results[0].role
            };

            console.log('✅ Login berhasil:', username, '| Role:', results[0].role);

            // Tentukan tujuan redirect
            let redirectUrl = '/login.html';
            if (results[0].role === 'pemilik') {
                redirectUrl = '/dashboard-pemilik';
            } else if (results[0].role === 'pelanggan') {
                redirectUrl = '/dashboard-pelanggan';
            }

            // KIRIM SEBAGAI JSON, BUKAN REDIRECT LANGSUNG
            res.json({ success: true, redirect: redirectUrl });
        } else {
            console.log('❌ Login gagal: username atau password salah');
            res.status(401).json({ success: false, message: 'Username atau password salah!' });
        }
    });
});

// ============================================
// 5. ROUTE DASHBOARD PELANGGAN
// ============================================

// API untuk ambil info user yang sedang login
app.get('/api/user-info', (req, res) => {
    if (req.session.user) {
        res.json({
            username: req.session.user.username,
            role: req.session.user.role
        });
    } else {
        res.status(401).json({ error: 'Belum login' });
    }
});

// Route untuk menampilkan halaman dashboard pelanggan
app.get('/dashboard-pelanggan', (req, res) => {
    if (req.session.user && req.session.user.role === 'pelanggan') {
        res.sendFile(__dirname + '/public/dashboard-pelanggan.html');
    } else {
        res.redirect('/login.html');
    }
});

// ============================================
// 6. ROUTE DASHBOARD PEMILIK
// ============================================

// Route untuk menampilkan halaman dashboard pemilik
app.get('/dashboard-pemilik', (req, res) => {
    if (req.session.user && req.session.user.role === 'pemilik') {
        res.sendFile(__dirname + '/public/dashboard-pemilik.html');
    } else {
        res.redirect('/login.html');
    }
});

// ============================================
// 7. ROUTE PENDAFTARAN PELANGGAN
// ============================================
app.post('/daftar-pelanggan', (req, res) => {
    const nama = req.body.nama;
    const alamat = req.body.alamat;
    const no_hp = req.body.no_hp;
    const username = req.body.username;
    const password = req.body.password;

    // Query 1: Simpan ke tabel users
    const queryUsers = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';

    db.query(queryUsers, [username, password, 'pelanggan'], (err, results) => {
        if (err) {
            console.error('Error simpan ke users:', err);
            res.send('Terjadi kesalahan saat mendaftar');
            return;
        }

        // Ambil id_user yang baru dibuat
        const id_user = results.insertId;

        // Query 2: Simpan ke tabel detail_pelanggan
        const queryDetail = 'INSERT INTO detail_pelanggan (id_user, nama_pelanggan, no_hp, alamat) VALUES (?, ?, ?, ?)';

        db.query(queryDetail, [id_user, nama, no_hp, alamat], (err, results) => {
            if (err) {
                console.error('Error simpan ke detail_pelanggan:', err);
                res.send('Terjadi kesalahan saat menyimpan data detail');
                return;
            }

            console.log('Pendaftaran berhasil:', username);
            // Kirim respon JSON sukses
            res.json({ success: true, message: 'Akun berhasil didaftarkan' });
        });
    });
});

// ============================================
// 8. API UNTUK DASHBOARD DATA
// ============================================

// API untuk ambil data dashboard (ringkasan pesanan + paket tersedia)
app.get('/api/dashboard-data', (req, res) => {
    // Cek apakah user sudah login
    if (!req.session.user || req.session.user.role !== 'pelanggan') {
        return res.status(401).json({ error: 'Belum login' });
    }

    const id_user = req.session.user.id;

    // Query 1: Ambil id_pelanggan dari detail_pelanggan
    const queryPelanggan = 'SELECT id_pelanggan FROM detail_pelanggan WHERE id_user = ?';

    db.query(queryPelanggan, [id_user], (err, pelangganResults) => {
        if (err || pelangganResults.length === 0) {
            console.error('Error mengambil data pelanggan:', err);
            return res.status(500).json({ error: 'Data pelanggan tidak ditemukan' });
        }

        const id_pelanggan = pelangganResults[0].id_pelanggan;

        // Query 2: Hitung jumlah pesanan per status
        const queryRingkasan = `
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'diterima' THEN 1 ELSE 0 END) as diterima,
                SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) as ditolak
            FROM pre_order
            WHERE id_pelanggan = ?
        `;

        db.query(queryRingkasan, [id_pelanggan], (err, ringkasanResults) => {
            if (err) {
                console.error('Error menghitung ringkasan:', err);
                return res.status(500).json({ error: 'Gagal mengambil ringkasan' });
            }

            const ringkasan = ringkasanResults[0] || { pending: 0, diterima: 0, ditolak: 0 };

            // Query 3: Ambil pesanan terbaru yang AKTIF (mengabaikan status ditolak/hangus/batal)
            const queryPesananTerbaru = `
                SELECT po.*, p.nama_paket, p.harga_per_porsi
                FROM pre_order po
                LEFT JOIN paket p ON po.paket_id = p.id_paket
                WHERE po.id_pelanggan = ?
                  AND po.status NOT IN ('ditolak', 'hangus', 'batal')
                  AND (po.status_pembayaran IS NULL OR po.status_pembayaran != 'hangus')
                ORDER BY po.created_at DESC
                LIMIT 1
            `;

            db.query(queryPesananTerbaru, [id_pelanggan], (err, pesananResults) => {
                if (err) {
                    console.error('Error mengambil pesanan terbaru:', err);
                }

                const pesananTerbaru = (pesananResults && pesananResults.length > 0) ? pesananResults[0] : null;

                // Query 4: Ambil semua paket yang tersedia DENGAN KOMPOSISI MENU
                const queryPaket = 'SELECT * FROM paket WHERE is_available = 1';

                db.query(queryPaket, (err, paketResults) => {
                    if (err) {
                        console.error('Error mengambil paket:', err);
                        paketResults = [];
                    }

                    // Query untuk ambil komposisi menu per paket
                    const queryKomposisi = `
                        SELECT m.nama_menu 
                        FROM komposisi_paket kp
                        JOIN menu m ON kp.menu_id = m.id_menu
                        WHERE kp.paket_id = ?
                    `;

                    const selesaiKirim = () => {
                        return res.json({
                            ringkasan: {
                                pending: parseInt(ringkasan.pending) || 0,
                                diterima: parseInt(ringkasan.diterima) || 0,
                                ditolak: parseInt(ringkasan.ditolak) || 0
                            },
                            pesananTerbaru: pesananTerbaru,
                            paketTersedia: paketResults
                        });
                    };

                    const fetchPesananKomposisi = (cb) => {
                        if (pesananTerbaru && pesananTerbaru.paket_id) {
                            db.query(queryKomposisi, [pesananTerbaru.paket_id], (err, menuRes) => {
                                if (!err && menuRes) {
                                    pesananTerbaru.isi_menu_detail = menuRes.map(m => m.nama_menu);
                                    pesananTerbaru.isi_menu = menuRes.map(m => m.nama_menu).join(', ');
                                }
                                cb();
                            });
                        } else {
                            cb();
                        }
                    };

                    // Proses setiap paket untuk tambahkan daftar menu
                    const prosesPaket = (index) => {
                        if (index >= paketResults.length) {
                            fetchPesananKomposisi(selesaiKirim);
                            return;
                        }

                        const paket = paketResults[index];

                        db.query(queryKomposisi, [paket.id_paket], (err, menuResults) => {
                            if (err) {
                                console.error('Error mengambil komposisi:', err);
                            }

                            // Simpan daftar menu ke dalam objek paket
                            paket.menus = menuResults ? menuResults.map(m => m.nama_menu) : [];

                            prosesPaket(index + 1);
                        });
                    };

                    prosesPaket(0);
                });
            });
        });
    });
});

// ============================================
// 9. API UNTUK HALAMAN BELI PAKET
// ============================================

// API untuk ambil semua paket yang tersedia (dengan komposisi menu)
app.get('/api/paket-tersedia', (req, res) => {
    const query = 'SELECT * FROM paket WHERE is_available = 1 ORDER BY harga_per_porsi ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil paket:', err);
            return res.status(500).json({ error: 'Gagal mengambil data paket' });
        }

        // Query untuk ambil komposisi menu per paket
        const queryKomposisi = `
            SELECT m.nama_menu 
            FROM komposisi_paket kp
            JOIN menu m ON kp.menu_id = m.id_menu
            WHERE kp.paket_id = ?
        `;

        // Proses setiap paket untuk tambahkan daftar menu
        const prosesPaket = (index) => {
            if (index >= results.length) {
                return res.json(results);
            }

            const paket = results[index];

            db.query(queryKomposisi, [paket.id_paket], (err, menuResults) => {
                if (err) {
                    console.error('Error mengambil komposisi:', err);
                }

                // Simpan daftar menu ke dalam objek paket
                paket.menus = menuResults.map(m => m.nama_menu);

                prosesPaket(index + 1);
            });
        };

        prosesPaket(0);
    });
});

// API untuk membuat pesanan baru
app.post('/api/buat-pesanan', (req, res) => {
    // Cek apakah user sudah login
    if (!req.session.user || req.session.user.role !== 'pelanggan') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const id_user = req.session.user.id;
    const { paket_id, jumlah_porsi, jadwal_ambil } = req.body;

    // Validasi input
    if (!paket_id || !jumlah_porsi || !jadwal_ambil) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    const porsiVal = parseInt(jumlah_porsi) || 0;

    // Validasi batas porsi pemesanan (maksimal 150 porsi)
    if (porsiVal > 150) {
        return res.status(400).json({
            success: false,
            message: 'Pemesanan anda melewati batas pemesanan'
        });
    }

    if (porsiVal < 1) {
        return res.status(400).json({
            success: false,
            message: 'Jumlah porsi tidak valid'
        });
    }

    // Validasi lead-time tanggal pengambilan (H+2 untuk <50 porsi, H+5 untuk >=50 porsi)
    const leadDays = porsiVal < 50 ? 2 : 5;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() + leadDays);

    const targetDateObj = new Date(jadwal_ambil);
    targetDateObj.setHours(0, 0, 0, 0);

    if (targetDateObj < minDateObj) {
        const formattedMinDate = minDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        return res.status(400).json({
            success: false,
            message: `Pesanan ${porsiVal} porsi memerlukan waktu persiapan minimal ${leadDays} hari (Paling awal: ${formattedMinDate}).`
        });
    }

    // Query 1: Ambil id_pelanggan dari detail_pelanggan
    const queryPelanggan = 'SELECT id_pelanggan FROM detail_pelanggan WHERE id_user = ?';

    db.query(queryPelanggan, [id_user], (err, pelangganResults) => {
        if (err || pelangganResults.length === 0) {
            console.error('Error mengambil data pelanggan:', err);
            return res.status(500).json({ success: false, message: 'Data pelanggan tidak ditemukan' });
        }

        const id_pelanggan = pelangganResults[0].id_pelanggan;

        // Ambil harga_per_porsi dari tabel paket
        db.query('SELECT harga_per_porsi FROM paket WHERE id_paket = ?', [paket_id], (err, paketResults) => {
            if (err || paketResults.length === 0) {
                console.error('Error mengambil data paket:', err);
                return res.status(500).json({ success: false, message: 'Paket tidak ditemukan' });
            }

            const harga_per_porsi = parseFloat(paketResults[0].harga_per_porsi);
            const total_harga = harga_per_porsi * jumlah_porsi;

            // Query 2: Simpan pesanan ke tabel pre_order beserta total_harga
            const queryPesanan = `
                INSERT INTO pre_order (id_pelanggan, paket_id, jumlah_porsi, jadwal_ambil, status, total_harga)
                VALUES (?, ?, ?, ?, 'pending', ?)
            `;

            db.query(queryPesanan, [id_pelanggan, paket_id, jumlah_porsi, jadwal_ambil, total_harga], (err, results) => {
                if (err) {
                    console.error('Error menyimpan pesanan:', err);
                    return res.status(500).json({ success: false, message: 'Gagal menyimpan pesanan' });
                }

                console.log('Pesanan berhasil dibuat:', results.insertId);
                res.json({
                    success: true,
                    message: 'Pesanan berhasil dibuat',
                    id_pre_order: results.insertId
                });
            });
        });
    });
});

// ============================================
// 10. API UNTUK BATALKAN PESANAN
// ============================================

// API untuk membatalkan pesanan (sesuai alur diagram)
app.post('/api/batalkan-pesanan', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pelanggan') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const { id_pre_order } = req.body;

    if (!id_pre_order) {
        return res.status(400).json({ success: false, message: 'ID pesanan tidak valid' });
    }

    db.query('SELECT status, status_pembayaran, jumlah_dp FROM pre_order WHERE id_pre_order = ?', [id_pre_order], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ success: false, message: 'Pesanan tidak ditemukan' });
        }

        const currentStatus = results[0].status;
        const statusPembayaran = results[0].status_pembayaran;
        const jumlahDp = parseFloat(results[0].jumlah_dp || 0);

        let newStatus = 'ditolak';
        let newStatusPembayaran = statusPembayaran;

        if (statusPembayaran === 'dp_lunas' || currentStatus === 'diproduksi' || currentStatus === 'menunggu_pelunasan' || (jumlahDp > 0 && currentStatus !== 'pending')) {
            // Pelanggan batal saat diproduksi / tidak bayar pelunasan / sudah bayar DP -> DP 50% awal hangus
            newStatus = 'hangus';
            newStatusPembayaran = 'hangus';
        } else if (currentStatus === 'pending' || currentStatus === 'menunggu_dp') {
            newStatus = 'ditolak';
        } else {
            return res.status(400).json({ success: false, message: 'Pesanan sudah tidak dapat dibatalkan' });
        }

        const query = 'UPDATE pre_order SET status = ?, status_pembayaran = ? WHERE id_pre_order = ?';
        db.query(query, [newStatus, newStatusPembayaran, id_pre_order], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Gagal membatalkan pesanan' });
            res.json({
                success: true,
                message: newStatus === 'hangus'
                    ? 'Pesanan dibatalkan. Sesuai ketentuan, DP 50% awal hangus (menjadi milik Pemilik).'
                    : 'Pesanan berhasil dibatalkan'
            });
        });
    });
});

// ============================================
// 11. API UNTUK RIWAYAT PESANAN
// ============================================

// API untuk ambil semua riwayat pesanan user
app.get('/api/riwayat-pesanan', (req, res) => {
    // Cek apakah user sudah login
    if (!req.session.user || req.session.user.role !== 'pelanggan') {
        return res.status(401).json({ error: 'Belum login' });
    }

    const id_user = req.session.user.id;

    // Query 1: Ambil id_pelanggan
    const queryPelanggan = 'SELECT id_pelanggan FROM detail_pelanggan WHERE id_user = ?';

    db.query(queryPelanggan, [id_user], (err, pelangganResults) => {
        if (err || pelangganResults.length === 0) {
            console.error('Error mengambil data pelanggan:', err);
            return res.status(500).json({ error: 'Data pelanggan tidak ditemukan' });
        }

        const id_pelanggan = pelangganResults[0].id_pelanggan;

        // Query 2: Ambil semua pesanan user dengan info paket
        const queryPesanan = `
            SELECT po.*, p.nama_paket, p.harga_per_porsi
            FROM pre_order po
            LEFT JOIN paket p ON po.paket_id = p.id_paket
            WHERE po.id_pelanggan = ?
            ORDER BY po.created_at DESC
        `;

        db.query(queryPesanan, [id_pelanggan], (err, pesananResults) => {
            if (err) {
                console.error('Error mengambil riwayat pesanan:', err);
                return res.status(500).json({ error: 'Gagal mengambil riwayat pesanan' });
            }

            // Untuk setiap pesanan, ambil komposisi menu
            const queryKomposisi = `
                SELECT m.nama_menu 
                FROM komposisi_paket kp
                JOIN menu m ON kp.menu_id = m.id_menu
                WHERE kp.paket_id = ?
            `;

            // Proses setiap pesanan untuk tambahkan isi menu
            const prosesPesanan = (index) => {
                if (index >= pesananResults.length) {
                    return res.json(pesananResults);
                }

                const pesanan = pesananResults[index];

                if (pesanan.paket_id) {
                    db.query(queryKomposisi, [pesanan.paket_id], (err, menuResults) => {
                        if (err) {
                            console.error('Error mengambil komposisi:', err);
                        }

                        // Simpan isi menu sebagai array dan string
                        pesanan.isi_menu_detail = menuResults.map(m => m.nama_menu);
                        pesanan.isi_menu = menuResults.map(m => m.nama_menu).join(', ');

                        prosesPesanan(index + 1);
                    });
                } else {
                    pesanan.isi_menu_detail = [];
                    pesanan.isi_menu = 'N/A';
                    prosesPesanan(index + 1);
                }
            };

            prosesPesanan(0);
        });
    });
});

// ============================================
// ROUTE LOGOUT
// ============================================
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error saat logout:', err);
            return res.status(500).json({ success: false, message: 'Gagal logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logout berhasil' });
    });
});

// ============================================
// 12. API UNTUK DASHBOARD PEMILIK
// ============================================

app.get('/api/dashboard-pemilik-data', (req, res) => {
    // Cek apakah user sudah login sebagai pemilik
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const data = {};

    // Query 1 & 2: Total Omzet 7 Hari Terakhir & Breakdown Penjualan Langsung + Pre-Order
    const queryOmzet7Hari = `
        SELECT 
            COALESCE(SUM(total_harga), 0) AS total_omzet,
            COALESCE(SUM(CASE WHEN sumber != 'preorder' OR sumber IS NULL THEN total_harga ELSE 0 END), 0) AS total_langsung,
            COALESCE(SUM(CASE WHEN sumber = 'preorder' THEN total_harga ELSE 0 END), 0) AS total_preorder
        FROM penjualan
        WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    `;

    const queryPreorder7Hari = `
        SELECT COALESCE(SUM(po.jumlah_porsi * p.harga_per_porsi), 0) AS total_po
        FROM pre_order po
        JOIN paket p ON po.paket_id = p.id_paket
        WHERE po.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND po.status IN ('diproduksi', 'siap_diambil', 'lunas', 'selesai', 'dp_dibayar')
    `;

    // Query 3: Bahan yang Harus Dibeli (stok <= stok minimal)
    const queryBahanHarusDibeli = `
        SELECT bb.nama_bahan, bb.satuan, s.stok_tersedia, s.stok_minimal
        FROM stok_bahan s
        JOIN bahan_baku bb ON s.bahan_id = bb.id_bahan
        WHERE s.stok_tersedia <= s.stok_minimal
        ORDER BY (s.stok_minimal - s.stok_tersedia) DESC
        LIMIT 5
    `;

    // Query 4: Top Menu (dari detail_penjualan)
    const queryTopMenu = `
        SELECT m.nama_menu, SUM(dp.jumlah_porsi) as jumlah
        FROM detail_penjualan dp
        JOIN menu m ON dp.menu_id = m.id_menu
        GROUP BY dp.menu_id, m.nama_menu
        ORDER BY jumlah DESC
        LIMIT 3
    `;

    // Query 5: Statistik Penjualan per Minggu (bulan ini)
    const queryStatistikPenjualan = `
        SELECT 
            CONCAT('Minggu ke-', WEEK(tanggal) - WEEK(DATE_SUB(tanggal, INTERVAL DAYOFMONTH(tanggal)-1 DAY)) + 1) as label,
            SUM(total_harga) as value
        FROM penjualan
        WHERE MONTH(tanggal) = MONTH(CURDATE())
        AND YEAR(tanggal) = YEAR(CURDATE())
        GROUP BY WEEK(tanggal)
        ORDER BY WEEK(tanggal)
    `;

    // Query 6: Statistik Pre-Order per Minggu (bulan ini)
    const queryStatistikPreorder = `
        SELECT 
            CONCAT('Minggu ke-', WEEK(created_at) - WEEK(DATE_SUB(created_at, INTERVAL DAYOFMONTH(created_at)-1 DAY)) + 1) as label,
            COUNT(*) as value
        FROM pre_order
        WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at) = YEAR(CURDATE())
        GROUP BY WEEK(created_at)
        ORDER BY WEEK(created_at)
    `;

    // Query 7: Daftar Pre-Order Terbaru
    const queryDaftarPreorder = `
        SELECT po.id_pre_order, dp.nama_pelanggan, p.nama_paket, po.jumlah_porsi, po.status
        FROM pre_order po
        LEFT JOIN detail_pelanggan dp ON po.id_pelanggan = dp.id_pelanggan
        LEFT JOIN paket p ON po.paket_id = p.id_paket
        ORDER BY po.created_at DESC
        LIMIT 10
    `;

    // Eksekusi semua query
    db.query(queryOmzet7Hari, (err, results) => {
        if (err) {
            console.error('Error query omzet 7 hari:', err);
            data.totalOmzetMinggu = 0;
            data.totalPenjualanLangsung = 0;
            data.totalPreorder = 0;
        } else {
            const resData = results[0] || {};
            data.totalPenjualanLangsung = parseFloat(resData.total_langsung || 0);
            data.totalPreorder = parseFloat(resData.total_preorder || 0);
        }

        db.query(queryPreorder7Hari, (errPO, resultsPO) => {
            let preFromTable = 0;
            if (!errPO && resultsPO && resultsPO.length > 0) {
                preFromTable = parseFloat(resultsPO[0].total_po || 0);
            }
            data.totalPreorder = Math.max(data.totalPreorder || 0, preFromTable);
            data.totalOmzetMinggu = (data.totalPenjualanLangsung || 0) + data.totalPreorder;
            data.totalPenjualanHariIni = data.totalOmzetMinggu;
            data.perubahanPenjualan = 0;

            db.query(queryBahanHarusDibeli, (err3, results3) => {
                if (err3) {
                    console.error('Error query bahan:', err3);
                    data.bahanHarusDibeli = [];
                } else {
                    data.bahanHarusDibeli = results3;
                }

                db.query(queryTopMenu, (err4, results4) => {
                    if (err4) {
                        console.error('Error query top menu:', err4);
                        data.topMenu = [];
                    } else {
                        data.topMenu = results4;
                    }

                    db.query(queryStatistikPenjualan, (err5, results5) => {
                        if (err5) {
                            console.error('Error query statistik penjualan:', err5);
                            data.statistikPenjualan = [];
                        } else {
                            data.statistikPenjualan = results5;
                        }

                        db.query(queryStatistikPreorder, (err6, results6) => {
                            if (err6) {
                                console.error('Error query statistik preorder:', err6);
                                data.statistikPreorder = [];
                            } else {
                                data.statistikPreorder = results6;
                            }

                            db.query(queryDaftarPreorder, (err7, results7) => {
                                if (err7) {
                                    console.error('Error query daftar preorder:', err7);
                                    data.daftarPreorder = [];
                                } else {
                                    data.daftarPreorder = results7;
                                }

                                // Kirim semua data ke frontend
                                res.json(data);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ============================================
// 13. API UNTUK PRE-ORDER PEMILIK
// ============================================

// API untuk ambil semua pre-order dengan info pelanggan dan paket
app.get('/api/pre-order-pemilik-data', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const query = `
        SELECT po.*, dp.nama_pelanggan, dp.no_hp, dp.alamat, 
               p.nama_paket, p.harga_per_porsi
        FROM pre_order po
        LEFT JOIN detail_pelanggan dp ON po.id_pelanggan = dp.id_pelanggan
        LEFT JOIN paket p ON po.paket_id = p.id_paket
        ORDER BY po.created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil pre-order:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }

        // Untuk setiap pesanan, ambil komposisi menu
        const queryKomposisi = `
            SELECT m.nama_menu 
            FROM komposisi_paket kp
            JOIN menu m ON kp.menu_id = m.id_menu
            WHERE kp.paket_id = ?
        `;

        const prosesPesanan = (index) => {
            if (index >= results.length) {
                return res.json(results);
            }

            const pesanan = results[index];

            if (pesanan.paket_id) {
                db.query(queryKomposisi, [pesanan.paket_id], (err, menuResults) => {
                    if (err) {
                        console.error('Error mengambil komposisi:', err);
                    }

                    pesanan.isi_menu_detail = menuResults.map(m => m.nama_menu);
                    prosesPesanan(index + 1);
                });
            } else {
                pesanan.isi_menu_detail = [];
                prosesPesanan(index + 1);
            }
        };

        prosesPesanan(0);
    });
});

// API untuk ambil semua paket dengan komposisi menu
app.get('/api/paket-pemilik', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const query = 'SELECT * FROM paket ORDER BY harga_per_porsi ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil paket:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }

        const queryKomposisi = `
            SELECT m.id_menu, m.nama_menu 
            FROM komposisi_paket kp
            JOIN menu m ON kp.menu_id = m.id_menu
            WHERE kp.paket_id = ?
        `;

        const prosesPaket = (index) => {
            if (index >= results.length) {
                return res.json(results);
            }

            const paket = results[index];

            db.query(queryKomposisi, [paket.id_paket], (err, menuResults) => {
                if (err) {
                    console.error('Error mengambil komposisi:', err);
                }

                paket.menus = menuResults.map(m => m.nama_menu);
                paket.menus_detail = menuResults;
                prosesPaket(index + 1);
            });
        };

        prosesPaket(0);
    });
});

// API untuk ambil semua menu yang tersedia
app.get('/api/menu-tersedia', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const query = 'SELECT * FROM menu WHERE is_available = 1 ORDER BY nama_menu ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil menu:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});

// API untuk tambah paket baru (dengan upload gambar)
app.post('/api/tambah-paket', upload.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    console.log('Received files:', req.file);
    console.log('Received body:', req.body);

    // Ambil data dari req.body (FormData akan otomatis diparse oleh multer)
    const { nama_paket, harga_per_porsi, menu_ids, existing_gambar } = req.body;
    const gambar = req.file ? `uploads/paket/${req.file.filename}` : (existing_gambar || null);

    if (!nama_paket || !harga_per_porsi || !menu_ids) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let menu_ids_array;
    try {
        menu_ids_array = JSON.parse(menu_ids);
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Format menu tidak valid' });
    }

    if (menu_ids_array.length === 0) {
        return res.status(400).json({ success: false, message: 'Pilih minimal 1 menu' });
    }

    // Insert paket
    const queryPaket = 'INSERT INTO paket (nama_paket, harga_per_porsi, gambar, is_available) VALUES (?, ?, ?, 1)';

    db.query(queryPaket, [nama_paket, harga_per_porsi, gambar], (err, results) => {
        if (err) {
            console.error('Error menambah paket:', err);
            return res.status(500).json({ success: false, message: 'Gagal menambah paket: ' + err.message });
        }

        const id_paket = results.insertId;

        // Insert komposisi menu
        const queryKomposisi = 'INSERT INTO komposisi_paket (paket_id, menu_id, jumlah) VALUES (?, ?, 1)';
        let completed = 0;
        let hasError = false;

        menu_ids_array.forEach(menu_id => {
            db.query(queryKomposisi, [id_paket, menu_id], (err) => {
                if (err) {
                    console.error('Error menambah komposisi:', err);
                    if (!hasError) {
                        hasError = true;
                        return res.status(500).json({ success: false, message: 'Gagal menambah komposisi paket' });
                    }
                }
                completed++;

                if (completed === menu_ids_array.length && !hasError) {
                    res.json({ success: true, message: 'Paket berhasil ditambahkan' });
                }
            });
        });
    });
});

// API untuk update paket (dengan upload gambar)
app.put('/api/update-paket/:id', upload.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_paket = req.params.id;
    console.log('Update paket ID:', id_paket);
    console.log('Received files:', req.file);
    console.log('Received body:', req.body);

    const { nama_paket, harga_per_porsi, menu_ids, existing_gambar } = req.body;

    // Gunakan gambar baru jika ada, jika tidak gunakan yang lama
    let gambar = req.file ? `uploads/paket/${req.file.filename}` : existing_gambar;
    if (!gambar) gambar = null;

    if (!nama_paket || !harga_per_porsi || !menu_ids) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let menu_ids_array;
    try {
        menu_ids_array = JSON.parse(menu_ids);
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Format menu tidak valid' });
    }

    if (menu_ids_array.length === 0) {
        return res.status(400).json({ success: false, message: 'Pilih minimal 1 menu' });
    }

    // Update paket
    const queryPaket = 'UPDATE paket SET nama_paket = ?, harga_per_porsi = ?, gambar = ? WHERE id_paket = ?';

    db.query(queryPaket, [nama_paket, harga_per_porsi, gambar, id_paket], (err) => {
        if (err) {
            console.error('Error update paket:', err);
            return res.status(500).json({ success: false, message: 'Gagal update paket: ' + err.message });
        }

        // Hapus komposisi lama
        const queryDeleteKomposisi = 'DELETE FROM komposisi_paket WHERE paket_id = ?';

        db.query(queryDeleteKomposisi, [id_paket], (err) => {
            if (err) {
                console.error('Error hapus komposisi lama:', err);
            }

            // Insert komposisi baru
            const queryKomposisi = 'INSERT INTO komposisi_paket (paket_id, menu_id, jumlah) VALUES (?, ?, 1)';
            let completed = 0;
            let hasError = false;

            menu_ids_array.forEach(menu_id => {
                db.query(queryKomposisi, [id_paket, menu_id], (err) => {
                    if (err) {
                        console.error('Error menambah komposisi:', err);
                        if (!hasError) {
                            hasError = true;
                            return res.status(500).json({ success: false, message: 'Gagal update komposisi paket' });
                        }
                    }
                    completed++;

                    if (completed === menu_ids_array.length && !hasError) {
                        res.json({ success: true, message: 'Paket berhasil diupdate' });
                    }
                });
            });
        });
    });
});

// API untuk hapus paket
app.delete('/api/hapus-paket/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_paket = req.params.id;

    // Hapus paket (komposisi akan terhapus otomatis karena CASCADE)
    const query = 'DELETE FROM paket WHERE id_paket = ?';

    db.query(query, [id_paket], (err, results) => {
        if (err) {
            console.error('Error hapus paket:', err);
            return res.status(500).json({ success: false, message: 'Gagal menghapus paket' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
        }

        res.json({ success: true, message: 'Paket berhasil dihapus' });
    });
});

// API untuk update status pre-order (terima/tolak)
app.post('/api/update-status-preorder/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_pre_order = req.params.id;
    const { status } = req.body;

    if (!['diterima', 'ditolak'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }

    // Update status pre-order
    const queryUpdate = 'UPDATE pre_order SET status = ? WHERE id_pre_order = ?';
    db.query(queryUpdate, [status, id_pre_order], (err, results) => {
        if (err) {
            console.error('❌ Error update status:', err);
            return res.status(500).json({ success: false, message: 'Gagal update status' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
        }

        // Perekaman penjualan sekarang dipindah ke saat DP atau Lunas dibayar (midtrans-webhook / lunas-langsung)

        res.json({ success: true, message: 'Status berhasil diupdate' });
    });
});

// ============================================
// 14. API UNTUK BAHAN BAKU PEMILIK
// ============================================

// API untuk ambil semua bahan baku dengan stok
app.get('/api/bahan-baku-pemilik', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }
    const query = `
        SELECT bb.id_bahan, bb.nama_bahan, bb.satuan, bb.kategori, bb.jenis_bahan, bb.gambar, bb.harga_satuan,
               COALESCE(s.stok_tersedia, 0) as stok_tersedia, 
               COALESCE(s.stok_minimal, 0) as stok_minimal
        FROM bahan_baku bb
        LEFT JOIN stok_bahan s ON bb.id_bahan = s.bahan_id
        ORDER BY bb.id_bahan ASC
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil bahan baku:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});

// API untuk tambah bahan baku baru
app.post('/api/tambah-bahan-baku', uploadBahan.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }
    const { nama_bahan, stok_tersedia, stok_minimal, satuan, kategori, jenis_bahan, harga_satuan } = req.body;
    if (!nama_bahan || !stok_tersedia || !stok_minimal || !satuan || !kategori || !jenis_bahan) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let gambar = null;
    if (req.file) {
        gambar = req.file.filename;
    }

    // Insert ke tabel bahan_baku (dengan kategori, jenis_bahan, dan harga_satuan)
    const queryBahan = 'INSERT INTO bahan_baku (nama_bahan, satuan, kategori, jenis_bahan, gambar, harga_satuan) VALUES (?, ?, ?, ?, ?, ?)';
    const hargaVal = harga_satuan ? parseInt(harga_satuan) : null;
    db.query(queryBahan, [nama_bahan, satuan, kategori, jenis_bahan, gambar, hargaVal], (err, results) => {
        if (err) {
            console.error('Error tambah bahan baku:', err);
            return res.status(500).json({ success: false, message: 'Gagal menambah bahan baku: ' + err.message });
        }
        const id_bahan = results.insertId;
        // Insert ke tabel stok_bahan
        const queryStok = 'INSERT INTO stok_bahan (bahan_id, stok_tersedia, stok_minimal) VALUES (?, ?, ?)';
        db.query(queryStok, [id_bahan, stok_tersedia, stok_minimal], (err) => {
            if (err) {
                console.error('Error tambah stok:', err);
                return res.status(500).json({ success: false, message: 'Gagal menambah stok' });
            }
            res.json({ success: true, message: 'Bahan baku berhasil ditambahkan' });
        });
    });
});

// API untuk update bahan baku
app.put('/api/update-bahan-baku/:id', uploadBahan.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }
    const id_bahan = req.params.id;
    const { nama_bahan, stok_tersedia, stok_minimal, satuan, kategori, jenis_bahan, harga_satuan } = req.body;
    if (!nama_bahan || !stok_tersedia || !stok_minimal || !satuan || !kategori || !jenis_bahan) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let gambar = null;
    if (req.file) {
        gambar = req.file.filename;
    }

    // Update tabel bahan_baku
    let queryBahan;
    let paramsBahan;

    const hargaVal = harga_satuan ? parseInt(harga_satuan) : null;

    if (gambar) {
        queryBahan = 'UPDATE bahan_baku SET nama_bahan = ?, satuan = ?, kategori = ?, jenis_bahan = ?, gambar = ?, harga_satuan = ? WHERE id_bahan = ?';
        paramsBahan = [nama_bahan, satuan, kategori, jenis_bahan, gambar, hargaVal, id_bahan];
    } else {
        queryBahan = 'UPDATE bahan_baku SET nama_bahan = ?, satuan = ?, kategori = ?, jenis_bahan = ?, harga_satuan = ? WHERE id_bahan = ?';
        paramsBahan = [nama_bahan, satuan, kategori, jenis_bahan, hargaVal, id_bahan];
    }

    db.query(queryBahan, paramsBahan, (err) => {
        if (err) {
            console.error('Error update bahan baku:', err);
            return res.status(500).json({ success: false, message: 'Gagal update bahan baku' });
        }
        // Update tabel stok_bahan
        const queryStok = 'UPDATE stok_bahan SET stok_tersedia = ?, stok_minimal = ? WHERE bahan_id = ?';
        db.query(queryStok, [stok_tersedia, stok_minimal, id_bahan], (err) => {
            if (err) {
                console.error('Error update stok:', err);
                return res.status(500).json({ success: false, message: 'Gagal update stok' });
            }
            res.json({ success: true, message: 'Bahan baku berhasil diupdate' });
        });
    });
});

// API untuk hapus bahan baku
app.delete('/api/hapus-bahan-baku/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_bahan = req.params.id;

    // Hapus bahan baku (stok akan terhapus otomatis karena CASCADE di database)
    const queryBahan = 'DELETE FROM bahan_baku WHERE id_bahan = ?';

    db.query(queryBahan, [id_bahan], (err, results) => {
        if (err) {
            console.error('Error hapus bahan baku:', err);
            return res.status(500).json({ success: false, message: 'Gagal menghapus bahan baku' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bahan baku tidak ditemukan' });
        }

        res.json({ success: true, message: 'Bahan baku berhasil dihapus' });
    });
});

// ============================================
// 15. API UNTUK RESEP PEMILIK
// ============================================

// API untuk ambil semua menu beserta resepnya
app.get('/api/menu-resep-pemilik', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const query = `
        SELECT m.id_menu, m.nama_menu, m.gambar, m.harga, m.is_available
        FROM menu m
        ORDER BY m.id_menu ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil menu:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }

        // Untuk setiap menu, ambil resep (bahan-bahan)
        const queryResep = `
            SELECT r.bahan_id, r.jumlah_butuh, bb.nama_bahan, bb.satuan
            FROM resep r
            JOIN bahan_baku bb ON r.bahan_id = bb.id_bahan
            WHERE r.menu_id = ?
        `;

        const prosesMenu = (index) => {
            if (index >= results.length) {
                return res.json(results);
            }

            const menu = results[index];

            db.query(queryResep, [menu.id_menu], (err, resepResults) => {
                if (err) {
                    console.error('Error mengambil resep:', err);
                    menu.bahan = [];
                } else {
                    menu.bahan = resepResults;
                }

                prosesMenu(index + 1);
            });
        };

        prosesMenu(0);
    });
});

// API untuk ambil semua bahan baku (untuk dropdown)
app.get('/api/bahan-baku-list', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    const query = 'SELECT id_bahan, nama_bahan, satuan FROM bahan_baku ORDER BY nama_bahan ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil bahan baku:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        res.json(results);
    });
});

// API untuk tambah resep baru
app.post('/api/tambah-resep', upload.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const { nama_menu, harga, bahan } = req.body;
    const gambar = req.file ? `uploads/paket/${req.file.filename}` : null;

    if (!nama_menu || !harga || !bahan) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let bahanArray;
    try {
        bahanArray = JSON.parse(bahan);
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Format bahan tidak valid' });
    }

    if (bahanArray.length === 0) {
        return res.status(400).json({ success: false, message: 'Minimal 1 bahan harus ditambahkan' });
    }

    // Insert ke tabel menu
    const queryMenu = 'INSERT INTO menu (nama_menu, gambar, harga, is_available) VALUES (?, ?, ?, 1)';

    db.query(queryMenu, [nama_menu, gambar, harga], (err, results) => {
        if (err) {
            console.error('Error tambah menu:', err);
            return res.status(500).json({ success: false, message: 'Gagal menambah menu: ' + err.message });
        }

        const id_menu = results.insertId;

        // Insert ke tabel resep untuk setiap bahan
        const queryResep = 'INSERT INTO resep (menu_id, bahan_id, jumlah_butuh) VALUES (?, ?, ?)';
        let completed = 0;
        let hasError = false;

        bahanArray.forEach(b => {
            db.query(queryResep, [id_menu, b.id_bahan, b.jumlah_butuh], (err) => {
                if (err) {
                    console.error('Error tambah resep:', err);
                    if (!hasError) {
                        hasError = true;
                        return res.status(500).json({ success: false, message: 'Gagal menambah resep' });
                    }
                }
                completed++;

                if (completed === bahanArray.length && !hasError) {
                    res.json({ success: true, message: 'Resep berhasil ditambahkan' });
                }
            });
        });
    });
});

// API untuk update resep
app.put('/api/update-resep/:id', upload.single('gambar'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_menu = req.params.id;
    const { nama_menu, harga, bahan, existing_gambar } = req.body;

    let gambar = req.file ? `uploads/paket/${req.file.filename}` : existing_gambar;
    if (!gambar) gambar = null;

    if (!nama_menu || !harga || !bahan) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    let bahanArray;
    try {
        bahanArray = JSON.parse(bahan);
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Format bahan tidak valid' });
    }

    // Update tabel menu
    const queryMenu = 'UPDATE menu SET nama_menu = ?, gambar = ?, harga = ? WHERE id_menu = ?';

    db.query(queryMenu, [nama_menu, gambar, harga, id_menu], (err) => {
        if (err) {
            console.error('Error update menu:', err);
            return res.status(500).json({ success: false, message: 'Gagal update menu' });
        }

        // Hapus resep lama
        const queryDeleteResep = 'DELETE FROM resep WHERE menu_id = ?';

        db.query(queryDeleteResep, [id_menu], (err) => {
            if (err) {
                console.error('Error hapus resep lama:', err);
            }

            // Insert resep baru
            const queryResep = 'INSERT INTO resep (menu_id, bahan_id, jumlah_butuh) VALUES (?, ?, ?)';
            let completed = 0;
            let hasError = false;

            bahanArray.forEach(b => {
                db.query(queryResep, [id_menu, b.id_bahan, b.jumlah_butuh], (err) => {
                    if (err) {
                        console.error('Error tambah resep:', err);
                        if (!hasError) {
                            hasError = true;
                            return res.status(500).json({ success: false, message: 'Gagal update resep' });
                        }
                    }
                    completed++;

                    if (completed === bahanArray.length && !hasError) {
                        res.json({ success: true, message: 'Resep berhasil diupdate' });
                    }
                });
            });
        });
    });
});

// API untuk hapus resep
app.delete('/api/hapus-resep/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const id_menu = req.params.id;

    // Hapus menu (resep akan terhapus otomatis karena CASCADE di database)
    const query = 'DELETE FROM menu WHERE id_menu = ?';

    db.query(query, [id_menu], (err, results) => {
        if (err) {
            console.error('Error hapus menu:', err);
            return res.status(500).json({ success: false, message: 'Gagal menghapus menu' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
        }

        res.json({ success: true, message: 'Resep berhasil dihapus' });
    });
});

// ============================================
// API PENJUALAN (LENGKAP & DIPERBAIKI)
// ============================================

// 1. API Ambil Semua Penjualan + Detail Menu
app.get('/api/penjualan-pemilik', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login' });
    }

    const query = `
        SELECT id_penjualan, user_id, nama_pelanggan, sumber, tanggal, total_porsi, total_harga
        FROM penjualan
        ORDER BY tanggal DESC, id_penjualan DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error ambil penjualan:', err);
            return res.status(500).json({ error: 'Gagal ambil data' });
        }

        // Query untuk ambil detail menu per penjualan
        const queryDetail = `
            SELECT dp.menu_id, dp.jumlah_porsi, m.nama_menu, m.harga
            FROM detail_penjualan dp
            JOIN menu m ON dp.menu_id = m.id_menu
            WHERE dp.penjualan_id = ?
        `;

        const prosesPenjualan = (index) => {
            if (index >= results.length) {
                return res.json(results);
            }

            const penjualan = results[index];

            db.query(queryDetail, [penjualan.id_penjualan], (err, detailResults) => {
                if (err) {
                    console.error('Error ambil detail:', err);
                    penjualan.detail_menu = [];
                } else {
                    penjualan.detail_menu = detailResults;
                }

                prosesPenjualan(index + 1);
            });
        };

        prosesPenjualan(0);
    });
});

// 2. API Tambah Penjualan Manual
app.post('/api/tambah-penjualan', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const { nama_pelanggan, tanggal, menu } = req.body;
    const user_id = req.session.user.id;

    if (!tanggal || !menu || menu.length === 0) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // Hitung total porsi dan total harga
    let totalPorsi = 0;
    let totalHarga = 0;
    let itemsProcessed = 0;

    menu.forEach(m => {
        const queryHarga = 'SELECT harga FROM menu WHERE id_menu = ?';
        db.query(queryHarga, [m.id_menu], (err, results) => {
            if (err) return console.error('❌ Error ambil harga:', err);

            if (results.length > 0) {
                const harga = parseFloat(results[0].harga);
                const porsi = parseInt(m.jumlah_porsi);
                totalPorsi += porsi;
                totalHarga += (harga * porsi);
            }

            itemsProcessed++;

            // Jika semua menu sudah diproses harganya, simpan ke database
            if (itemsProcessed === menu.length) {
                const queryInsert = `
                    INSERT INTO penjualan (user_id, nama_pelanggan, pre_order_id, sumber, tanggal, total_porsi, total_harga)
                    VALUES (?, ?, NULL, 'manual', ?, ?, ?)
                `;

                db.query(queryInsert, [user_id, nama_pelanggan || 'Pelanggan', tanggal, totalPorsi, totalHarga], (err, result) => {
                    if (err) {
                        console.error('❌ Error insert penjualan:', err);
                        return res.status(500).json({ success: false, message: 'Gagal simpan' });
                    }

                    const id_penjualan = result.insertId;
                    console.log('✅ Penjualan berhasil dibuat dengan ID:', id_penjualan);

                    // Simpan detail menu
                    const queryDetail = 'INSERT INTO detail_penjualan (penjualan_id, menu_id, jumlah_porsi) VALUES (?, ?, ?)';
                    let detailProcessed = 0;

                    menu.forEach(m => {
                        db.query(queryDetail, [id_penjualan, m.id_menu, m.jumlah_porsi], (err) => {
                            if (err) console.error('❌ Error detail:', err);
                            detailProcessed++;

                            // ✅ PERBAIKAN: Setelah semua detail tersimpan, kurangi stok bahan baku
                            if (detailProcessed === menu.length) {
                                kurangiStokBahanBaku(id_penjualan, (err) => {
                                    if (err) {
                                        console.error('❌ Gagal mengurangi stok bahan baku:', err);
                                    } else {
                                        console.log('✅ Stok bahan baku berhasil dikurangi otomatis');
                                    }

                                    // Kirim respon ke frontend setelah semua proses selesai
                                    res.json({
                                        success: true,
                                        message: 'Penjualan berhasil ditambahkan dan stok diperbarui'
                                    });
                                });
                            }
                        });
                    });
                });
            }
        });
    });
});

// 3. API Update Penjualan
app.put('/api/update-penjualan/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const id_penjualan = req.params.id;
    const { nama_pelanggan, tanggal, menu } = req.body;

    if (!tanggal || !menu || menu.length === 0) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // Hitung ulang total
    let totalPorsi = 0;
    let totalHarga = 0;
    let itemsProcessed = 0;

    menu.forEach(m => {
        const queryHarga = 'SELECT harga FROM menu WHERE id_menu = ?';
        db.query(queryHarga, [m.id_menu], (err, results) => {
            if (err) return console.error(err);

            if (results.length > 0) {
                const harga = parseFloat(results[0].harga);
                const porsi = parseInt(m.jumlah_porsi);
                totalPorsi += porsi;
                totalHarga += (harga * porsi);
            }

            itemsProcessed++;

            if (itemsProcessed === menu.length) {
                const queryUpdate = `
                    UPDATE penjualan 
                    SET nama_pelanggan = ?, tanggal = ?, total_porsi = ?, total_harga = ? 
                    WHERE id_penjualan = ?
                `;

                db.query(queryUpdate, [nama_pelanggan || 'Pelanggan', tanggal, totalPorsi, totalHarga, id_penjualan], (err) => {
                    if (err) {
                        console.error('Error update:', err);
                        return res.status(500).json({ success: false, message: 'Gagal update' });
                    }

                    // Hapus detail lama & insert baru
                    db.query('DELETE FROM detail_penjualan WHERE penjualan_id = ?', [id_penjualan], (err) => {
                        if (err) console.error(err);

                        const queryDetail = 'INSERT INTO detail_penjualan (penjualan_id, menu_id, jumlah_porsi) VALUES (?, ?, ?)';
                        let detailProcessed = 0;

                        menu.forEach(m => {
                            db.query(queryDetail, [id_penjualan, m.id_menu, m.jumlah_porsi], (err) => {
                                if (err) console.error(err);
                                detailProcessed++;
                                if (detailProcessed === menu.length) {
                                    res.json({ success: true, message: 'Penjualan berhasil diupdate' });
                                }
                            });
                        });
                    });
                });
            }
        });
    });
});

// 4. API Hapus Penjualan
app.delete('/api/hapus-penjualan/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }
    const id_penjualan = req.params.id;
    db.query('DELETE FROM penjualan WHERE id_penjualan = ?', [id_penjualan], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal hapus' });
        res.json({ success: true, message: 'Berhasil dihapus' });
    });
});


// API DAFTAR MENU Dropdown di Penjualan

app.get('/api/menu-list', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login sebagai pemilik' });
    }

    // Ambil hanya menu yang tersedia (is_available = 1)
    const query = 'SELECT id_menu, nama_menu, harga FROM menu WHERE is_available = 1 ORDER BY nama_menu ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error mengambil menu:', err);
            return res.status(500).json({ error: 'Gagal mengambil data menu' });
        }
        console.log('✅ Berhasil mengambil', results.length, 'menu untuk dropdown');
        res.json(results);
    });
});

// ============================================
// API PREDIKSI MENU & RESEP (WMA 7 HARI)
// ============================================

// API untuk mengambil info tanggal analisis WMA (tanpa menjalankan prediksi)
app.get('/api/info-tanggal-wma', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const queryTanggal = `
        SELECT DISTINCT DATE(tanggal) as tgl
        FROM penjualan
        ORDER BY tgl DESC
        LIMIT 7
    `;

    db.query(queryTanggal, (err, tglResults) => {
        if (err) {
            console.error('❌ Error ambil info tanggal penjualan:', err);
            return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat transaksi' });
        }

        if (!tglResults || tglResults.length === 0) {
            return res.json({
                success: true,
                periode_info: 'Belum ada data transaksi penjualan',
                startDate: null,
                endDate: null
            });
        }

        const activeDates = tglResults.map(r => r.tgl).sort((a, b) => new Date(a) - new Date(b));

        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const formatTglIndo = (dateObj) => {
            return `${dateObj.getDate()} ${bulanIndo[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        };

        const firstDate = new Date(activeDates[0]);
        const lastDate = new Date(activeDates[activeDates.length - 1]);
        const periodeInfo = `Menganalisis ${activeDates.length} hari transaksi penjualan (${formatTglIndo(firstDate)} s/d ${formatTglIndo(lastDate)})`;

        res.json({
            success: true,
            periode_info: periodeInfo,
            startDate: firstDate,
            endDate: lastDate
        });
    });
});

// API untuk menjalankan prediksi menu/resep dengan metode WMA 7 hari adaptif
app.post('/api/prediksi-menu-wma', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    // 1. Ambil maksimal 7 tanggal transaksi penjualan unik terakhir yang ada di database
    const queryTanggal = `
        SELECT DISTINCT DATE(tanggal) as tgl
        FROM penjualan
        ORDER BY tgl DESC
        LIMIT 7
    `;

    db.query(queryTanggal, (err, tglResults) => {
        if (err) {
            console.error('❌ Error ambil tanggal penjualan:', err);
            return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat transaksi' });
        }

        if (!tglResults || tglResults.length === 0) {
            return res.json({
                success: true,
                total_hari: 0,
                periode_info: 'Belum ada data transaksi penjualan',
                hasil: []
            });
        }

        // Urutkan tanggal dari terlama ke terbaru (ASC) agar bobot 1 = terlama, bobot N = terbaru
        const pad = (n) => n < 10 ? '0' + n : n;
        const formatDateStr = (d) => {
            const dateObj = new Date(d);
            return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
        };

        const activeDates = tglResults.map(r => formatDateStr(r.tgl)).sort();
        const nHari = activeDates.length;

        // Query penjualan pada tanggal-tanggal aktif tersebut
        const placeholders = activeDates.map(() => '?').join(',');
        const queryPenjualan = `
            SELECT DATE(p.tanggal) as tanggal, dp.menu_id, SUM(dp.jumlah_porsi) as total_porsi
            FROM penjualan p
            JOIN detail_penjualan dp ON p.id_penjualan = dp.penjualan_id
            WHERE DATE(p.tanggal) IN (${placeholders})
            GROUP BY DATE(p.tanggal), dp.menu_id
        `;

        db.query(queryPenjualan, activeDates, (err, salesResults) => {
            if (err) {
                console.error('❌ Error ambil penjualan detail:', err);
                return res.status(500).json({ success: false, message: 'Gagal mengambil detail penjualan' });
            }

            // Ambil semua menu yang tersedia/aktif
            const queryMenu = `
                SELECT id_menu, nama_menu, gambar, harga, is_available
                FROM menu
                ORDER BY nama_menu ASC
            `;

            db.query(queryMenu, (err, menuResults) => {
                if (err) {
                    console.error('❌ Error ambil menu:', err);
                    return res.status(500).json({ success: false, message: 'Gagal mengambil data menu' });
                }

                // Ambil semua resep beserta info bahan baku
                const queryResep = `
                    SELECT r.menu_id, r.bahan_id, r.jumlah_butuh, bb.nama_bahan, bb.satuan, bb.harga_satuan
                    FROM resep r
                    JOIN bahan_baku bb ON r.bahan_id = bb.id_bahan
                    ORDER BY r.menu_id ASC, bb.nama_bahan ASC
                `;

                db.query(queryResep, (err, resepResults) => {
                    if (err) {
                        console.error('❌ Error ambil resep:', err);
                        return res.status(500).json({ success: false, message: 'Gagal mengambil data resep' });
                    }

                    // Map penjualan: menuSales[menu_id][dateStr] = total_porsi
                    const menuSales = {};
                    salesResults.forEach(row => {
                        const dateStr = formatDateStr(row.tanggal);
                        if (!menuSales[row.menu_id]) {
                            menuSales[row.menu_id] = {};
                        }
                        menuSales[row.menu_id][dateStr] = parseInt(row.total_porsi) || 0;
                    });

                    // Hitung total bobot: sum(1..nHari)
                    let totalWeight = 0;
                    for (let i = 1; i <= nHari; i++) {
                        totalWeight += i;
                    }

                    // Hitung WMA untuk setiap menu
                    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    const formatIndo = (dateStr) => {
                        const parts = dateStr.split('-');
                        if (parts.length !== 3) return dateStr;
                        return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
                    };

                    const startDateIndo = formatIndo(activeDates[0]);
                    const endDateIndo = formatIndo(activeDates[activeDates.length - 1]);
                    const periodeInfo = nHari === 7
                        ? `Menganalisis 7 hari transaksi penjualan (${startDateIndo} s/d ${endDateIndo})`
                        : `Menganalisis ${nHari} hari transaksi penjualan (${startDateIndo} s/d ${endDateIndo})`;

                    const hasilPrediksi = menuResults.map(m => {
                        let weightedSum = 0;
                        activeDates.forEach((dateStr, idx) => {
                            const weight = idx + 1; // 1 s/d nHari
                            const qty = (menuSales[m.id_menu] && menuSales[m.id_menu][dateStr]) ? menuSales[m.id_menu][dateStr] : 0;
                            weightedSum += (qty * weight);
                        });

                        const wmaDaily = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
                        // Proyeksi 7 hari ke depan = wmaDaily * 7
                        const projected7Days = Math.round(wmaDaily * 7);

                        // Ambil komposisi bahan resep untuk menu ini
                        const resepMenu = resepResults.filter(r => r.menu_id === m.id_menu);
                        const bahanList = resepMenu.map(r => {
                            const butuhPerPorsi = parseFloat(r.jumlah_butuh) || 0;
                            const totalButuhPrediksi = parseFloat((butuhPerPorsi * projected7Days).toFixed(3));
                            return {
                                bahan_id: r.bahan_id,
                                nama_bahan: r.nama_bahan,
                                satuan: r.satuan,
                                harga_satuan: r.harga_satuan || 0,
                                butuh_per_porsi: butuhPerPorsi,
                                total_kebutuhan: totalButuhPrediksi
                            };
                        });

                        return {
                            id_menu: m.id_menu,
                            nama_menu: m.nama_menu,
                            gambar: m.gambar,
                            harga: m.harga,
                            wma_harian: parseFloat(wmaDaily.toFixed(2)),
                            porsi_prediksi: projected7Days,
                            jumlah_bahan: bahanList.length,
                            bahan: bahanList
                        };
                    });

                    // Urutkan dari porsi prediksi terbanyak
                    hasilPrediksi.sort((a, b) => b.porsi_prediksi - a.porsi_prediksi);

                    res.json({
                        success: true,
                        total_hari: nHari,
                        startDate: startDateIndo,
                        endDate: endDateIndo,
                        periode_info: periodeInfo,
                        hasil: hasilPrediksi
                    });
                });
            });
        });
    });
});


// Fungsi helper untuk menghitung WMA
function hitungWMA(dataArray) {
    if (dataArray.length === 0) return 0;

    const n = dataArray.length;
    let weightedSum = 0;
    let weightSum = 0;

    // Data terbaru (index terakhir) mendapat bobot terbesar
    for (let i = 0; i < n; i++) {
        const weight = i + 1; // Bobot: 1, 2, 3, ..., n
        weightedSum += dataArray[i] * weight;
        weightSum += weight;
    }

    return weightedSum / weightSum;
}

// API untuk kirim prediksi ke belanja bahan
app.post('/api/kirim-prediksi-ke-belanja', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login sebagai pemilik' });
    }

    const { items, sumber } = req.body;
    const user_id = req.session.user.id;
    const sumberBelanja = sumber || 'Prediksi';

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada bahan yang dipilih' });
    }

    console.log("ITEM PERTAMA YG DIKIRIM:", items[0], "SUMBER:", sumberBelanja);

    const today = new Date().toISOString().split('T')[0];
    const queryInsert = `
        INSERT INTO pembelian_bahan (user_id, bahan_id, tanggal_beli, jumlah_beli, harga_satuan, total_harga, status, is_submitted, sumber)
        VALUES (?, ?, ?, ?, ?, ?, 'belum_dibeli', 0, ?)
    `;

    let inserted = 0;
    let hasError = false;

    items.forEach(item => {
        const hargaSatuan = parseFloat(item.harga_satuan) || 0;
        const jumlahBeli = parseFloat(item.jumlah_rekomendasi) || 0;
        const totalHarga = hargaSatuan * jumlahBeli;

        db.query(queryInsert, [user_id, item.bahan_id, today, jumlahBeli, hargaSatuan, totalHarga, sumberBelanja], (err) => {
            if (err) {
                console.error('❌ Error insert pembelian:', err);
                if (!hasError) {
                    hasError = true;
                    return res.status(500).json({ success: false, message: 'Gagal mengirim ke belanja bahan' });
                }
            }
            inserted++;
            if (inserted === items.length && !hasError) {
                console.log(`✅ ${inserted} bahan berhasil dikirim ke belanja bahan (${sumberBelanja})`);
                res.json({ success: true, message: `${inserted} bahan berhasil dikirim ke Belanja Bahan` });
            }
        });
    });
});

// ============================================
// ============================================
// API BELANJA BAHAN (DAFTAR & RIWAYAT)
// ============================================

// 1. API Ambil Daftar Belanja (Draft / is_submitted = 0)
app.get('/api/belanja-bahan-daftar', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login' });
    }

    const query = `
        SELECT pb.id_pembelian, pb.bahan_id, pb.tanggal_beli, pb.jumlah_beli, pb.harga_satuan, pb.total_harga, pb.sumber,
               bb.nama_bahan, bb.satuan
        FROM pembelian_bahan pb
        JOIN bahan_baku bb ON pb.bahan_id = bb.id_bahan
        WHERE pb.user_id = ? AND pb.is_submitted = 0
        ORDER BY pb.id_pembelian ASC
    `;

    db.query(query, [req.session.user.id], (err, results) => {
        if (err) {
            console.error('Error ambil daftar belanja:', err);
            return res.status(500).json({ error: 'Gagal ambil data' });
        }
        res.json(results);
    });
});

// 2. API Ambil Riwayat Belanja (Submitted / is_submitted = 1)
app.get('/api/belanja-bahan-riwayat', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ error: 'Belum login' });
    }

    const filter = req.query.filter || '';
    const statusFilter = req.query.status || '';
    const sumberFilter = req.query.sumber || '';
    let dateCondition = '';
    let statusCondition = '';
    let sumberCondition = '';

    if (filter === 'hari_ini') {
        dateCondition = 'AND pb.tanggal_beli = CURDATE()';
    } else if (filter === 'minggu_ini') {
        dateCondition = 'AND YEARWEEK(pb.tanggal_beli, 1) = YEARWEEK(CURDATE(), 1)';
    } else if (filter === 'bulan_ini') {
        dateCondition = 'AND MONTH(pb.tanggal_beli) = MONTH(CURDATE()) AND YEAR(pb.tanggal_beli) = YEAR(CURDATE())';
    }

    if (statusFilter === 'belum') {
        statusCondition = "AND (pb.status = 'belum' OR pb.status = 'belum_dibeli' OR pb.status IS NULL OR pb.status != 'selesai')";
    } else if (statusFilter === 'selesai') {
        statusCondition = "AND pb.status = 'selesai'";
    }

    if (sumberFilter === 'Pre-Order') {
        sumberCondition = "AND (pb.sumber LIKE '%Pre-Order%' OR pb.sumber LIKE '%preorder%')";
    } else if (sumberFilter === 'Prediksi') {
        sumberCondition = "AND (pb.sumber LIKE '%Prediksi%' OR pb.sumber IS NULL OR pb.sumber = '')";
    }

    const query = `
        SELECT pb.id_pembelian, pb.bahan_id, pb.tanggal_beli, pb.jumlah_beli, pb.harga_satuan, pb.total_harga, pb.status, pb.grup_belanja, pb.sumber,
               bb.nama_bahan, bb.satuan
        FROM pembelian_bahan pb
        JOIN bahan_baku bb ON pb.bahan_id = bb.id_bahan
        WHERE pb.user_id = ? AND pb.is_submitted = 1 ${dateCondition} ${statusCondition} ${sumberCondition}
        ORDER BY pb.tanggal_beli DESC, pb.grup_belanja DESC
    `;

    db.query(query, [req.session.user.id], (err, results) => {
        if (err) {
            console.error('Error ambil riwayat belanja:', err);
            return res.status(500).json({ error: 'Gagal ambil data' });
        }
        res.json(results);
    });
});

// 3. API Update Item Belanja (Edit Jumlah/Harga)
app.put('/api/update-belanja-bahan/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const id_pembelian = req.params.id;
    const { jumlah_beli, harga_satuan, total_harga } = req.body;

    const query = `
        UPDATE pembelian_bahan 
        SET jumlah_beli = ?, harga_satuan = ?, total_harga = ? 
        WHERE id_pembelian = ? AND user_id = ?
    `;

    db.query(query, [jumlah_beli, harga_satuan, total_harga, id_pembelian, req.session.user.id], (err) => {
        if (err) {
            console.error('Error update belanja:', err);
            return res.status(500).json({ success: false, message: 'Gagal update' });
        }
        res.json({ success: true, message: 'Berhasil diupdate' });
    });
});

// 4. API Hapus Item Belanja
app.delete('/api/hapus-belanja-bahan/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const id_pembelian = req.params.id;
    const query = 'DELETE FROM pembelian_bahan WHERE id_pembelian = ? AND user_id = ?';

    db.query(query, [id_pembelian, req.session.user.id], (err) => {
        if (err) {
            console.error('Error hapus belanja:', err);
            return res.status(500).json({ success: false, message: 'Gagal hapus' });
        }
        res.json({ success: true, message: 'Berhasil dihapus' });
    });
});

// 5. API Submit Daftar Belanja ke Riwayat (Tombol Simpan di Tab 1)
app.post('/api/submit-belanja-bahan', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const user_id = req.session.user.id;
    const grup_belanja = Date.now(); // ID unik untuk grup ini

    // Update semua item draft user ini menjadi submitted
    const query = `
        UPDATE pembelian_bahan 
        SET is_submitted = 1, grup_belanja = ?, tanggal_beli = CURDATE() 
        WHERE user_id = ? AND is_submitted = 0
    `;

    db.query(query, [grup_belanja, user_id], (err, results) => {
        if (err) {
            console.error('Error submit belanja:', err);
            return res.status(500).json({ success: false, message: 'Gagal submit' });
        }
        res.json({ success: true, message: 'Berhasil dikirim ke Riwayat Belanja' });
    });
});

// 6. API Tandai Selesai (Update Status & Tambah Stok)
app.post('/api/tandai-belanja-selesai/:grup_belanja', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }

    const grup_belanja = req.params.grup_belanja;

    // 1. Update status jadi 'selesai'
    const queryUpdateStatus = `
        UPDATE pembelian_bahan 
        SET status = 'selesai' 
        WHERE grup_belanja = ? AND user_id = ?
    `;

    db.query(queryUpdateStatus, [grup_belanja, req.session.user.id], (err) => {
        if (err) {
            console.error('Error update status:', err);
            return res.status(500).json({ success: false, message: 'Gagal update status' });
        }

        // 2. Ambil data item untuk tambah stok
        const queryGetItems = `
            SELECT p.bahan_id, p.jumlah_beli, b.satuan, b.nama_bahan 
            FROM pembelian_bahan p
            LEFT JOIN bahan_baku b ON p.bahan_id = b.id_bahan
            WHERE p.grup_belanja = ?
        `;

        db.query(queryGetItems, [grup_belanja], (err, items) => {
            if (err) {
                console.error('Error ambil item:', err);
                return res.status(500).json({ success: false, message: 'Gagal ambil data item' });
            }

            // 3. Loop dan tambah stok di tabel stok_bahan
            if (!items || items.length === 0) {
                return res.json({ success: true, message: 'Status berhasil diubah (tidak ada item)', items: [] });
            }

            let processed = 0;
            items.forEach(item => {
                const queryAddStock = `
                    INSERT INTO stok_bahan (bahan_id, stok_tersedia, stok_minimal) 
                    VALUES (?, ?, 0)
                    ON DUPLICATE KEY UPDATE stok_tersedia = stok_tersedia + VALUES(stok_tersedia)
                `;
                db.query(queryAddStock, [item.bahan_id, item.jumlah_beli], (err) => {
                    if (err) console.error('Error tambah stok:', err);
                    processed++;
                    if (processed === items.length) {
                        res.json({ success: true, message: 'Belanja selesai, stok berhasil ditambahkan', items: items });
                    }
                });
            });
        });
    });
});

// ============================================
// 16.5 API PREDIKSI BELANJA (WMA)
// ============================================
app.post('/api/prediksi-belanja', (req, res) => {
    if (req.session.role !== 'pemilik') return res.status(403).json({ success: false, message: 'Unauthorized' });

    let periode = parseInt(req.body.periode) || 3;

    // Query untuk mengambil penjualan menu per hari selama N hari terakhir (sebelum hari ini)
    const querySales = `
        SELECT DATE(p.tanggal) as tanggal, dp.menu_id, m.nama_menu, SUM(dp.jumlah_porsi) as total_porsi
        FROM penjualan p
        JOIN detail_penjualan dp ON p.id_penjualan = dp.penjualan_id
        JOIN menu m ON dp.menu_id = m.id_menu
        WHERE p.tanggal >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND p.tanggal < CURDATE()
        GROUP BY DATE(p.tanggal), dp.menu_id, m.nama_menu
        ORDER BY dp.menu_id, DATE(p.tanggal) ASC
    `;

    db.query(querySales, [periode], (err, salesResults) => {
        if (err) {
            console.error('Error query sales untuk prediksi:', err);
            return res.status(500).json({ success: false, message: 'Error querying sales' });
        }

        const pad = (n) => n < 10 ? '0' + n : n;
        const dates = [];
        for (let i = periode; i >= 1; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = pad(d.getMonth() + 1);
            const dd = pad(d.getDate());
            dates.push(`${yyyy}-${mm}-${dd}`);
        }

        const menuSales = {};
        salesResults.forEach(row => {
            if (!menuSales[row.menu_id]) {
                menuSales[row.menu_id] = { nama_menu: row.nama_menu, daily: {} };
            }
            const rowD = new Date(row.tanggal);
            const r_yyyy = rowD.getFullYear();
            const r_mm = pad(rowD.getMonth() + 1);
            const r_dd = pad(rowD.getDate());
            const dateStr = `${r_yyyy}-${r_mm}-${r_dd}`;

            menuSales[row.menu_id].daily[dateStr] = row.total_porsi;
        });

        const menuProjections = {};
        let totalWeight = 0;
        for (let i = 1; i <= periode; i++) {
            totalWeight += i;
        }

        for (const menuId in menuSales) {
            let weightedSum = 0;
            dates.forEach((date, index) => {
                const weight = index + 1; // Paling lama bobot 1, paling baru bobot N
                const qty = menuSales[menuId].daily[date] || 0;
                weightedSum += (qty * weight);
            });
            const wma = weightedSum / totalWeight;
            const projectedTotal = wma * periode; // Proyeksi untuk N hari ke depan

            menuProjections[menuId] = projectedTotal;
        }

        const queryResep = `
            SELECT r.menu_id, r.bahan_id, r.jumlah_butuh, bb.nama_bahan, bb.satuan, bb.kategori, s.stok_tersedia
            FROM resep r
            JOIN bahan_baku bb ON r.bahan_id = bb.id_bahan
            LEFT JOIN stok_bahan_baku s ON bb.id_bahan = s.bahan_id
        `;

        db.query(queryResep, (err, resepResults) => {
            if (err) {
                console.error('Error query resep untuk prediksi:', err);
                return res.status(500).json({ success: false, message: 'Error querying recipes' });
            }

            const bahanNeeds = {};

            resepResults.forEach(row => {
                const projectedMenu = menuProjections[row.menu_id] || 0;
                if (projectedMenu > 0) {
                    if (!bahanNeeds[row.bahan_id]) {
                        bahanNeeds[row.bahan_id] = {
                            id_bahan: row.bahan_id,
                            nama_bahan: row.nama_bahan,
                            kategori: row.kategori,
                            satuan: row.satuan,
                            stok_saat_ini: row.stok_tersedia || 0,
                            kebutuhan_prediksi: 0
                        };
                    }
                    bahanNeeds[row.bahan_id].kebutuhan_prediksi += (row.jumlah_butuh * projectedMenu);
                }
            });

            const hasilPrediksi = Object.values(bahanNeeds).map(b => {
                let rekomendasi = b.kebutuhan_prediksi - b.stok_saat_ini;
                if (rekomendasi < 0) rekomendasi = 0;
                return {
                    ...b,
                    jumlah_rekomendasi: rekomendasi
                };
            });

            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const formatIndo = (dateString) => {
                const parts = dateString.split('-');
                if (parts.length !== 3) return dateString;
                return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
            };

            const startDateIndo = formatIndo(dates[0]);
            const endDateIndo = formatIndo(dates[dates.length - 1]);

            res.json({
                success: true,
                startDate: startDateIndo,
                endDate: endDateIndo,
                hasil: hasilPrediksi
            });
        });
    });
});

// ============================================
// ENDPOINT ALUR PRE-ORDER BARU
// ============================================

// Endpoint Terima Pesanan -> Menunggu DP
app.post('/api/pre-order/:id/terima-dp', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') return res.status(401).json({ success: false, message: 'Belum login' });
    const id_pre_order = req.params.id;
    const { batas_waktu_jam } = req.body;
    const cooldown = parseInt(batas_waktu_jam) || 24;
    const batasWaktu = new Date(Date.now() + cooldown * 3600 * 1000);

    db.query('SELECT total_harga FROM pre_order WHERE id_pre_order = ?', [id_pre_order], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Gagal ambil data' });
        const total_harga = parseFloat(results[0].total_harga);
        const dp = total_harga * 0.5;
        const sisa = total_harga - dp;

        const query = 'UPDATE pre_order SET status = ?, status_pembayaran = ?, jumlah_dp = ?, sisa_pembayaran = ?, batas_waktu_dp = ? WHERE id_pre_order = ?';
        db.query(query, ['menunggu_dp', 'belum_bayar', dp, sisa, batasWaktu, id_pre_order], (err, updateRes) => {
            if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
            res.json({ success: true, message: 'Tagihan DP berhasil dikirim' });
        });
    });
});

// Endpoint Kirim Tagihan Akhir
app.post('/api/pre-order/:id/tagih-akhir', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') return res.status(401).json({ success: false });
    const id_pre_order = req.params.id;
    const cooldown = parseInt(req.body.batas_waktu_jam) || 24;
    const batasWaktu = new Date(Date.now() + cooldown * 3600 * 1000);

    const query = 'UPDATE pre_order SET status = ?, batas_waktu_pelunasan = ? WHERE id_pre_order = ?';
    db.query(query, ['menunggu_pelunasan', batasWaktu, id_pre_order], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
        res.json({ success: true, message: 'Tagihan akhir berhasil dikirim' });
    });
});

// Endpoint Lunas Langsung
app.post('/api/pre-order/:id/lunas-langsung', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') return res.status(401).json({ success: false });
    const id_pre_order = req.params.id;

    const query = 'UPDATE pre_order SET status = ?, status_pembayaran = ? WHERE id_pre_order = ?';
    db.query(query, ['lunas', 'lunas', id_pre_order], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });

        // Buat penjualan dan kurangi stok jika belum ada
        buatPenjualanDariPreOrder(id_pre_order);

        res.json({ success: true, message: 'Pesanan ditandai lunas' });
    });
});

// ============================================
// ENDPOINT MIDTRANS PAYMENT
// ============================================

app.post('/api/bayar/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Belum login' });
    const id_pre_order = req.params.id;

    db.query('SELECT status, jumlah_dp, sisa_pembayaran FROM pre_order WHERE id_pre_order = ?', [id_pre_order], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Pesanan tidak ditemukan' });

        const pesanan = results[0];
        let amount = 0;
        let type = '';

        if (pesanan.status === 'menunggu_dp') {
            amount = parseFloat(pesanan.jumlah_dp);
            type = 'DP';
        } else if (pesanan.status === 'menunggu_pelunasan') {
            amount = parseFloat(pesanan.sisa_pembayaran);
            type = 'LUNAS';
        } else {
            return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status siap dibayar' });
        }

        const parameter = {
            transaction_details: {
                order_id: `PO-${id_pre_order}-${type}-${Date.now()}`,
                gross_amount: amount
            },
            customer_details: {
                first_name: req.session.user.username || 'Pelanggan'
            },
            callbacks: {
                finish: `${req.protocol}://${req.get('host')}/riwayat-pesan.html`
            }
        };

        snap.createTransaction(parameter)
            .then((transaction) => {
                res.json({ success: true, token: transaction.token });
            })
            .catch((e) => {
                console.error('Midtrans Error:', e);
                res.status(500).json({ success: false, message: 'Gagal membuat transaksi Midtrans' });
            });
    });
});

// ============================================
// WEBHOOK MIDTRANS
// ============================================
app.post('/api/midtrans-webhook', (req, res) => {
    const notification = req.body;

    snap.transaction.notification(notification)
        .then((statusResponse) => {
            let orderId = statusResponse.order_id;
            let transactionStatus = statusResponse.transaction_status;
            let fraudStatus = statusResponse.fraud_status;

            console.log(`Notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);

            // Format Order ID from frontend is PO-{id_pre_order}-{type}-{timestamp}
            const parts = orderId.split('-');
            if (parts.length < 3 || parts[0] !== 'PO') {
                return res.status(200).send('Bukan transaksi pre-order yang valid');
            }

            const id_pre_order = parts[1];
            const type = parts[2]; // 'DP' or 'LUNAS'

            if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
                if (fraudStatus == 'challenge') {
                    // ignore challenge for now
                } else if (fraudStatus == 'accept' || !fraudStatus) {
                    if (type === 'DP') {
                        const q = "UPDATE pre_order SET status='diproduksi', status_pembayaran='dp_dibayar' WHERE id_pre_order=?";
                        db.query(q, [id_pre_order]);
                    } else if (type === 'LUNAS') {
                        const q = "UPDATE pre_order SET status='lunas', status_pembayaran='lunas' WHERE id_pre_order=?";
                        db.query(q, [id_pre_order], (err) => {
                            if (!err) buatPenjualanDariPreOrder(id_pre_order);
                        });
                    }
                }
            } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
                if (type === 'DP') {
                    const q = "UPDATE pre_order SET status='ditolak' WHERE id_pre_order=?";
                    db.query(q, [id_pre_order]);
                } else if (type === 'LUNAS') {
                    const q = "UPDATE pre_order SET status='hangus' WHERE id_pre_order=?";
                    db.query(q, [id_pre_order]);
                }
            }

            res.status(200).send('OK');
        })
        .catch(err => {
            console.error('Midtrans Webhook Error:', err);
            res.status(500).send('Error');
        });
});

// ============================================
// SINKRONISASI STATUS MANUAL (Untuk testing localhost / tanpa ngrok)
// ============================================
app.get('/api/sync-midtrans', (req, res) => {
    const orderId = req.query.order_id;
    if (!orderId) return res.status(400).json({ success: false, message: 'Missing order_id' });

    const parts = orderId.split('-');
    if (parts.length < 3 || parts[0] !== 'PO') {
        return res.json({ success: false });
    }

    const id_pre_order = parts[1];
    const type = parts[2]; // 'DP' or 'LUNAS'

    snap.transaction.status(orderId)
        .then((statusResponse) => {
            let transactionStatus = statusResponse.transaction_status;
            let fraudStatus = statusResponse.fraud_status;

            if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
                if (fraudStatus == 'challenge') {
                    // ignore
                } else if (fraudStatus == 'accept' || !fraudStatus) {
                    if (type === 'DP') {
                        const q = "UPDATE pre_order SET status='diproduksi', status_pembayaran='dp_dibayar' WHERE id_pre_order=?";
                        db.query(q, [id_pre_order]);
                    } else if (type === 'LUNAS') {
                        const q = "UPDATE pre_order SET status='lunas', status_pembayaran='lunas' WHERE id_pre_order=?";
                        db.query(q, [id_pre_order], (err) => {
                            if (!err) buatPenjualanDariPreOrder(id_pre_order);
                        });
                    }
                }
            } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
                if (type === 'DP') {
                    const q = "UPDATE pre_order SET status='ditolak' WHERE id_pre_order=?";
                    db.query(q, [id_pre_order]);
                } else if (type === 'LUNAS') {
                    const q = "UPDATE pre_order SET status='hangus' WHERE id_pre_order=?";
                    db.query(q, [id_pre_order]);
                }
            }

            res.json({ success: true, transactionStatus });
        })
        .catch(err => {
            console.error('Midtrans Sync Error (Menggunakan Fallback Lokal):', err);
            // FALLBACK UNTUK LOCALHOST / ERROR KONEKSI MIDTRANS:
            if (type === 'DP') {
                const q = "UPDATE pre_order SET status='diproduksi', status_pembayaran='dp_dibayar' WHERE id_pre_order=?";
                db.query(q, [id_pre_order]);
                return res.json({ success: true, transactionStatus: 'settlement' });
            } else if (type === 'LUNAS') {
                const q = "UPDATE pre_order SET status='lunas', status_pembayaran='lunas' WHERE id_pre_order=?";
                db.query(q, [id_pre_order], (err) => {
                    if (!err) buatPenjualanDariPreOrder(id_pre_order);
                });
                return res.json({ success: true, transactionStatus: 'settlement' });
            }
            res.status(500).json({ success: false, message: 'Midtrans API error' });
        });
});

// ============================================
// ENDPOINT SIMULASI BAYAR (TANPA MIDTRANS - UNTUK TESTING / OFFLINE)
// ============================================
app.post('/api/simulasi-bayar/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Belum login' });
    const id_pre_order = req.params.id;

    db.query('SELECT status, jumlah_dp, sisa_pembayaran FROM pre_order WHERE id_pre_order = ?', [id_pre_order], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Pesanan tidak ditemukan' });

        const pesanan = results[0];

        if (pesanan.status === 'menunggu_dp') {
            const q = "UPDATE pre_order SET status='diproduksi', status_pembayaran='dp_dibayar' WHERE id_pre_order=?";
            db.query(q, [id_pre_order], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
                res.json({ success: true, type: 'DP', message: 'Pembayaran DP 50% Berhasil' });
            });
        } else if (pesanan.status === 'menunggu_pelunasan') {
            const q = "UPDATE pre_order SET status='lunas', status_pembayaran='lunas' WHERE id_pre_order=?";
            db.query(q, [id_pre_order], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
                buatPenjualanDariPreOrder(id_pre_order);
                res.json({ success: true, type: 'LUNAS', message: 'Pembayaran Pelunasan 50% Berhasil' });
            });
        } else {
            return res.status(400).json({ success: false, message: 'Pesanan tidak dalam status siap dibayar' });
        }
    });
});

// ============================================
// API KALKULASI KEBUTUHAN BAHAN BAKU PRE-ORDER
// ============================================
app.get('/api/pre-order/:id/kebutuhan-bahan', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'pemilik') {
        return res.status(401).json({ success: false, message: 'Belum login' });
    }
    const id_pre_order = req.params.id;

    const queryPO = `
        SELECT po.*, dp.nama_pelanggan, p.nama_paket 
        FROM pre_order po
        LEFT JOIN detail_pelanggan dp ON po.id_pelanggan = dp.id_pelanggan
        LEFT JOIN paket p ON po.paket_id = p.id_paket
        WHERE po.id_pre_order = ?
    `;

    db.query(queryPO, [id_pre_order], (err, poResults) => {
        if (err || poResults.length === 0) {
            return res.status(500).json({ success: false, message: 'Pesanan tidak ditemukan' });
        }

        const po = poResults[0];

        const queryBahanNeeded = `
            SELECT 
                bb.id_bahan,
                bb.nama_bahan,
                bb.satuan,
                COALESCE(sb.stok_tersedia, 0) AS stok_tersedia,
                COALESCE(bb.harga_satuan, 0) AS harga_satuan,
                SUM(COALESCE(kp.jumlah, 1) * r.jumlah_butuh * ?) AS kebutuhan_total
            FROM komposisi_paket kp
            JOIN resep r ON kp.menu_id = r.menu_id
            JOIN bahan_baku bb ON r.bahan_id = bb.id_bahan
            LEFT JOIN stok_bahan sb ON bb.id_bahan = sb.bahan_id
            WHERE kp.paket_id = ?
            GROUP BY bb.id_bahan, bb.nama_bahan, bb.satuan, sb.stok_tersedia, bb.harga_satuan
        `;

        db.query(queryBahanNeeded, [po.jumlah_porsi, po.paket_id], (err, bahanResults) => {
            if (err) {
                console.error('Error kalkulasi bahan pre-order:', err);
                return res.status(500).json({ success: false, message: 'Gagal menghitung kebutuhan bahan' });
            }

            const bahanFormatted = bahanResults.map(b => {
                const kebutuhan = parseFloat((parseFloat(b.kebutuhan_total) || 0).toFixed(3));
                const stok = parseFloat((parseFloat(b.stok_tersedia) || 0).toFixed(3));
                const kurang = parseFloat(Math.max(0, kebutuhan - stok).toFixed(3));
                const status = stok >= kebutuhan ? 'Cukup' : 'Kurang';

                return {
                    bahan_id: b.id_bahan,
                    nama_bahan: b.nama_bahan,
                    satuan: b.satuan,
                    stok_tersedia: stok,
                    kebutuhan_total: kebutuhan,
                    kekurangan: kurang,
                    status_stok: status,
                    harga_satuan: parseFloat(b.harga_satuan) || 0
                };
            });

            res.json({
                success: true,
                pesanan: po,
                bahan: bahanFormatted
            });
        });
    });
});

function buatPenjualanDariPreOrder(id_pre_order) {
    db.query('SELECT id_penjualan FROM penjualan WHERE pre_order_id = ?', [id_pre_order], (err, results) => {
        if (err || results.length > 0) return;

        const queryData = `
            SELECT po.*, dp.nama_pelanggan, p.harga_per_porsi, p.nama_paket
            FROM pre_order po
            LEFT JOIN detail_pelanggan dp ON po.id_pelanggan = dp.id_pelanggan
            LEFT JOIN paket p ON po.paket_id = p.id_paket
            WHERE po.id_pre_order = ?
        `;

        db.query(queryData, [id_pre_order], (err, poResults) => {
            if (err || poResults.length === 0) return;

            const po = poResults[0];
            const total_harga = po.jumlah_porsi * parseFloat(po.harga_per_porsi || 0);
            const tanggal = new Date(po.jadwal_ambil).toISOString().split('T')[0];

            const queryInsertPenjualan = `
                INSERT INTO penjualan (user_id, nama_pelanggan, pre_order_id, sumber, tanggal, total_porsi, total_harga)
                VALUES (1, ?, ?, 'preorder', ?, ?, ?)
            `;

            db.query(queryInsertPenjualan, [po.nama_pelanggan || 'Pelanggan', id_pre_order, tanggal, po.jumlah_porsi, total_harga], (err, result) => {
                if (err) return console.error('❌ Error insert penjualan:', err);

                const id_penjualan = result.insertId;
                console.log('✅ Penjualan berhasil dibuat dengan ID:', id_penjualan);

                const queryKomposisi = `
                    SELECT menu_id, jumlah 
                    FROM komposisi_paket 
                    WHERE paket_id = ?
                `;

                db.query(queryKomposisi, [po.paket_id], (err, komposisiResults) => {
                    if (err || komposisiResults.length === 0) return;

                    const queryDetail = 'INSERT INTO detail_penjualan (penjualan_id, menu_id, jumlah_porsi) VALUES (?, ?, ?)';
                    let detailProcessed = 0;

                    komposisiResults.forEach(komp => {
                        const jumlah_porsi = komp.jumlah * po.jumlah_porsi;
                        db.query(queryDetail, [id_penjualan, komp.menu_id, jumlah_porsi], (err) => {
                            detailProcessed++;
                            if (detailProcessed === komposisiResults.length) {
                                kurangiStokBahanBaku(id_penjualan, (err) => {
                                    if (err) console.error('❌ Gagal mengurangi stok bahan baku:', err);
                                    else console.log('✅ Stok bahan baku dikurangi dari pre-order!');
                                });
                            }
                        });
                    });
                });
            });
        });
    });
}

// ============================================
// 17. JALANKAN SERVER
// ============================================
const PORT = 3002;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});