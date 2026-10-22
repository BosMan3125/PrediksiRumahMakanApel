// ===== VARIABEL GLOBAL =====
let hasilPrediksiMenu = [];

// Format angka desimal khas Indonesia (menggunakan koma, tanpa nol buntut)
function formatDesimalIndo(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = parseFloat(val);
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    renderPlaceholderCards();
    setupLogout();
});

// ===== FUNGSI AMBIL INFO USER =====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        const data = await response.json();
        if (response.ok && data.role === 'pemilik') {
            document.getElementById('display-username').textContent = data.username;
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        window.location.href = '/login.html';
    }
}

// ===== RENDER CARD KOSONG (STATE AWAL SEBELUM PREDIKSI) =====
function renderPlaceholderCards() {
    const gridPlaceholder = document.getElementById('grid-placeholder');
    if (!gridPlaceholder) return;

    const dummyCards = [
        { icon: '🍲', title: 'Resep Menu #1' },
        { icon: '🍗', title: 'Resep Menu #2' },
        { icon: '🥗', title: 'Resep Menu #3' },
        { icon: '🍛', title: 'Resep Menu #4' },
        { icon: '🍜', title: 'Resep Menu #5' },
        { icon: '🍳', title: 'Resep Menu #6' }
    ];

    gridPlaceholder.innerHTML = dummyCards.map(c => `
        <div class="placeholder-card">
            <div class="placeholder-card-icon">${c.icon}</div>
            <div class="placeholder-card-title">${c.title}</div>
            <div class="placeholder-card-desc">
                Belum ada kalkulasi porsi.<br>Klik tombol <strong>Prediksi</strong> di atas untuk memproses WMA 7 hari.
            </div>
        </div>
    `).join('');
}

