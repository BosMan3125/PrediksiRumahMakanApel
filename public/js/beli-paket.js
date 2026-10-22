// ===== VARIABEL GLOBAL =====
let semuaPaket = [];
let paketTerpilih = null;
let isLoggedIn = false;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    loadPaketTersedia();
    setupEventListeners();
});

// ===== FUNGSI AMBIL INFO USER =====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        const data = await response.json();
        if (response.ok) {
            isLoggedIn = true;
            document.getElementById('display-username').textContent = data.username;
            // Sembunyikan tombol login, tampilkan tombol logout
            const btnLoginHeader = document.getElementById('btn-login-header');
            if (btnLoginHeader) btnLoginHeader.style.display = 'none';
            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) btnLogout.style.display = 'flex';
        } else {
            isLoggedIn = false;
            document.getElementById('display-username').textContent = 'Tamu';
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
        const btnLoginHeader = document.getElementById('btn-login-header');
        if (btnLoginHeader) btnLoginHeader.style.display = 'inline-flex';
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.style.display = 'none';
    }
}

// ===== FUNGSI AMBIL DATA PAKET DARI DATABASE =====
async function loadPaketTersedia() {
    try {
        const response = await fetch('/api/paket-tersedia');
        const data = await response.json();
        
        if (response.ok) {
            semuaPaket = data;
            renderPaket(semuaPaket);
        }
    } catch (error) {
        console.error('Gagal memuat paket:', error);
    }
}

// ===== FUNGSI TAMPILKAN KARTU PAKET =====
function renderPaket(listPaket) {
    const grid = document.getElementById('paket-grid');
    
    if (listPaket.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">Tidak ada paket yang tersedia.</p>';
        return;
    }

    grid.innerHTML = listPaket.map(paket => {
        // Buat list menu dari database (bukan hardcoded lagi!)
        const menuList = paket.menus && paket.menus.length > 0 
            ? paket.menus.map(m => `<li>${m}</li>`).join('')
            : '<li>Menu belum tersedia</li>';
        
        return `
            <div class="paket-card">
                <img src="${paket.gambar || 'images/paket-hemat.jpg'}" alt="${paket.nama_paket}" class="paket-card-image">
                <div class="paket-card-body">
                    <h3 class="paket-card-title">${paket.nama_paket}</h3>
                    <div class="paket-card-menu">
                        <p>Isi Menu:</p>
                        <ul>
                            ${menuList}
                        </ul>
                    </div>
                    <p class="paket-card-price">Rp ${parseInt(paket.harga_per_porsi).toLocaleString('id-ID')} / Porsi</p>
                    <button class="btn-pesan-card" onclick="bukaPopupPesan(${paket.id_paket})">Pesan</button>
                </div>
            </div>
        `;
    }).join('');
}

