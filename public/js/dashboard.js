// ===== VARIABEL GLOBAL =====
let pesananAktif = null;
let isLoggedIn = false;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    loadDashboardData();
    setupPopupListeners();
});

// ===== FUNGSI AMBIL INFO USER =====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        const data = await response.json();

        if (response.ok) {
            isLoggedIn = true;
            document.getElementById('display-username').textContent = data.username;
            document.getElementById('welcome-name').textContent = data.username;
            // Sembunyikan tombol login, tampilkan tombol logout
            const btnLoginHeader = document.getElementById('btn-login-header');
            if (btnLoginHeader) btnLoginHeader.style.display = 'none';
            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) btnLogout.style.display = 'flex';
        } else {
            isLoggedIn = false;
            document.getElementById('display-username').textContent = 'Tamu';
            document.getElementById('welcome-name').textContent = 'Tamu';
            // Tampilkan tombol login di header, sembunyikan logout di sidebar
            const btnLoginHeader = document.getElementById('btn-login-header');
            if (btnLoginHeader) btnLoginHeader.style.display = 'inline-flex';
            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) btnLogout.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        isLoggedIn = false;
        document.getElementById('display-username').textContent = 'Tamu';
        document.getElementById('welcome-name').textContent = 'Tamu';
        const btnLoginHeader = document.getElementById('btn-login-header');
        if (btnLoginHeader) btnLoginHeader.style.display = 'inline-flex';
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.style.display = 'none';
    }
}