// ===== FORMAT TANGGAL INDO UNTUK FRONTEND =====
const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function formatTgl(dateObj) {
    return `${dateObj.getDate()} ${bulanIndo[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

// ===== JALANKAN PREDIKSI (BUKA POPUP KONFIRMASI) =====
async function jalankanPrediksi() {
    const btnPrediksi = document.getElementById('btn-prediksi');
    const originalText = btnPrediksi.innerHTML;
    btnPrediksi.disabled = true;
    btnPrediksi.innerHTML = '⏳ Menyiapkan...';

    try {
        // Ambil info tanggal riwayat WMA
        const response = await fetch('/api/info-tanggal-wma');
        const data = await response.json();

        if (response.ok && data.success) {
            // Target Prediksi (Hari ini s/d 7 Hari Kedepan)
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + 6); // Hari ini + 6 hari = 7 hari

            const targetText = `${formatTgl(today)} s/d ${formatTgl(futureDate)}`;
            document.getElementById('konfirmasi-target-prediksi').textContent = targetText;

            // Sumber Data Analisis
            if (data.periode_info) {
                document.getElementById('konfirmasi-sumber-data').textContent = data.periode_info;
            } else {
                document.getElementById('konfirmasi-sumber-data').textContent = 'Belum ada data transaksi';
            }

            // Tampilkan Popup
            document.getElementById('popup-konfirmasi-prediksi').style.display = 'flex';
        } else {
            alert('Gagal mengambil info tanggal: ' + (data.message || 'Terjadi kesalahan sistem'));
        }
    } catch (error) {
        console.error('Error info tanggal:', error);
        alert('Terjadi kesalahan jaringan saat mengambil info prediksi');
    } finally {
        btnPrediksi.disabled = false;
        btnPrediksi.innerHTML = originalText;
    }
}

// ===== TUTUP POPUP KONFIRMASI =====
function tutupPopupKonfirmasi() {
    document.getElementById('popup-konfirmasi-prediksi').style.display = 'none';
}

// ===== PROSES PREDIKSI MENU (WMA 7 HARI) =====
async function prosesPrediksiWMA() {
    tutupPopupKonfirmasi();

    const btnPrediksi = document.getElementById('btn-prediksi');
    const originalText = btnPrediksi.innerHTML;
    btnPrediksi.disabled = true;
    btnPrediksi.innerHTML = '⏳ Menghitung WMA...';

    try {
        const response = await fetch('/api/prediksi-menu-wma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            hasilPrediksiMenu = data.hasil || [];

            if (hasilPrediksiMenu.length === 0) {
                alert('Belum ada data penjualan yang bisa dianalisis untuk metode WMA.');
                btnPrediksi.disabled = false;
                btnPrediksi.innerHTML = originalText;
                return;
            }

            // Tampilkan rentang tanggal transaksi yang dianalisis
            const infoTanggal = document.getElementById('info-rentang-tanggal');

            // Kita ubah info tanggal agar menampilkan Target Prediksi + Sumber Data
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + 6);

            if (data.periode_info) {
                infoTanggal.innerHTML = `📅 <strong>Target Prediksi:</strong> ${formatTgl(today)} s/d ${formatTgl(futureDate)}<br><span style="font-size: 12px; color: #666; font-weight: normal;">${data.periode_info}</span>`;
                infoTanggal.style.display = 'block';
            }

            // Sembunyikan placeholder, tampilkan kartu hasil prediksi
            document.getElementById('placeholder-container').style.display = 'none';
            document.getElementById('tabel-prediksi-container').style.display = 'block';
            document.getElementById('btn-batalkan').style.display = 'inline-block';
            document.getElementById('btn-kirim-belanja').style.display = 'inline-block';

            renderResepCards(hasilPrediksiMenu);
        } else {
            alert('Gagal menjalankan prediksi: ' + (data.message || 'Terjadi kesalahan sistem'));
        }
    } catch (error) {
        console.error('Error prediksi:', error);
        alert('Terjadi kesalahan jaringan saat menjalankan prediksi');
    } finally {
        btnPrediksi.disabled = false;
        btnPrediksi.innerHTML = originalText;
    }
}

// ===== RENDER KARTU RESEP HASIL PREDIKSI =====
function renderResepCards(daftarResep) {
    const gridResep = document.getElementById('grid-resep-prediksi');
    if (!gridResep) return;

    if (daftarResep.length === 0) {
        gridResep.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999; padding: 40px;">Tidak ada menu yang diprediksi</div>';
        return;
    }

    gridResep.innerHTML = daftarResep.map(item => {
        // Tentukan gambar menu / fallback
        let gambarSrc = 'images/paket-default.jpg';
        if (item.gambar) {
            gambarSrc = item.gambar.startsWith('/') ? item.gambar : `/${item.gambar}`;
        }

        const porsi = item.porsi_prediksi || 0;
        const jumlahBahan = item.bahan ? item.bahan.length : 0;

        return `
            <div class="resep-prediksi-card" onclick="bukaPopupDetailResep(${item.id_menu})">
                <img src="${gambarSrc}" alt="${item.nama_menu}" class="resep-prediksi-img" onerror="this.src='images/paket-default.jpg'">
                <div class="resep-prediksi-body">
                    <h3 class="resep-prediksi-title">${item.nama_menu}</h3>
                    
                    <div class="resep-prediksi-porsi-badge">
                        <span class="resep-prediksi-porsi-label">Prediksi 7 Hari:</span>
                        <span class="resep-prediksi-porsi-val">${porsi} Porsi</span>
                    </div>

                    <div class="resep-prediksi-footer">
                        <span>📦 ${jumlahBahan} Komposisi Bahan</span>
                        <span class="btn-detail-resep">Lihat Bahan ➜</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== BUKA POPUP DETAIL RESEP PREDIKSI =====
function bukaPopupDetailResep(idMenu) {
    const resep = hasilPrediksiMenu.find(r => r.id_menu === idMenu);
    if (!resep) return;

    // Set gambar
    let gambarSrc = 'images/paket-default.jpg';
    if (resep.gambar) {
        gambarSrc = resep.gambar.startsWith('/') ? resep.gambar : `/${resep.gambar}`;
    }
    const imgEl = document.getElementById('popup-resep-img');
    imgEl.src = gambarSrc;
    imgEl.onerror = () => { imgEl.src = 'images/paket-default.jpg'; };

    // Set Nama & Porsi
    document.getElementById('popup-resep-nama').textContent = resep.nama_menu;
    document.getElementById('popup-resep-porsi').textContent = `${resep.porsi_prediksi} Porsi`;
    document.getElementById('popup-resep-porsi-inline').textContent = resep.porsi_prediksi;

    // Render Tabel Bahan Baku
    const tbody = document.getElementById('tbody-detail-bahan');
    if (!resep.bahan || resep.bahan.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 18px;">Belum ada data komposisi bahan baku untuk resep ini</td></tr>';
    } else {
        tbody.innerHTML = resep.bahan.map(b => `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px; font-weight: 600; color: #2c3e50;">${b.nama_bahan}</td>
                <td style="padding: 10px; text-align: right; color: #7f8c8d;">${formatDesimalIndo(b.butuh_per_porsi)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; color: #27ae60; font-size: 14px;">
                    ${formatDesimalIndo(b.total_kebutuhan)}
                </td>
                <td style="padding: 10px; color: #555;">${b.satuan}</td>
            </tr>
        `).join('');
    }

    document.getElementById('popup-detail-resep').style.display = 'flex';
}

// ===== TUTUP POPUP DETAIL RESEP =====
function tutupPopupDetailResep() {
    document.getElementById('popup-detail-resep').style.display = 'none';
}

// ===== BATALKAN / RESET PREDIKSI KE STATE AWAL =====
function batalkanPrediksi() {
    hasilPrediksiMenu = [];
    document.getElementById('tabel-prediksi-container').style.display = 'none';
    document.getElementById('info-rentang-tanggal').style.display = 'none';
    document.getElementById('btn-batalkan').style.display = 'none';
    document.getElementById('btn-kirim-belanja').style.display = 'none';
    document.getElementById('placeholder-container').style.display = 'block';
    renderPlaceholderCards();
}

// ===== MASUKKAN KE BELANJA BAHAN =====
async function masukkanKeBelanjaBahan() {
    if (!hasilPrediksiMenu || hasilPrediksiMenu.length === 0) {
        alert('Belum ada hasil prediksi untuk dikirim.');
        return;
    }

    const btnKirim = document.getElementById('btn-kirim-belanja');
    const originalText = btnKirim.innerHTML;
    btnKirim.disabled = true;
    btnKirim.innerHTML = '⏳ Mengirim...';

    try {
        // Agregasi bahan baku
        const aggregatedBahan = {};
        
        hasilPrediksiMenu.forEach(menu => {
            if (menu.bahan && menu.bahan.length > 0) {
                menu.bahan.forEach(b => {
                    if (!aggregatedBahan[b.bahan_id]) {
                        aggregatedBahan[b.bahan_id] = {
                            bahan_id: b.bahan_id,
                            harga_satuan: b.harga_satuan || 0, // Menggunakan harga asli dari database
                            jumlah_rekomendasi: 0
                        };
                    }
                    aggregatedBahan[b.bahan_id].jumlah_rekomendasi += parseFloat(b.total_kebutuhan);
                });
            }
        });

        const itemsToSend = Object.values(aggregatedBahan);

        if (itemsToSend.length === 0) {
            alert('Tidak ada bahan baku yang dapat dikirim.');
            btnKirim.disabled = false;
            btnKirim.innerHTML = originalText;
            return;
        }

        const response = await fetch('/api/kirim-prediksi-ke-belanja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: itemsToSend,
                sumber: 'Prediksi WMA 7 Hari'
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert('Berhasil! Bahan baku telah dikirim ke Daftar Belanja.');
            // Redirect ke halaman belanja bahan tab daftar
            window.location.href = 'belanja-bahan-pemilik.html?tab=daftar';
        } else {
            alert('Gagal mengirim ke belanja bahan: ' + (data.message || 'Kesalahan sistem'));
        }
    } catch (error) {
        console.error('Error kirim belanja:', error);
        alert('Terjadi kesalahan jaringan saat mengirim ke belanja bahan');
    } finally {
        btnKirim.disabled = false;
        btnKirim.innerHTML = originalText;
    }
}

// ===== LOGOUT =====
function setupLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const response = await fetch('/logout', { method: 'POST' });
                if (response.ok) window.location.href = '/login.html';
            } catch (error) {
                console.error('Error logout:', error);
            }
        });
    }
}

// ===== TUTUP POPUP SAAT KLIK DI LUAR BOX =====
document.addEventListener('click', (e) => {
    const popupDetail = document.getElementById('popup-detail-resep');
    if (e.target === popupDetail) {
        tutupPopupDetailResep();
    }
});