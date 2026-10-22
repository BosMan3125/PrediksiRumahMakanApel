// ===== VARIABEL GLOBAL =====
let semuaPesanan = [];
let pesananAktif = null;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadRiwayatPesanan();
    setupEventListeners();
});

// ===== FUNGSI AMBIL INFO USER =====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('display-username').textContent = data.username;
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        window.location.href = '/login.html';
    }
}

// ===== FUNGSI AMBIL RIWAYAT PESANAN DARI DATABASE =====
async function loadRiwayatPesanan() {
    try {
        const response = await fetch('/api/riwayat-pesanan');
        const data = await response.json();
        
        if (response.ok) {
            semuaPesanan = data;

            // Cek URL parameter untuk sinkronisasi paksa dari redirect Midtrans (Solusi tanpa ngrok)
            const urlParams = new URLSearchParams(window.location.search);
            const orderId = urlParams.get('order_id');

            if (orderId) {
                try {
                    // Selalu panggil backend untuk nge-cek status asli dari Midtrans API
                    const syncRes = await fetch(`/api/sync-midtrans?order_id=${orderId}`);
                    const syncData = await syncRes.json();
                    
                    if (syncData.success && (syncData.transactionStatus === 'settlement' || syncData.transactionStatus === 'capture')) {
                        if (orderId.includes('-DP-')) {
                            alert("Pembayaran DP 50% anda berhasil\npesanan anda sedang diproduksi");
                        } else if (orderId.includes('-LUNAS-')) {
                            alert("Pembayaran Pelunasan anda berhasil\npesanan anda sudah lunas");
                        }
                        
                        // Karena status di database sudah diupdate, kita refresh datanya
                        const updatedRes = await fetch('/api/riwayat-pesanan');
                        const updatedData = await updatedRes.json();
                        if (updatedRes.ok) semuaPesanan = updatedData;
                    } else if (syncData.success) {
                        alert(`Pembayaran dengan status: ${syncData.transactionStatus}. Silakan tunggu konfirmasi.`);
                    } else {
                        alert("Gagal memverifikasi status pembayaran ke server.");
                    }
                } catch (e) {
                    console.error('Gagal sync midtrans', e);
                    alert("Koneksi ke server gagal saat memverifikasi pembayaran. Cek koneksi internet Anda atau cek terminal server (apakah server error/crash).");
                }
                
                // Hapus parameter dari URL agar alert & update tidak terjadi berulang kali saat di-refresh
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({path: newUrl}, '', newUrl);
            }

            renderRiwayat(semuaPesanan);
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Gagal memuat riwayat pesanan:', error);
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

// ===== FUNGSI TAMPILKAN CARD RIWAYAT =====
function renderRiwayat(listPesanan) {
    const grid = document.getElementById('riwayat-grid');
    
    if (listPesanan.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">Belum ada riwayat pesanan.</p>';
        return;
    }

    grid.innerHTML = listPesanan.map(pesanan => {
        const tanggalPesan = new Date(pesanan.created_at).toLocaleDateString('id-ID', {
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

        const totalHarga = pesanan.jumlah_porsi * pesanan.harga_per_porsi;
        const isHangus = pesanan.status === 'hangus' || pesanan.status_pembayaran === 'hangus';
        const statusClass = isHangus ? 'hangus' : (pesanan.status ? pesanan.status.toLowerCase() : 'hangus');
        const statusText = formatStatusLabel(pesanan.status, pesanan.status_pembayaran);

        // Tombol batalkan muncul untuk status pending, menunggu_dp, diproduksi, atau menunggu_pelunasan
        const bisaBatal = ['pending', 'menunggu_dp', 'diproduksi', 'menunggu_pelunasan'].includes(pesanan.status);
        const btnBatalkan = bisaBatal 
            ? `<button class="btn-batal" onclick="batalkanPesanan(${pesanan.id_pre_order})">Batalkan</button>` 
            : '';

        // Tombol bayar Midtrans
        const btnBayar = (pesanan.status === 'menunggu_dp' || pesanan.status === 'menunggu_pelunasan')
            ? `
                <button class="btn-bayar" style="background-color: #28a745; color: white; padding: 6px 10px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;" onclick="bayarPesanan(${pesanan.id_pre_order})">💳 Bayar</button>
              `
            : '';

        return `
            <div class="riwayat-card">
                <div class="card-header">
                    <h3 class="card-title">#PO-${String(pesanan.id_pre_order).padStart(3, '0')} - ${pesanan.nama_paket}</h3>
                    <p class="card-date">${tanggalPesan}</p>
                </div>
                <div class="card-body">
                    <p> Jadwal Ambil : ${jadwalAmbil}</p>
                    <p>🍽️ Jumlah Porsi : ${pesanan.jumlah_porsi} Porsi</p>
                    <p> Isi Paket : ${pesanan.isi_menu || 'N/A'}</p>
                    <p>💰 Total : Rp ${totalHarga.toLocaleString('id-ID')}</p>
                </div>
                <div class="card-footer">
                    <div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="card-buttons">
                        <button class="btn-detail" onclick="bukaPopupDetail(${pesanan.id_pre_order})">Lihat Detail</button>
                        ${btnBatalkan}
                        ${btnBayar}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== FUNGSI SIMULASI BAYAR (TANPA MIDTRANS - UNTUK TESTING / KONEKSI LEMAH) =====
async function simulasiBayar(idPreOrder) {
    const konfirmasi = confirm('Jalankan simulasi pembayaran instant (tanpa gateway Midtrans)?');
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/simulasi-bayar/${idPreOrder}`, { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (data.type === 'DP') {
                alert("Pembayaran DP 50% anda berhasil\npesanan anda sedang diproduksi");
            } else {
                alert("Pembayaran Pelunasan anda berhasil\npesanan anda sudah lunas");
            }
            loadRiwayatPesanan();
        } else {
            alert('Gagal simulasi bayar: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error simulasi bayar:', error);
        alert('Terjadi kesalahan koneksi.');
    }
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
    // Fitur pencarian
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const pesananFilter = semuaPesanan.filter(p => 
            p.nama_paket.toLowerCase().includes(keyword) || 
            `PO-${String(p.id_pre_order).padStart(3, '0')}`.toLowerCase().includes(keyword)
        );
        renderRiwayat(pesananFilter);
    });

    // Tombol tutup popup
    document.getElementById('close-popup-detail').addEventListener('click', tutupPopupDetail);
    document.getElementById('btn-tutup-popup').addEventListener('click', tutupPopupDetail);
    document.getElementById('btn-batalkan-popup').addEventListener('click', batalkanPesananDariPopup);

    // Tutup popup jika klik di luar box
    const popupOverlay = document.getElementById('popup-detail');
    if (popupOverlay) {
        popupOverlay.addEventListener('click', (e) => {
            if (e.target === popupOverlay) {
                tutupPopupDetail();
            }
        });
    }

    // Logout
    setupLogout();
}

function setupLogout() {
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
}

// ===== FUNGSI BUKA POPUP DETAIL =====
function bukaPopupDetail(idPreOrder) {
    pesananAktif = semuaPesanan.find(p => p.id_pre_order === idPreOrder);
    if (!pesananAktif) return;

    // Update judul
    document.getElementById('popup-detail-title').textContent = `Detail Pesanan #PO-${String(pesananAktif.id_pre_order).padStart(3, '0')}`;

    // Format tanggal
    const tanggalPesan = new Date(pesananAktif.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const tanggalAmbil = new Date(pesananAktif.jadwal_ambil).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) + ', ' + new Date(pesananAktif.jadwal_ambil).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    }) + ' WIB';

    const totalHarga = pesananAktif.jumlah_porsi * pesananAktif.harga_per_porsi;
    const statusText = pesananAktif.status.charAt(0).toUpperCase() + pesananAktif.status.slice(1);

    // Isi data ke popup
    document.getElementById('popup-tanggal-pesan').textContent = `: ${tanggalPesan}`;
    document.getElementById('popup-tanggal-ambil').textContent = `: ${tanggalAmbil}`;
    document.getElementById('popup-nama-paket').textContent = `: ${pesananAktif.nama_paket}`;
    document.getElementById('popup-jumlah-porsi').textContent = `: ${pesananAktif.jumlah_porsi} Porsi`;
    document.getElementById('popup-harga-porsi').textContent = `: Rp ${pesananAktif.harga_per_porsi.toLocaleString('id-ID')}`;
    document.getElementById('popup-total-harga').textContent = `: Rp ${totalHarga.toLocaleString('id-ID')}`;
    document.getElementById('popup-status').textContent = `: ${statusText}`;

    // Isi menu paket
    const isiMenuList = document.getElementById('popup-isi-paket');
    if (pesananAktif.isi_menu_detail && pesananAktif.isi_menu_detail.length > 0) {
        isiMenuList.innerHTML = pesananAktif.isi_menu_detail.map(item => `<li>${item}</li>`).join('');
    } else {
        isiMenuList.innerHTML = '<li>Nasi</li><li>Lauk Sesuai Paket</li><li>Sayur</li><li>Air Mineral</li>';
    }

    // Tampilkan atau sembunyikan tombol batalkan
    const btnBatalkanPopup = document.getElementById('btn-batalkan-popup');
    if (pesananAktif.status === 'pending') {
        btnBatalkanPopup.style.display = 'inline-block';
    } else {
        btnBatalkanPopup.style.display = 'none';
    }

    // Tampilkan popup
    document.getElementById('popup-detail').style.display = 'flex';
}

// ===== FUNGSI TUTUP POPUP =====
function tutupPopupDetail() {
    document.getElementById('popup-detail').style.display = 'none';
    pesananAktif = null;
}

// ===== FUNGSI BATALKAN PESANAN DARI CARD =====
async function batalkanPesanan(idPreOrder) {
    const konfirmasi = confirm('Apakah Anda yakin ingin membatalkan pesanan ini?');
    if (!konfirmasi) return;

    try {
        const response = await fetch('/api/batalkan-pesanan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_pre_order: idPreOrder })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message || 'Pesanan berhasil dibatalkan');
            // Reload riwayat pesanan
            loadRiwayatPesanan();
        } else {
            alert('Gagal membatalkan pesanan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat membatalkan pesanan');
    }
}

// ===== FUNGSI BATALKAN PESANAN DARI POPUP =====
async function batalkanPesananDariPopup() {
    if (!pesananAktif) return;
    await batalkanPesanan(pesananAktif.id_pre_order);
    tutupPopupDetail();
}

// ===== FUNGSI BAYAR PESANAN DENGAN MIDTRANS =====
async function bayarPesanan(idPreOrder) {
    try {
        const response = await fetch(`/api/bayar/${idPreOrder}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            // Panggil Midtrans Snap
            window.snap.pay(data.token, {
                onSuccess: async function(result){
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
                    // Secara ideal, webhook dari Midtrans akan mengubah status di server
                    // Di sini kita sekedar refresh riwayat
                    loadRiwayatPesanan();
                },
                onPending: async function(result){
                    if (result.order_id) {
                        try {
                            await fetch(`/api/sync-midtrans?order_id=${result.order_id}`);
                        } catch (e) {}
                    }
                    alert("Menunggu pembayaran Anda.");
                    loadRiwayatPesanan();
                },
                onError: function(result){
                    alert("Pembayaran gagal!");
                },
                onClose: function(){
                    console.log('Popup ditutup pelanggan');
                }
            });
        } else {
            alert('Gagal membuat transaksi: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error saat membuat transaksi Midtrans:', error);
        alert('Terjadi kesalahan koneksi.');
    }
}

// Cek URL parameter dipindahkan ke dalam loadRiwayatPesanan agar bisa update UI langsung