// ===== FITUR PENCARIAN & EVENT LISTENER =====
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const paketFilter = semuaPaket.filter(p => p.nama_paket.toLowerCase().includes(keyword));
        renderPaket(paketFilter);
    });

    // Tombol tutup popup (X)
    document.getElementById('close-popup-pesan').addEventListener('click', tutupPopupPesan);
    document.getElementById('close-popup-sukses').addEventListener('click', tutupPopupSukses);

    // Tombol popup batas pemesanan
    const btnKembaliBatas = document.getElementById('btn-kembali-batas');
    if (btnKembaliBatas) {
        btnKembaliBatas.addEventListener('click', tutupPopupBatasPesan);
    }
    const closePopupBatas = document.getElementById('close-popup-batas');
    if (closePopupBatas) {
        closePopupBatas.addEventListener('click', tutupPopupBatasPesan);
    }
    const popupBatas = document.getElementById('popup-batas-pesan');
    if (popupBatas) {
        popupBatas.addEventListener('click', (e) => {
            if (e.target === popupBatas) tutupPopupBatasPesan();
        });
    }

    // Counter Porsi
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    if (btnMinus) btnMinus.addEventListener('click', () => ubahPorsi(-1));
    if (btnPlus) btnPlus.addEventListener('click', () => ubahPorsi(1));

    // Listener perubahan porsi & tanggal
    const porsiInput = document.getElementById('jumlah-porsi');
    if (porsiInput) {
        porsiInput.addEventListener('input', () => {
            const val = parseInt(porsiInput.value);
            if (val > 150) {
                bukaPopupBatasPesan();
                porsiInput.value = 150;
            }
            hitungTotal();
            updateMinTanggalAmbil();
        });
        porsiInput.addEventListener('change', () => {
            const val = parseInt(porsiInput.value);
            if (val > 150) {
                bukaPopupBatasPesan();
                porsiInput.value = 150;
            } else if (val < 1 || isNaN(val)) {
                porsiInput.value = 1;
            }
            hitungTotal();
            updateMinTanggalAmbil();
        });
    }
    const tanggalInput = document.getElementById('tanggal-ambil');
    if (tanggalInput) {
        tanggalInput.addEventListener('change', updateMinTanggalAmbil);
    }

    // Submit Pesanan
    document.getElementById('btn-pesan-sekarang').addEventListener('click', submitPesanan);

    // Logout
    setupLogout();
}

// ===== FUNGSI UPDATE TANGGAL MINIMAL TERSEDIA (H+2 untuk <50, H+5 untuk >=50) =====
function updateMinTanggalAmbil() {
    const porsiInput = document.getElementById('jumlah-porsi');
    const tanggalInput = document.getElementById('tanggal-ambil');
    if (!porsiInput || !tanggalInput) return;

    const porsi = parseInt(porsiInput.value) || 1;
    const today = new Date();
    
    // H+2 jika < 50 porsi, H+5 jika >= 50 porsi
    const leadDays = porsi < 50 ? 2 : 5;
    
    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() + leadDays);
    
    const yyyy = minDateObj.getFullYear();
    const mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(minDateObj.getDate()).padStart(2, '0');
    const minDateStr = `${yyyy}-${mm}-${dd}`;

    tanggalInput.min = minDateStr;

    // Jika tanggal yang sedang dipilih lebih awal dari minDateStr, otomatis sesuaikan ke minDateStr
    if (tanggalInput.value && tanggalInput.value < minDateStr) {
        tanggalInput.value = minDateStr;
    }
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

// ===== LOGIKA POPUP PEMESANAN =====
function bukaPopupPesan(idPaket) {
    // Jika belum login, arahkan ke halaman login
    if (!isLoggedIn) {
        window.location.href = '/login.html';
        return;
    }

    paketTerpilih = semuaPaket.find(p => p.id_paket === idPaket);
    if (!paketTerpilih) return;

    // Isi data ke popup
    document.getElementById('popup-paket-nama').textContent = `Pesan ${paketTerpilih.nama_paket}`;
    document.getElementById('popup-paket-gambar').src = paketTerpilih.gambar || 'images/paket-hemat.jpg';
    document.getElementById('popup-paket-harga').textContent = `Rp ${parseInt(paketTerpilih.harga_per_porsi).toLocaleString('id-ID')} / Porsi`;

    // Reset form
    document.getElementById('jumlah-porsi').value = 1;
    document.getElementById('jam-ambil').value = '';

    // Hitung total dan update tanggal minimal H+2/H+5
    hitungTotal();
    updateMinTanggalAmbil();

    // Set default tanggal ke tanggal minimal
    const minDateStr = document.getElementById('tanggal-ambil').min;
    if (minDateStr) {
        document.getElementById('tanggal-ambil').value = minDateStr;
    }

    document.getElementById('popup-pesan').style.display = 'flex';
}

function tutupPopupPesan() {
    document.getElementById('popup-pesan').style.display = 'none';
}

