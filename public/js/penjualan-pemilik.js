// ===== VARIABEL GLOBAL =====
let semuaPenjualan = [];
let semuaMenu = [];
let menuSementara = [];
let penjualanAktif = null;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDataAwal();
    setupSearch();
    setupForm();
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

// ===== LOAD DATA AWAL (PENJUALAN & MENU) =====
async function loadDataAwal() {
    try {
        // Load semua penjualan
        console.log('📡 Memuat data penjualan...');
        const resPenjualan = await fetch('/api/penjualan-pemilik');
        const dataPenjualan = await resPenjualan.json();
        
        if (resPenjualan.ok) {
            semuaPenjualan = dataPenjualan;
            console.log('✅ Data penjualan:', semuaPenjualan);
        } else {
            console.error('❌ Gagal load penjualan:', dataPenjualan);
        }

        // Load semua menu untuk dropdown
        console.log(' Memuat data menu...');
        const resMenu = await fetch('/api/menu-list');
        const dataMenu = await resMenu.json();
        
        if (resMenu.ok) {
            semuaMenu = dataMenu;
            console.log('✅ Data menu:', semuaMenu);
            isiDropdownMenu();
        } else {
            console.error('❌ Gagal load menu:', dataMenu);
            alert('Gagal memuat daftar menu. Silakan refresh halaman.');
        }

        renderTabelPenjualan(semuaPenjualan);
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

// ===== RENDER TABEL PENJUALAN =====
function renderTabelPenjualan(listPenjualan) {
    const tbody = document.getElementById('tbody-penjualan');
    if (listPenjualan.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">Tidak ada data</td></tr>';
        return;
    }

    tbody.innerHTML = listPenjualan.map(p => {
        const tanggal = new Date(p.tanggal).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const sumberClass = p.sumber.toLowerCase();
        const totalHargaFormat = 'Rp ' + parseInt(p.total_harga).toLocaleString('id-ID');
        
        return `
            <tr>
                <td>${p.id_penjualan}</td>
                <td>${tanggal}</td>
                <td>${p.nama_pelanggan || 'Pelanggan'}</td>
                <td><span class="sumber-badge ${sumberClass}">${p.sumber}</span></td>
                <td>${p.total_porsi}</td>
                <td>${totalHargaFormat}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="bukaPopupEdit(${p.id_penjualan})">✏️</button>
                    <button class="btn-action btn-delete" onclick="hapusPenjualan(${p.id_penjualan})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== BUKA POPUP EDIT =====
function bukaPopupEdit(idPenjualan) {
    penjualanAktif = semuaPenjualan.find(p => p.id_penjualan === idPenjualan);
    if (!penjualanAktif) return;

    // Reset menu sementara
    menuSementara = [];

    // Load detail menu dari data yang sudah ada
    if (penjualanAktif.detail_menu && penjualanAktif.detail_menu.length > 0) {
        menuSementara = penjualanAktif.detail_menu.map(m => ({
            id_menu: parseInt(m.menu_id),
            nama_menu: m.nama_menu,
            jumlah_porsi: parseInt(m.jumlah_porsi)
        }));
        console.log('✅ Menu yang di-load untuk edit:', menuSementara);
    } else {
        console.log('⚠️ Tidak ada detail menu untuk penjualan ini');
    }

    document.getElementById('popup-title').textContent = 'Edit Penjualan';
    document.getElementById('nama-pelanggan').value = penjualanAktif.nama_pelanggan || 'Pelanggan';
    
    const tanggalInput = document.getElementById('tanggal-penjualan');
    const tanggal = new Date(penjualanAktif.tanggal);
    tanggalInput.value = tanggal.toISOString().split('T')[0];

    renderMenuSementara();
    document.getElementById('popup-penjualan').style.display = 'flex';
}

// ===== ISI DROPDOWN MENU =====
function isiDropdownMenu() {
    const select = document.getElementById('pilih-menu');
    select.innerHTML = '<option value="">Pilih Menu</option>';
    semuaMenu.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id_menu;
        option.textContent = m.nama_menu;
        option.dataset.harga = m.harga;
        select.appendChild(option);
    });
}

// ===== SETUP SEARCH =====
function setupSearch() {
    const searchInput = document.getElementById('search-penjualan');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = semuaPenjualan.filter(p => 
                (p.nama_pelanggan && p.nama_pelanggan.toLowerCase().includes(keyword)) ||
                p.sumber.toLowerCase().includes(keyword)
            );
            renderTabelPenjualan(filtered);
        });
    }
}

// ===== BUKA POPUP TAMBAH =====
function bukaPopupTambah() {
    penjualanAktif = null;
    menuSementara = [];
    document.getElementById('popup-title').textContent = 'Tambah Penjualan';
    document.getElementById('form-penjualan').reset();
    renderMenuSementara();
    document.getElementById('popup-penjualan').style.display = 'flex';
}

// ===== BUKA POPUP EDIT =====
function bukaPopupEdit(idPenjualan) {
    penjualanAktif = semuaPenjualan.find(p => p.id_penjualan === idPenjualan);
    if (!penjualanAktif) return;

    // Reset menu sementara
    menuSementara = [];

    // Load detail menu untuk penjualan ini dengan benar
    if (penjualanAktif.detail_menu && penjualanAktif.detail_menu.length > 0) {
        menuSementara = penjualanAktif.detail_menu.map(m => ({
            id_menu: parseInt(m.menu_id || m.id_menu), // Pastikan ada id_menu
            nama_menu: m.nama_menu,
            jumlah_porsi: parseInt(m.jumlah_porsi)
        }));
        
        console.log('✅ Menu yang di-load:', menuSementara);
    }

    document.getElementById('popup-title').textContent = 'Edit Penjualan';
    document.getElementById('nama-pelanggan').value = penjualanAktif.nama_pelanggan || 'Pelanggan';
    
    const tanggalInput = document.getElementById('tanggal-penjualan');
    const tanggal = new Date(penjualanAktif.tanggal);
    tanggalInput.value = tanggal.toISOString().split('T')[0];

    renderMenuSementara();
    document.getElementById('popup-penjualan').style.display = 'flex';
}

// ===== TUTUP POPUP =====
function tutupPopup() {
    document.getElementById('popup-penjualan').style.display = 'none';
    penjualanAktif = null;
    menuSementara = [];
}

// ===== LOGIKA MENU SEMENTARA =====
function tambahMenuSementara() {
    const selectMenu = document.getElementById('pilih-menu');
    const idMenu = selectMenu.value;
    const namaMenu = selectMenu.options[selectMenu.selectedIndex]?.text;
    const jumlah = document.getElementById('jumlah-porsi').value;

    if (!idMenu) {
        alert('Pilih menu dari dropdown!');
        return;
    }

    if (!jumlah || parseInt(jumlah) <= 0) {
        alert('Jumlah porsi harus diisi dan lebih dari 0!');
        return;
    }

    // Cek duplikasi
    const exists = menuSementara.find(m => m.id_menu == idMenu);
    if (exists) {
        alert('Menu "' + namaMenu + '" sudah ada di list!');
        return;
    }

    menuSementara.push({
        id_menu: parseInt(idMenu),
        nama_menu: namaMenu,
        jumlah_porsi: parseInt(jumlah)
    });

    // Reset input
    selectMenu.value = '';
    document.getElementById('jumlah-porsi').value = '';
    
    renderMenuSementara();
}

function hapusMenuSementara(index) {
    menuSementara.splice(index, 1);
    renderMenuSementara();
}

function renderMenuSementara() {
    const tbody = document.getElementById('tbody-menu-sementara');
    if (menuSementara.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">Belum ada menu ditambahkan</td></tr>';
        return;
    }

    tbody.innerHTML = menuSementara.map((m, index) => `
        <tr>
            <td>${m.nama_menu}</td>
            <td>${m.jumlah_porsi}</td>
            <td><button type="button" class="btn-action btn-delete" onclick="hapusMenuSementara(${index})">🗑️</button></td>
        </tr>
    `).join('');
}

// ===== SETUP FORM =====
function setupForm() {
    const form = document.getElementById('form-penjualan');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const namaPelanggan = document.getElementById('nama-pelanggan').value.trim();
        const tanggal = document.getElementById('tanggal-penjualan').value;

        if (!namaPelanggan || !tanggal) {
            alert('Nama pelanggan dan tanggal harus diisi!');
            return;
        }

        if (menuSementara.length === 0) {
            alert('Minimal 1 menu harus ditambahkan!');
            return;
        }

        const data = {
            nama_pelanggan: namaPelanggan,
            tanggal: tanggal,
            menu: menuSementara
        };

        try {
            let response;
            if (penjualanAktif) {
                response = await fetch(`/api/update-penjualan/${penjualanAktif.id_penjualan}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                response = await fetch('/api/tambah-penjualan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            const result = await response.json();
            if (response.ok && result.success) {
                alert(penjualanAktif ? 'Penjualan berhasil diupdate' : 'Penjualan berhasil ditambahkan');
                tutupPopup();
                await loadDataAwal();
            } else {
                alert('Gagal menyimpan: ' + (result.message || 'Terjadi kesalahan'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan saat menyimpan');
        }
    });
}

// ===== HAPUS PENJUALAN =====
async function hapusPenjualan(idPenjualan) {
    const penjualan = semuaPenjualan.find(p => p.id_penjualan === idPenjualan);
    if (!penjualan) return;

    const konfirmasi = confirm(`Hapus penjualan ini? Tindakan ini tidak bisa dibatalkan.`);
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/hapus-penjualan/${idPenjualan}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Penjualan berhasil dihapus');
            await loadDataAwal();
        } else {
            alert('Gagal menghapus: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menghapus');
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

// ===== TUTUP POPUP KLIK DI LUAR =====
document.addEventListener('click', (e) => {
    const popup = document.getElementById('popup-penjualan');
    if (e.target === popup) {
        tutupPopup();
    }
});