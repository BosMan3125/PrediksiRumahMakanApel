// ===== VARIABEL GLOBAL =====
let semuaPesanan = [];
let semuaPaket = [];
let semuaMenu = [];
let pesananAktif = null;
let paketAktif = null;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadSemuaData();
    setupTabs();
    setupSearch();
    setupFormPaket();
    setupLogout();
    setupFileInput(); // Fungsi baru untuk preview gambar
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

// ===== FUNGSI LOAD SEMUA DATA =====
async function loadSemuaData() {
    await Promise.all([
        loadPesananPelanggan(),
        loadPaketPemilik(),
        loadMenuTersedia()
    ]);
}

// ===== LOAD PESANAN PELANGGAN =====
async function loadPesananPelanggan() {
    try {
        const response = await fetch('/api/pre-order-pemilik-data');
        const data = await response.json();
        if (response.ok) {
            semuaPesanan = data;
            filterDataPesanan();
        }
    } catch (error) {
        console.error('Error loading pesanan:', error);
    }
}

// ===== RENDER TABEL PESANAN =====
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

function renderTabelPesanan(listPesanan) {
    const tbody = document.getElementById('tbody-pesanan-pelanggan');
    if (listPesanan.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">Tidak ada pesanan</td></tr>';
        return;
    }

    tbody.innerHTML = listPesanan.map(po => {
        const isHangus = po.status === 'hangus' || po.status_pembayaran === 'hangus';
        const statusClass = isHangus ? 'hangus' : (po.status ? po.status.toLowerCase() : 'hangus');
        const statusText = formatStatusLabel(po.status, po.status_pembayaran);
        const tanggalAmbil = new Date(po.jadwal_ambil).toLocaleDateString('id-ID');
        
        return `
            <tr onclick="bukaPopupDetailPesanan(${po.id_pre_order})">
                <td>${po.id_pelanggan}</td>
                <td>${po.nama_pelanggan}</td>
                <td>${po.no_hp}</td>
                <td>${po.nama_paket}</td>
                <td>${po.jumlah_porsi}</td>
                <td>${tanggalAmbil}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// ===== LOAD PAKET PEMILIK =====
async function loadPaketPemilik() {
    try {
        const response = await fetch('/api/paket-pemilik');
        const data = await response.json();
        if (response.ok) {
            semuaPaket = data;
            renderGridPaket(semuaPaket);
        }
    } catch (error) {
        console.error('Error loading paket:', error);
    }
}

// ===== RENDER GRID PAKET =====
function renderGridPaket(listPaket) {
    const grid = document.getElementById('paket-grid');
    if (listPaket.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">Tidak ada paket</p>';
        return;
    }

    grid.innerHTML = listPaket.map(paket => {
        const menuList = paket.menus && paket.menus.length > 0 ? paket.menus.join(', ') : 'Belum ada menu';
        const hargaFormat = 'Rp ' + parseInt(paket.harga_per_porsi).toLocaleString('id-ID');
        // Gunakan gambar dari database, atau fallback ke default
        const gambarSrc = paket.gambar ? paket.gambar : 'images/paket-default.jpg';
        
        return `
            <div class="paket-card">
                <img src="${gambarSrc}" alt="${paket.nama_paket}" class="paket-card-image" onerror="this.src='images/paket-default.jpg'">
                <h3 class="paket-card-title">${paket.nama_paket}</h3>
                <p class="paket-card-price">${hargaFormat} / porsi</p>
                <p class="paket-card-menu">Menu: ${menuList}</p>
                <div class="paket-card-actions">
                    <button class="btn-edit" onclick="bukaPopupEditPaket(${paket.id_paket})">✏️ Edit</button>
                    <button class="btn-delete" onclick="hapusPaket(${paket.id_paket})">🗑️ Hapus</button>
                </div>
            </div>
        `;
    }).join('');
}

// ===== LOAD MENU TERSEDIA =====
async function loadMenuTersedia() {
    try {
        const response = await fetch('/api/menu-tersedia');
        const data = await response.json();
        if (response.ok) {
            semuaMenu = data;
        }
    } catch (error) {
        console.error('Error loading menu:', error);
    }
}

// ===== RENDER CHECKBOX MENU =====
function renderCheckboxMenu(selectedMenuIds = []) {
    const container = document.getElementById('menu-checkbox-container');
    if (semuaMenu.length === 0) {
        container.innerHTML = '<p style="color: #999;">Tidak ada menu tersedia</p>';
        return;
    }

    container.innerHTML = semuaMenu.map(menu => {
        const isChecked = selectedMenuIds.includes(menu.id_menu) ? 'checked' : '';
        return `
            <div class="menu-checkbox-item">
                <input type="checkbox" id="menu-${menu.id_menu}" value="${menu.id_menu}" ${isChecked}>
                <label for="menu-${menu.id_menu}">${menu.nama_menu}</label>
            </div>
        `;
    }).join('');
}

// ===== SETUP TABS =====
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

// ===== LOGIKA FILTER PESANAN PELANGGAN =====
function filterDataPesanan() {
    const searchPesanan = document.getElementById('search-pesanan');
    const filterStatus = document.getElementById('filter-status-pesanan');

    const keyword = searchPesanan ? searchPesanan.value.trim().toLowerCase() : '';
    const statusVal = filterStatus ? filterStatus.value : 'semua';

    const filtered = semuaPesanan.filter(po => {
        const idStr = (po.id_pelanggan || '').toString().toLowerCase();
        const namaPelanggan = (po.nama_pelanggan || '').toLowerCase();
        const namaPaket = (po.nama_paket || '').toLowerCase();
        const noHp = (po.no_hp || '').toLowerCase();

        const matchSearch = !keyword || 
                            idStr.includes(keyword) ||
                            namaPelanggan.includes(keyword) ||
                            namaPaket.includes(keyword) ||
                            noHp.includes(keyword);

        const matchStatus = !statusVal || statusVal === 'semua' || po.status === statusVal;

        return matchSearch && matchStatus;
    });

    renderTabelPesanan(filtered);
}

// ===== SETUP SEARCH & FILTER =====
function setupSearch() {
    const searchPesanan = document.getElementById('search-pesanan');
    const filterStatus = document.getElementById('filter-status-pesanan');

    if (searchPesanan) searchPesanan.addEventListener('input', filterDataPesanan);
    if (filterStatus) filterStatus.addEventListener('change', filterDataPesanan);

    const searchPaket = document.getElementById('search-paket');
    if (searchPaket) {
        searchPaket.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = semuaPaket.filter(p => p.nama_paket.toLowerCase().includes(keyword));
            renderGridPaket(filtered);
        });
    }
}

// ==========================================
// FITUR BARU: HANDLE UPLOAD & PREVIEW GAMBAR
// ==========================================
function setupFileInput() {
    const fileInput = document.getElementById('gambar-paket');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const fileName = document.getElementById('file-name');
            const previewDiv = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            
            if (file) {
                fileName.textContent = file.name;
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function removeImage() {
    const fileInput = document.getElementById('gambar-paket');
    const fileName = document.getElementById('file-name');
    const previewDiv = document.getElementById('image-preview');
    
    fileInput.value = '';
    fileName.textContent = 'Belum ada file dipilih';
    previewDiv.style.display = 'none';
}

// ===== BUKA POPUP DETAIL PESANAN =====
async function bukaPopupDetailPesanan(idPreOrder) {
    pesananAktif = semuaPesanan.find(p => p.id_pre_order === idPreOrder);
    if (!pesananAktif) return;

    document.getElementById('detail-nama-pelanggan').textContent = `: ${pesananAktif.nama_pelanggan}`;
    document.getElementById('detail-no-hp').textContent = `: ${pesananAktif.no_hp}`;
    document.getElementById('detail-alamat').textContent = `: ${pesananAktif.alamat}`;
    document.getElementById('detail-paket').textContent = `: ${pesananAktif.nama_paket}`;
    document.getElementById('detail-jumlah').textContent = `: ${pesananAktif.jumlah_porsi} Porsi`;
    document.getElementById('detail-harga').textContent = `: Rp ${parseInt(pesananAktif.harga_per_porsi).toLocaleString('id-ID')} / porsi`;
    
    const total = pesananAktif.jumlah_porsi * pesananAktif.harga_per_porsi;
    document.getElementById('detail-total').textContent = `: Rp ${parseInt(total).toLocaleString('id-ID')}`;

    const jadwalAmbil = new Date(pesananAktif.jadwal_ambil);
    document.getElementById('detail-tanggal').textContent = `: ${jadwalAmbil.toLocaleDateString('id-ID')}`;
    document.getElementById('detail-waktu').textContent = `: ${jadwalAmbil.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

    const isiMenuList = document.getElementById('detail-isi-paket');
    if (pesananAktif.isi_menu_detail && pesananAktif.isi_menu_detail.length > 0) {
        isiMenuList.innerHTML = pesananAktif.isi_menu_detail.map(item => `<li>${item}</li>`).join('');
    } else {
        isiMenuList.innerHTML = '<li>Menu belum tersedia</li>';
    }

    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = formatStatusLabel(pesananAktif.status);
    statusEl.className = `status-badge ${pesananAktif.status}`;

    // Update the popup buttons based on status
    const popupButtons = document.querySelector('#popup-detail-pesanan .popup-buttons');
    if (pesananAktif.status === 'pending') {
        popupButtons.innerHTML = `
            <button class="btn-tolak" onclick="tolakPesanan()">Ditolak</button>
            <button class="btn-terima" onclick="terimaPesanan()">Diterima</button>
        `;
    } else if (pesananAktif.status === 'diproduksi' || pesananAktif.status === 'selesai') {
        popupButtons.innerHTML = `
            <button onclick="bukaPopupTagihanAkhir()" style="width: 100%; background-color: #3498db; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#2980b9'" onmouseout="this.style.backgroundColor='#3498db'">Kirim Tagihan Pelunasan</button>
            <button onclick="bukaPopupKebutuhanBahan()" style="width: 100%; background-color: #e67e22; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 8px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#d35400'" onmouseout="this.style.backgroundColor='#e67e22'">📋 Cek Kebutuhan Bahan Baku</button>
        `;
    } else {
        popupButtons.innerHTML = `
            <button onclick="bukaPopupKebutuhanBahan()" style="width: 100%; background-color: #e67e22; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#d35400'" onmouseout="this.style.backgroundColor='#e67e22'">📋 Cek Kebutuhan Bahan Baku</button>
        `;
    }

    document.getElementById('popup-detail-pesanan').style.display = 'flex';
}

function tutupPopupDetailPesanan() {
    document.getElementById('popup-detail-pesanan').style.display = 'none';
    pesananAktif = null;
}

// ===== TERIMA / TOLAK PESANAN =====
async function terimaPesanan() {
    if (!pesananAktif) return;
    document.getElementById('popup-detail-pesanan').style.display = 'none';
    document.getElementById('popup-terima-pesanan').style.display = 'flex';
}

function tutupPopupTerimaPesanan() {
    document.getElementById('popup-terima-pesanan').style.display = 'none';
}

async function kirimTagihanDPAwal() {
    if (!pesananAktif) return;
    const cooldown = document.getElementById('batas-waktu-dp').value;

    try {
        const response = await fetch(`/api/pre-order/${pesananAktif.id_pre_order}/terima-dp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batas_waktu_jam: cooldown })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Tagihan DP 50% berhasil dikirim ke pelanggan.');
            tutupPopupTerimaPesanan();
            await loadPesananPelanggan();
        } else {
            alert('Gagal mengirim tagihan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat mengirim tagihan');
    }
}

// ==== TAGIHAN AKHIR ====
function bukaPopupTagihanAkhir() {
    document.getElementById('popup-detail-pesanan').style.display = 'none';
    document.getElementById('popup-tagihan-akhir').style.display = 'flex';
}

function tutupPopupTagihanAkhir() {
    document.getElementById('popup-tagihan-akhir').style.display = 'none';
}

async function kirimTagihanDPAkhir() {
    if (!pesananAktif) return;
    const cooldown = document.getElementById('batas-waktu-pelunasan').value;

    try {
        const response = await fetch(`/api/pre-order/${pesananAktif.id_pre_order}/tagih-akhir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batas_waktu_jam: cooldown })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Tagihan Pelunasan berhasil dikirim.');
            tutupPopupTagihanAkhir();
            await loadPesananPelanggan();
        } else {
            alert('Gagal mengirim tagihan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat mengirim tagihan');
    }
}

async function kirimTagihanLunasLangsung() {
    if (!pesananAktif) return;

    const konfirmasi = confirm('Apakah Anda yakin ingin menandai pesanan ini lunas langsung tanpa Midtrans?');
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/pre-order/${pesananAktif.id_pre_order}/lunas-langsung`, {
            method: 'POST'
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Pesanan berhasil ditandai Lunas.');
            tutupPopupTagihanAkhir();
            await loadPesananPelanggan();
        } else {
            alert('Gagal menandai lunas: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menandai lunas');
    }
}

async function tolakPesanan() {
    if (!pesananAktif) return;
    const konfirmasi = confirm(`Tolak pesanan #PO-${String(pesananAktif.id_pre_order).padStart(4, '0')} dari ${pesananAktif.nama_pelanggan}?`);
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/update-status-preorder/${pesananAktif.id_pre_order}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ditolak' })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Pesanan berhasil ditolak');
            tutupPopupDetailPesanan();
            await loadPesananPelanggan();
        } else {
            alert('Gagal menolak pesanan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menolak pesanan');
    }
}