// ===== FUNGSI AMBIL DATA DASHBOARD =====
async function loadDashboardData() {
    // Jika belum login, tampilkan konten kosong untuk tamu
    if (!isLoggedIn) {
        // Konten ringkasan pesanan tetap 0
        // Konten detail pesanan tampilkan pesan tamu
        const orderDetailDiv = document.querySelector('.order-detail');
        if (orderDetailDiv) {
            orderDetailDiv.innerHTML = `
                <div class="order-header"><h3>Detail Pesanan</h3></div>
                <div style="text-align: center; padding: 40px; color: #999;">
                    <p>Silakan <a href="login.html" style="color: #e31e24; font-weight: 600;">login</a> untuk melihat pesanan Anda</p>
                </div>
            `;
        }
        // Tetap load paket tersedia (tidak perlu login)
        try {
            const resp = await fetch('/api/paket-tersedia');
            const pkData = await resp.json();
            if (resp.ok) updatePaketTersedia(pkData);
        } catch (e) { console.error('Gagal memuat paket:', e); }
        return;
    }

    try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();

        if (response.ok) {
            // Update ringkasan pesanan
            document.querySelector('.summary-card.pending .card-number').textContent = data.ringkasan.pending;
            document.querySelector('.summary-card.accepted .card-number').textContent = data.ringkasan.diterima;
            document.querySelector('.summary-card.rejected .card-number').textContent = data.ringkasan.ditolak;

            // Update detail pesanan terbaru
            updateDetailPesanan(data.pesananTerbaru);

            // Update paket yang tersedia
            updatePaketTersedia(data.paketTersedia);
        } else {
            console.error('Gagal memuat dashboard data');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function formatStatusLabel(status, statusPembayaran) {
    if (statusPembayaran === 'hangus' || status === 'hangus') return 'Hangus';
    if (!status) return '-';
    const s = String(status).toLowerCase().trim();
    switch (s) {
        case 'pending': return 'Pending';
        case 'diterima': return 'Diterima';
        case 'ditolak': return 'Ditolak';
        case 'menunggu_dp':
        case 'menunggu-dp': return 'Menunggu DP';
        case 'diproduksi': return 'Diproduksi';
        case 'menunggu_pelunasan':
        case 'menunggu-pelunasan': return 'Menunggu Pelunasan';
        case 'lunas': return 'Lunas';
        case 'selesai': return 'Selesai';
        case 'hangus': return 'Hangus';
        case 'batal':
        case 'dibatalkan': return 'Dibatalkan';
        default:
            return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}

function formatStatusPembayaranLabel(statusPembayaran) {
    if (!statusPembayaran) return 'Belum Bayar';
    switch (statusPembayaran.toLowerCase()) {
        case 'dp_lunas': return 'DP 50% Lunas';
        case 'lunas': return 'Lunas';
        case 'hangus': return 'Hangus';
        case 'belum_bayar': default: return 'Belum Bayar';
    }
}

// ===== SETUP LISTENER UNTUK POPUP =====
function setupPopupListeners() {
    // Tombol tutup popup
    const btnTutup = document.getElementById('btn-tutup-popup');
    if (btnTutup) {
        btnTutup.addEventListener('click', tutupPopupDetail);
    }

    // Tombol batalkan pesanan
    const btnBatalkan = document.getElementById('btn-batalkan-pesanan');
    if (btnBatalkan) {
        btnBatalkan.addEventListener('click', batalkanPesanan);
    }

    // Tutup popup jika klik di luar box
    const popupOverlay = document.getElementById('popup-detail-pesanan');
    if (popupOverlay) {
        popupOverlay.addEventListener('click', (e) => {
            if (e.target === popupOverlay) {
                tutupPopupDetail();
            }
        });
    }
}

// ===== FUNGSI BUKA POPUP DETAIL =====
function bukaPopupDetail(pesanan) {
    if (!pesanan) return;

    pesananAktif = pesanan;

    // Update judul dan status
    document.getElementById('popup-detail-title').textContent = `Detail Pesanan #PO-${String(pesanan.id_pre_order).padStart(3, '0')}`;

    const isHangus = pesanan.status === 'hangus' || pesanan.status_pembayaran === 'hangus';
    const statusClass = isHangus ? 'hangus' : (pesanan.status ? pesanan.status.toLowerCase() : 'pending');
    const statusText = formatStatusLabel(pesanan.status, pesanan.status_pembayaran);

    const statusBadge = document.getElementById('popup-detail-status');
    if (statusBadge) {
        statusBadge.textContent = statusText;
        statusBadge.className = `status-badge ${statusClass}`;
    }

    // Format tanggal
    const tanggalPesanan = new Date(pesanan.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const jadwalAmbil = new Date(pesanan.jadwal_ambil).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) + ', ' + new Date(pesanan.jadwal_ambil).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    }) + ' WIB';

    // Hitung total harga & DP
    const totalHarga = parseFloat(pesanan.total_harga || (pesanan.jumlah_porsi * pesanan.harga_per_porsi));
    const dpAmount = totalHarga * 0.5;
    const sisaAmount = totalHarga - dpAmount;

    // Isi data ke popup
    document.getElementById('popup-tanggal').textContent = `: ${tanggalPesanan}`;
    document.getElementById('popup-jam').textContent = `: ${jadwalAmbil}`;
    document.getElementById('popup-paket').textContent = `: ${pesanan.nama_paket || 'N/A'}`;
    document.getElementById('popup-porsi').textContent = `: ${pesanan.jumlah_porsi} Porsi`;
    document.getElementById('popup-harga').textContent = `: Rp ${parseInt(pesanan.harga_per_porsi).toLocaleString('id-ID')}`;
    document.getElementById('popup-total').textContent = `: Rp ${totalHarga.toLocaleString('id-ID')}`;

    const statusBayarEl = document.getElementById('popup-status-pembayaran');
    if (statusBayarEl) {
        statusBayarEl.textContent = `: ${formatStatusPembayaranLabel(pesanan.status_pembayaran)}`;
    }

    const dpEl = document.getElementById('popup-dp');
    if (dpEl) {
        dpEl.textContent = `: Rp ${dpAmount.toLocaleString('id-ID')} (50%)`;
    }

    const sisaEl = document.getElementById('popup-sisa');
    if (sisaEl) {
        sisaEl.textContent = `: Rp ${sisaAmount.toLocaleString('id-ID')}`;
    }

    // Isi menu paket
    const isiMenuList = document.getElementById('popup-isi-paket-list');
    if (isiMenuList) {
        if (pesanan.isi_menu_detail && pesanan.isi_menu_detail.length > 0) {
            isiMenuList.innerHTML = pesanan.isi_menu_detail.map(item => `<li>${item}</li>`).join('');
        } else if (pesanan.menus && pesanan.menus.length > 0) {
            isiMenuList.innerHTML = pesanan.menus.map(item => `<li>${item}</li>`).join('');
        } else {
            isiMenuList.innerHTML = '<li>Nasi</li><li>Lauk Sesuai Paket</li><li>Sayur</li><li>Air Mineral</li>';
        }
    }

    // Dynamic Action Buttons
    const buttonsContainer = document.querySelector('#popup-detail-pesanan .popup-detail-buttons');
    if (buttonsContainer) {
        let buttonsHtml = `<button class="btn-tutup" onclick="tutupPopupDetail()">Tutup</button>`;

        // Tombol bayar Midtrans
        if (pesanan.status === 'menunggu_dp') {
            buttonsHtml += `<button class="btn-bayar-popup" style="background-color: #28a745; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer;" onclick="bayarPesanan(${pesanan.id_pre_order})">💳 Bayar DP 50% (Rp ${dpAmount.toLocaleString('id-ID')})</button>`;
        } else if (pesanan.status === 'menunggu_pelunasan') {
            buttonsHtml += `<button class="btn-bayar-popup" style="background-color: #28a745; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer;" onclick="bayarPesanan(${pesanan.id_pre_order})">💳 Bayar Pelunasan (Rp ${sisaAmount.toLocaleString('id-ID')})</button>`;
        }

        // Tombol batalkan
        const bisaBatal = ['pending', 'menunggu_dp', 'diproduksi', 'menunggu_pelunasan'].includes(pesanan.status);
        if (bisaBatal) {
            buttonsHtml += `<button class="btn-batalkan" onclick="batalkanPesanan()">Batalkan Pesanan</button>`;
        }

        buttonsContainer.innerHTML = buttonsHtml;
    }

    // Tampilkan popup
    document.getElementById('popup-detail-pesanan').style.display = 'flex';
}

// ===== FUNGSI TUTUP POPUP =====
function tutupPopupDetail() {
    document.getElementById('popup-detail-pesanan').style.display = 'none';
    pesananAktif = null;
}

// ===== FUNGSI BAYAR PESANAN MIDTRANS =====
async function bayarPesanan(idPreOrder) {
    try {
        const response = await fetch(`/api/bayar/${idPreOrder}`, {
            method: 'POST'
        });

        const data = await response.json();
        if (response.ok && data.success) {
            window.snap.pay(data.token, {
                onSuccess: async function (result) {
                    if (result.order_id) {
                        try {
                            await fetch(`/api/sync-midtrans?order_id=${result.order_id}`);
                        } catch (e) {
                            console.error('Gagal sync midtrans dari popup', e);
                        }
                    }
                    if (result.order_id && result.order_id.includes('-DP-')) {
                        alert("Pembayaran DP 50% anda berhasil\npesanan anda sedang diproduksi");
                    } else {
                        alert("Pembayaran Pelunasan anda berhasil\npesanan anda sudah lunas");
                    }
                    tutupPopupDetail();
                    loadDashboardData();
                },
                onPending: async function (result) {
                    if (result.order_id) {
                        try {
                            await fetch(`/api/sync-midtrans?order_id=${result.order_id}`);
                        } catch (e) { }
                    }
                    alert("Pembayaran anda sedang diproses");
                    tutupPopupDetail();
                    loadDashboardData();
                },
                onError: function (result) {
                    alert("Pembayaran gagal!");
                },
                onClose: function () {
                    console.log('User menutup popup pembayaran');
                }
            });
        } else {
            alert('Gagal memproses pembayaran: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error bayar:', error);
        alert('Terjadi kesalahan saat memproses pembayaran');
    }
}

// ===== FUNGSI BATALKAN PESANAN =====
async function batalkanPesanan() {
    if (!pesananAktif) return;

    const konfirmasi = confirm('Apakah Anda yakin ingin membatalkan pesanan ini?');
    if (!konfirmasi) return;

    try {
        const response = await fetch('/api/batalkan-pesanan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_pre_order: pesananAktif.id_pre_order
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message || 'Pesanan berhasil dibatalkan');
            tutupPopupDetail();
            // Reload dashboard untuk update data
            loadDashboardData();
        } else {
            alert('Gagal membatalkan pesanan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat membatalkan pesanan');
    }
}

// ===== FUNGSI UPDATE DETAIL PESANAN =====
function updateDetailPesanan(pesanan) {
    const orderDetailDiv = document.querySelector('.order-detail');

    // Jika tidak ada pesanan ATAU status kosong / ditolak / hangus / batal -> tampilkan 'Belum ada pesanan'
    if (!pesanan || !pesanan.status || pesanan.status === '' || ['ditolak', 'hangus', 'batal'].includes(pesanan.status) || pesanan.status_pembayaran === 'hangus') {
        orderDetailDiv.innerHTML = `
            <div class="order-header">
                <h3>Detail Pesanan</h3>
            </div>
            <div style="text-align: center; padding: 40px; color: #999;">
                <p>Belum ada pesanan</p>
                <p style="font-size: 14px; margin-top: 10px;">Silakan pesan paket makanan Anda</p>
            </div>
        `;
        pesananAktif = null;
        return;
    }

    // Format tanggal
    const tanggalPesanan = new Date(pesanan.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const jadwalAmbil = new Date(pesanan.jadwal_ambil).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) + ', ' + new Date(pesanan.jadwal_ambil).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    }) + ' WIB';

    // Tentukan status badge
    const isHangus = pesanan.status === 'hangus' || pesanan.status_pembayaran === 'hangus';
    const statusClass = isHangus ? 'hangus' : (pesanan.status ? pesanan.status.toLowerCase() : 'pending');
    const statusText = formatStatusLabel(pesanan.status, pesanan.status_pembayaran);

    // Hitung total harga & DP
    const totalHarga = parseFloat(pesanan.total_harga || (pesanan.jumlah_porsi * pesanan.harga_per_porsi));
    const dpAmount = totalHarga * 0.5;
    const sisaAmount = totalHarga - dpAmount;

    let payBtnCard = '';
    if (pesanan.status === 'menunggu_dp') {
        payBtnCard = `<div style="margin-top: 10px;"><button class="btn-bayar-action" style="background-color: #28a745; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer;" onclick="event.stopPropagation(); bayarPesanan(${pesanan.id_pre_order})">💳 Bayar DP 50% Awal </button></div>`;
    } else if (pesanan.status === 'menunggu_pelunasan') {
        payBtnCard = `<div style="margin-top: 10px;"><button class="btn-bayar-action" style="background-color: #28a745; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer;" onclick="event.stopPropagation(); bayarPesanan(${pesanan.id_pre_order})">💳 Bayar DP 50% Akhir </button></div>`;
    }

    orderDetailDiv.innerHTML = `
        <div class="order-header">
            <h3>Detail Pesanan #PO-${String(pesanan.id_pre_order).padStart(3, '0')}</h3>
            <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="order-info" style="cursor: pointer;" onclick="bukaPopupDetailFromCard(${pesanan.id_pre_order})">
            <div class="info-row">
                <span class="info-label">📅 Tanggal Pesan</span>
                <span class="info-value">: ${tanggalPesanan}</span>
            </div>
            <div class="info-row">
                <span class="info-label">⏰ Jam Ambil</span>
                <span class="info-value">: ${jadwalAmbil}</span>
            </div>
            <div class="info-row">
                <span class="info-label">📦 Paket Pilihan</span>
                <span class="info-value">: ${pesanan.nama_paket || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">🍽️ Jumlah Porsi</span>
                <span class="info-value">: ${pesanan.jumlah_porsi} Porsi</span>
            </div>
            <div class="info-row">
                <span class="info-label">💰 Harga Per Porsi</span>
                <span class="info-value">: Rp ${parseInt(pesanan.harga_per_porsi).toLocaleString('id-ID')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">💸 Total Harga</span>
                <span class="info-value" style="font-weight: bold; color: #1a1a1a;">: Rp ${totalHarga.toLocaleString('id-ID')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">💳 Status Bayar</span>
                <span class="info-value">: ${formatStatusPembayaranLabel(pesanan.status_pembayaran)}</span>
            </div>
            ${payBtnCard}
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center; color: #666666; font-size: 13px;">
                Klik untuk lihat detail lengkap ➔
            </div>
        </div>
    `;

    // Simpan data pesanan untuk dibuka di popup
    window.pesananDariCard = pesanan;
}