// ==========================================
// INI BAGIAN YANG DIPERBAIKI (TOMBOL X SUKSES)
// ==========================================
function tutupPopupSukses() {
    document.getElementById('popup-sukses').style.display = 'none';
    window.location.href = '/beli-paket.html';
}

// ===== COUNTER & HITUNG HARGA =====
function ubahPorsi(delta) {
    const input = document.getElementById('jumlah-porsi');
    let nilai = (parseInt(input.value) || 0) + delta;
    if (nilai > 150) {
        bukaPopupBatasPesan();
        nilai = 150;
    } else if (nilai < 1) {
        nilai = 1;
    }
    input.value = nilai;
    hitungTotal();
    updateMinTanggalAmbil();
}

function hitungTotal() {
    if (!paketTerpilih) return;
    const inputVal = document.getElementById('jumlah-porsi').value;
    const porsi = parseInt(inputVal) || 0;
    const total = porsi * parseInt(paketTerpilih.harga_per_porsi);
    document.getElementById('total-harga').textContent = `Rp ${total.toLocaleString('id-ID')}`;
}

// ===== POPUP BATAS PEMESANAN =====
function bukaPopupBatasPesan() {
    const popup = document.getElementById('popup-batas-pesan');
    if (popup) {
        popup.style.display = 'flex';
    }
}

function tutupPopupBatasPesan() {
    const popup = document.getElementById('popup-batas-pesan');
    if (popup) {
        popup.style.display = 'none';
    }
}

// ===== KIRIM PESANAN KE SERVER =====
async function submitPesanan() {
    const jumlahPorsi = document.getElementById('jumlah-porsi').value;
    const tanggalAmbil = document.getElementById('tanggal-ambil').value;
    const jamAmbil = document.getElementById('jam-ambil').value;

    // Validasi input
    if (!tanggalAmbil || !jamAmbil) {
        alert('Silakan isi tanggal dan jam ambil!');
        return;
    }

    // Validasi batas maksimal pemesanan 150 porsi
    const porsiVal = parseInt(jumlahPorsi) || 0;
    if (porsiVal > 150) {
        bukaPopupBatasPesan();
        return;
    }
    if (porsiVal < 1) {
        alert('Silakan masukkan jumlah porsi minimal 1!');
        return;
    }

    // Validasi jam operasional (08.00 - 21.30 WIB)
    if (jamAmbil < '08:00' || jamAmbil > '21:30') {
        alert('Jam pengambilan hanya tersedia antara pukul 08.00 WIB hingga 21.30 WIB!');
        return;
    }

    // Validasi tanggal minimal (H+2 untuk <50 porsi, H+5 untuk >=50 porsi)
    const leadDays = porsiVal < 50 ? 2 : 5;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() + leadDays);

    const selectedDateObj = new Date(tanggalAmbil);
    selectedDateObj.setHours(0, 0, 0, 0);

    if (selectedDateObj < minDateObj) {
        const formattedMinDate = minDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        alert(`Pesanan sebanyak ${porsiVal} porsi membutuhkan waktu persiapan minimal ${leadDays} hari!\nTanggal pengambilan paling awal yang dapat dipilih adalah ${formattedMinDate}.`);
        return;
    }

    // Gabungkan tanggal dan jam
    const jadwalAmbil = `${tanggalAmbil} ${jamAmbil}:00`;

    try {
        const response = await fetch('/api/buat-pesanan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paket_id: paketTerpilih.id_paket,
                jumlah_porsi: jumlahPorsi,
                jadwal_ambil: jadwalAmbil
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            tutupPopupPesan();
            document.getElementById('popup-sukses').style.display = 'flex';
        } else {
            if (data.message && data.message.toLowerCase().includes('melewati batas')) {
                bukaPopupBatasPesan();
            } else {
                alert('Gagal membuat pesanan: ' + (data.message || 'Terjadi kesalahan'));
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat mengirim pesanan');
    }
}