// ===== BUKA POPUP TAMBAH / EDIT PAKET =====
function bukaPopupTambahPaket() {
    paketAktif = null;
    document.getElementById('popup-tambah-paket-title').textContent = 'Tambah Paket Pesanan';
    document.getElementById('form-paket').reset();
    renderCheckboxMenu();
    removeImage(); // Reset gambar saat tambah baru
    document.getElementById('popup-tambah-paket').style.display = 'flex';
}

function bukaPopupEditPaket(idPaket) {
    paketAktif = semuaPaket.find(p => p.id_paket === idPaket);
    if (!paketAktif) return;

    document.getElementById('popup-tambah-paket-title').textContent = 'Edit Paket Pesanan';
    document.getElementById('nama-paket').value = paketAktif.nama_paket;
    document.getElementById('harga-paket').value = paketAktif.harga_per_porsi;
    
    // Tampilkan gambar yang sudah ada jika ada
    if (paketAktif.gambar) {
        const fileName = document.getElementById('file-name');
        const previewDiv = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        
        fileName.textContent = paketAktif.gambar.split('/').pop(); // Ambil nama file saja
        previewImg.src = paketAktif.gambar;
        previewDiv.style.display = 'block';
    } else {
        removeImage();
    }

    const selectedMenuIds = paketAktif.menus_detail ? paketAktif.menus_detail.map(m => m.id_menu) : [];
    renderCheckboxMenu(selectedMenuIds);

    document.getElementById('popup-tambah-paket').style.display = 'flex';
}