// ===== FUNGSI BUKA POPUP DARI CARD =====
function bukaPopupDetailFromCard(idPreOrder) {
    if (window.pesananDariCard && window.pesananDariCard.id_pre_order === idPreOrder) {
        bukaPopupDetail(window.pesananDariCard);
    }
}

// ===== FUNGSI UPDATE PAKET TERSEDIA =====
function updatePaketTersedia(paketList) {
    const availablePackageDiv = document.querySelector('.available-package');

    if (!paketList || paketList.length === 0) {
        availablePackageDiv.innerHTML = `
            <h3>Paket yang Tersedia</h3>
            <div style="text-align: center; padding: 40px; color: #999;">
                <p>Tidak ada paket tersedia</p>
            </div>
        `;
        return;
    }

    // Tampilkan SEMUA paket yang tersedia (bukan hanya paket pertama!)
    const paketCards = paketList.map(paket => {
        // Ambil menu dari database
        const menuList = paket.menus && paket.menus.length > 0
            ? paket.menus.map(m => `<li>${m}</li>`).join('')
            : '<li>Menu belum tersedia</li>';

        const hargaFormat = 'Rp ' + parseInt(paket.harga_per_porsi).toLocaleString('id-ID');

        return `
            <div class="package-card">
                <img src="${paket.gambar || 'images/paket-hemat.jpg'}" alt="${paket.nama_paket}" class="package-image">
                <div class="package-info">
                    <h4>${paket.nama_paket}</h4>
                    <p class="package-menu">Isi Menu:</p>
                    <ul>
                        ${menuList}
                    </ul>
                    <p class="package-price">${hargaFormat} / Porsi</p>
                    <button class="btn-pesan" onclick="handlePesanFromDashboard()">Pesan</button>
                </div>
            </div>
        `;
    }).join('');

    availablePackageDiv.innerHTML = `
        <h3>Paket yang Tersedia</h3>
        ${paketCards}
        <button class="btn-lihat-semua" onclick="window.location.href='beli-paket.html'">Lihat lainnya</button>
    `;
}

// ===== FUNGSI HANDLE PESAN DARI DASHBOARD =====
function handlePesanFromDashboard() {
    if (!isLoggedIn) {
        window.location.href = '/login.html';
    } else {
        window.location.href = 'beli-paket.html';
    }
}
// ===== FUNGSI LOGOUT =====
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/login.html';
            } else {
                alert('Gagal logout');
            }
        } catch (error) {
            console.error('Error logout:', error);
            alert('Terjadi kesalahan saat logout');
        }
    });
}