function tutupPopupTambahPaket() {
    document.getElementById('popup-tambah-paket').style.display = 'none';
    paketAktif = null;
}

// ==========================================
// FITUR BARU: SUBMIT FORM DENGAN FILE UPLOAD
// ==========================================
function setupFormPaket() {
    const form = document.getElementById('form-paket');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const namaPaket = document.getElementById('nama-paket').value.trim();
        const hargaPorsi = document.getElementById('harga-paket').value;
        const fileInput = document.getElementById('gambar-paket');
        const file = fileInput.files[0];

        const selectedMenus = [];
        document.querySelectorAll('#menu-checkbox-container input[type="checkbox"]:checked').forEach(cb => {
            selectedMenus.push(parseInt(cb.value));
        });

        if (!namaPaket || !hargaPorsi) {
            alert('Nama paket dan harga harus diisi!');
            return;
        }

        if (selectedMenus.length === 0) {
            alert('Pilih minimal 1 menu untuk paket!');
            return;
        }

        // Gunakan FormData agar bisa mengirim file gambar
        const formData = new FormData();
        formData.append('nama_paket', namaPaket);
        formData.append('harga_per_porsi', hargaPorsi);
        if (file) {
            formData.append('gambar', file); // Kirim file baru jika ada
        }
        formData.append('menu_ids', JSON.stringify(selectedMenus));
        
        if (paketAktif && paketAktif.gambar) {
            formData.append('existing_gambar', paketAktif.gambar); // Kirim path lama jika tidak diganti
        }

        try {
            let response;
            if (paketAktif) {
                response = await fetch(`/api/update-paket/${paketAktif.id_paket}`, {
                    method: 'PUT',
                    body: formData // JANGAN set header Content-Type, biarkan browser yang atur boundary
                });
            } else {
                response = await fetch('/api/tambah-paket', {
                    method: 'POST',
                    body: formData
                });
            }

            const data = await response.json();

            if (response.ok && data.success) {
                alert(paketAktif ? 'Paket berhasil diupdate' : 'Paket berhasil ditambahkan');
                tutupPopupTambahPaket();
                await loadPaketPemilik();
            } else {
                alert('Gagal menyimpan paket: ' + (data.message || 'Terjadi kesalahan'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan saat menyimpan paket');
        }
    });
}

// ===== HAPUS PAKET =====
async function hapusPaket(idPaket) {
    const paket = semuaPaket.find(p => p.id_paket === idPaket);
    if (!paket) return;

    const konfirmasi = confirm(`Hapus paket "${paket.nama_paket}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/hapus-paket/${idPaket}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Paket berhasil dihapus');
            await loadPaketPemilik();
        } else {
            alert('Gagal menghapus paket: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menghapus paket');
    }
}

// ===== SETUP LOGOUT =====
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

// ===== TUTUP POPUP KLIK DI LUAR =====
document.addEventListener('click', (e) => {
    const popupDetail = document.getElementById('popup-detail-pesanan');
    const popupTambah = document.getElementById('popup-tambah-paket');
    const popupKB = document.getElementById('popup-kebutuhan-bahan');
    
    if (e.target === popupDetail) tutupPopupDetailPesanan();
    if (e.target === popupTambah) tutupPopupTambahPaket();
    if (e.target === popupKB) tutupPopupKebutuhanBahan();
});

// ===== FITUR POPUP KEBUTUHAN BAHAN BAKU PRE-ORDER =====
let dataKebutuhanBahanGlobal = null;

async function bukaPopupKebutuhanBahan() {
    if (!pesananAktif) return;

    try {
        const response = await fetch(`/api/pre-order/${pesananAktif.id_pre_order}/kebutuhan-bahan`);
        const data = await response.json();

        if (response.ok && data.success) {
            dataKebutuhanBahanGlobal = data;

            document.getElementById('kb-po-id').textContent = `#PO-${String(data.pesanan.id_pre_order).padStart(3, '0')}`;
            document.getElementById('kb-pelanggan').textContent = data.pesanan.nama_pelanggan;
            document.getElementById('kb-paket').textContent = data.pesanan.nama_paket;
            document.getElementById('kb-porsi').textContent = data.pesanan.jumlah_porsi;
            document.getElementById('kb-status').textContent = data.pesanan.status.charAt(0).toUpperCase() + data.pesanan.status.slice(1);

            const tbody = document.getElementById('tbody-kebutuhan-bahan');
            let adaKekurangan = false;

            if (!data.bahan || data.bahan.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 15px;">Belum ada resep bahan baku untuk paket ini</td></tr>';
            } else {
                tbody.innerHTML = data.bahan.map(item => {
                    const isKurang = item.status_stok === 'Kurang';
                    if (isKurang) adaKekurangan = true;

                    const statusBadge = isKurang 
                        ? '<span style="background: #e74c3c; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">Kurang</span>'
                        : '<span style="background: #2ecc71; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">Cukup</span>';

                    const kebutuhanFmt = parseFloat(parseFloat(item.kebutuhan_total || 0).toFixed(3));
                    const stokFmt = parseFloat(parseFloat(item.stok_tersedia || 0).toFixed(3));
                    const kekuranganFmt = parseFloat(parseFloat(item.kekurangan || 0).toFixed(3));

                    return `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px;"><strong>${item.nama_bahan}</strong></td>
                            <td style="padding: 10px;">${kebutuhanFmt} ${item.satuan}</td>
                            <td style="padding: 10px;">${stokFmt} ${item.satuan}</td>
                            <td style="padding: 10px;">${statusBadge}</td>
                            <td style="padding: 10px; color: ${isKurang ? '#e74c3c' : '#2ecc71'}; font-weight: bold;">
                                ${isKurang ? `+${kekuranganFmt} ${item.satuan}` : '0'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            const btnBelanja = document.getElementById('btn-kirim-belanja-kb');
            if (adaKekurangan) {
                btnBelanja.style.display = 'inline-block';
            } else {
                btnBelanja.style.display = 'none';
            }

            document.getElementById('popup-detail-pesanan').style.display = 'none';
            document.getElementById('popup-kebutuhan-bahan').style.display = 'flex';
        } else {
            alert('Gagal mengambil data kebutuhan bahan: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan koneksi saat menghitung bahan.');
    }
}

function tutupPopupKebutuhanBahan() {
    document.getElementById('popup-kebutuhan-bahan').style.display = 'none';
}

function unduhKebutuhanBahanPDF() {
    if (!pesananAktif || !dataKebutuhanBahanGlobal || !dataKebutuhanBahanGlobal.bahan) {
        alert('Data kebutuhan bahan belum tersedia.');
        return;
    }

    const poId = String(pesananAktif.id_pre_order).padStart(3, '0');
    const pelanggan = pesananAktif.nama_pelanggan || '-';
    const paket = pesananAktif.nama_paket || '-';
    const porsi = pesananAktif.jumlah_porsi || 0;
    const status = pesananAktif.status || pesananAktif.status_pesanan || '-';
    const items = dataKebutuhanBahanGlobal.bahan || [];
    const filename = `Kebutuhan_Bahan_PO-${poId}.pdf`;

    const htmlString = `
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #333; background: #ffffff; width: 700px; box-sizing: border-box;">
            <h1 style="color: #d35400; margin-top: 0; margin-bottom: 15px; font-size: 22px; border-bottom: 2px solid #d35400; padding-bottom: 8px;">
                📋 Kalkulasi Kebutuhan Bahan Baku - Pre-Order #${poId}
            </h1>
            
            <div style="margin-bottom: 20px; font-size: 14px; background: #fdfefe; border: 1px solid #ebedef; padding: 14px; border-radius: 8px;">
                <p style="margin: 6px 0;"><strong>Pesanan:</strong> #${poId} (${pelanggan})</p>
                <p style="margin: 6px 0;"><strong>Paket:</strong> ${paket} (${porsi} Porsi)</p>
                <p style="margin: 6px 0;"><strong>Status Pesanan:</strong> ${status}</p>
                <p style="margin: 6px 0;"><strong>Sumber:</strong> <span style="padding: 3px 10px; border-radius: 4px; font-weight: bold; background-color: #e3f2fd; color: #0d47a1;">Pre-Order</span></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <thead>
                    <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left;">Bahan Baku</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 90px;">Kebutuhan</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 90px;">Stok Saat Ini</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: center; width: 90px;">Status Stok</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 100px;">Kekurangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const isKurang = item.status_stok === 'Kurang';
                        const statusBg = isKurang ? '#f8d7da' : '#d4edda';
                        const statusColor = isKurang ? '#721c24' : '#155724';
                        const kekuranganText = isKurang && item.kekurangan > 0 
                            ? `<span style="color: #dc3545; font-weight: bold;">+${parseFloat(item.kekurangan).toFixed(2)} ${item.satuan || ''}</span>`
                            : `<span style="color: #28a745;">0</span>`;

                        return `
                            <tr>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; font-weight: bold;">${item.nama_bahan || '-'}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px;">${parseFloat(item.kebutuhan).toFixed(2)} ${item.satuan || ''}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px;">${parseFloat(item.stok_saat_ini).toFixed(2)} ${item.satuan || ''}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: center;">
                                    <span style="padding: 3px 8px; border-radius: 4px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">
                                        ${item.status_stok}
                                    </span>
                                </td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px;">${kekuranganText}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(htmlString).set(opt).save();
    } else {
        alert('Library html2pdf belum siap. Silakan coba beberapa saat lagi.');
    }
}

async function kirimKekuranganKeBelanja() {
    if (!dataKebutuhanBahanGlobal || !dataKebutuhanBahanGlobal.bahan) return;

    const itemKurang = dataKebutuhanBahanGlobal.bahan
        .filter(item => item.status_stok === 'Kurang' && item.kekurangan > 0)
        .map(item => ({
            bahan_id: item.bahan_id,
            harga_satuan: item.harga_satuan,
            jumlah_rekomendasi: item.kekurangan
        }));

    if (itemKurang.length === 0) {
        alert('Tidak ada bahan yang kurang untuk dikirim ke daftar belanja.');
        return;
    }

    const konfirmasi = confirm(`Kirim ${itemKurang.length} bahan yang kurang ini ke Daftar Belanja Bahan Baku?`);
    if (!konfirmasi) return;

    try {
        const pelangganNama = (pesananAktif && pesananAktif.nama_pelanggan) ? pesananAktif.nama_pelanggan : '';
        const sumberText = pelangganNama ? `Pre-Order (${pelangganNama})` : 'Pre-Order';

        const response = await fetch('/api/kirim-prediksi-ke-belanja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemKurang, sumber: sumberText })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            alert('Berhasil! Bahan yang kurang telah ditambahkan ke Daftar Belanja Bahan Baku.');
            tutupPopupKebutuhanBahan();
        } else {
            alert('Gagal mengirim ke daftar belanja: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan koneksi.');
    }
}