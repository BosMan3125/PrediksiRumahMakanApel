// ===== VARIABEL GLOBAL =====
let semuaResep = []; // Berisi data menu + daftar bahan
let semuaBahan = []; // Berisi data bahan baku untuk dropdown
let resepAktif = null;
let bahanSementara = []; // List bahan yang sedang ditambahkan di form
let editIndexBahanSementara = null; // Index bahan yang sedang diedit di form

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDataAwal();
    setupSearch();
    setupForm();
    setupLogout();
    setupFileInput();
    setupDropdownBahan();
    setupCustomSelectBahan();
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

// ===== LOAD DATA AWAL (MENU & BAHAN BAKU) =====
async function loadDataAwal() {
    try {
        // Load semua menu beserta resepnya
        const resResep = await fetch('/api/menu-resep-pemilik');
        const dataResep = await resResep.json();
        if (resResep.ok) semuaResep = dataResep;

        // Load semua bahan baku untuk dropdown
        const resBahan = await fetch('/api/bahan-baku-list');
        const dataBahan = await resBahan.json();
        if (resBahan.ok) semuaBahan = dataBahan;

        renderGridResep(semuaResep);
        isiDropdownBahan();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ===== RENDER GRID CARD RESEP =====
function renderGridResep(listResep) {
    const grid = document.getElementById('resep-grid');
    if (listResep.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">Tidak ada data resep</p>';
        return;
    }

    grid.innerHTML = listResep.map(resep => {
        const jumlahBahan = resep.bahan ? resep.bahan.length : 0;
        const hargaFormat = 'Rp ' + parseInt(resep.harga).toLocaleString('id-ID');
        const gambarSrc = resep.gambar ? resep.gambar : 'images/paket-default.jpg';

        return `
            <div class="resep-card" onclick="bukaPopupDetail(${resep.id_menu})">
                <img src="${gambarSrc}" alt="${resep.nama_menu}" class="resep-card-image" onerror="this.src='images/paket-default.jpg'">
                <h3 class="resep-card-title">${resep.nama_menu}</h3>
                <p class="resep-card-price">${hargaFormat} / Porsi</p>
                <p class="resep-card-info">${jumlahBahan} Bahan Baku</p>
                <div class="resep-card-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="bukaPopupEdit(${resep.id_menu})">✏️</button>
                    <button class="btn-icon" onclick="hapusResep(${resep.id_menu})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ===== SETUP SEARCH =====
function setupSearch() {
    const searchInput = document.getElementById('search-resep');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = semuaResep.filter(r => r.nama_menu.toLowerCase().includes(keyword));
            renderGridResep(filtered);
        });
    }
}

// ===== POPUP DETAIL =====
function bukaPopupDetail(idMenu) {
    const resep = semuaResep.find(r => r.id_menu === idMenu);
    if (!resep) return;

    document.getElementById('detail-nama-menu').textContent = resep.nama_menu;
    document.getElementById('detail-harga').textContent = `Harga per Porsi : Rp ${parseInt(resep.harga).toLocaleString('id-ID')}`;
    
    const tbody = document.getElementById('tbody-detail-bahan');
    if (resep.bahan && resep.bahan.length > 0) {
        tbody.innerHTML = resep.bahan.map(b => `
            <tr>
                <td>${b.nama_bahan}</td>
                <td>${parseFloat(b.jumlah_butuh).toFixed(3)}</td>
                <td>${b.satuan}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">Belum ada bahan</td></tr>';
    }

    // Simpan ID untuk tombol Edit/Hapus di popup detail
    document.getElementById('popup-detail').dataset.currentId = idMenu;
    
    // Update tombol Edit agar meneruskan ID
    const btnEdit = document.querySelector('#popup-detail .btn-edit');
    if (btnEdit) {
        btnEdit.onclick = function() {
            bukaPopupEdit(idMenu);
        };
    }
    
    // Update tombol Hapus agar meneruskan ID
    const btnHapus = document.querySelector('#popup-detail .btn-hapus');
    if (btnHapus) {
        btnHapus.onclick = function() {
            hapusResep(idMenu);
        };
    }

    document.getElementById('popup-detail').style.display = 'flex';
}

// ===== POPUP FORM (TAMBAH/EDIT) =====
function bukaPopupTambah() {
    resepAktif = null;
    bahanSementara = [];
    resetFormBahanInput();
    document.getElementById('popup-form-title').textContent = 'Tambah Resep';
    document.getElementById('form-resep').reset();
    renderBahanSementara();
    removeImage();
    document.getElementById('popup-form').style.display = 'flex';
}

function bukaPopupEdit(idMenu) {
    resepAktif = semuaResep.find(r => r.id_menu === idMenu);
    if (!resepAktif) return;

    // Copy array bahan dengan mapping yang benar
    if (resepAktif.bahan && resepAktif.bahan.length > 0) {
        bahanSementara = resepAktif.bahan.map(b => ({
            id_bahan: parseInt(b.bahan_id), // PERBAIKAN: bahan_id dari database
            nama_bahan: b.nama_bahan,
            jumlah_butuh: parseFloat(b.jumlah_butuh),
            satuan: b.satuan
        }));
    } else {
        bahanSementara = [];
    }

    resetFormBahanInput();
    document.getElementById('popup-form-title').textContent = 'Edit Resep';
    document.getElementById('nama-menu').value = resepAktif.nama_menu;
    document.getElementById('harga-porsi').value = resepAktif.harga;
    
    // Handle gambar existing
    if (resepAktif.gambar) {
        const fileName = document.getElementById('file-name');
        const previewDiv = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        fileName.textContent = resepAktif.gambar.split('/').pop();
        previewImg.src = resepAktif.gambar;
        previewDiv.style.display = 'block';
    } else {
        removeImage();
    }

    renderBahanSementara();
    document.getElementById('popup-form').style.display = 'flex';
}

function tutupPopupForm() {
    document.getElementById('popup-form').style.display = 'none';
    resepAktif = null;
    bahanSementara = [];
    resetFormBahanInput();
    closeCustomSelectBahan();
}

function resetFormBahanInput() {
    editIndexBahanSementara = null;
    const selectBahan = document.getElementById('pilih-bahan');
    if (selectBahan) {
        selectBahan.value = '';
        selectBahan.disabled = false;
    }
    const inputJumlah = document.getElementById('jumlah-bahan');
    if (inputJumlah) inputJumlah.value = '';
    const inputSatuan = document.getElementById('satuan-bahan');
    if (inputSatuan) inputSatuan.value = '';
    const btnSimpan = document.getElementById('btn-simpan-bahan');
    if (btnSimpan) btnSimpan.textContent = 'Simpan Bahan';
    syncCustomSelectBahan();
}

// ===== LOGIKA DROPDOWN BAHAN & AUTO-SATUAN =====
function isiDropdownBahan() {
    const select = document.getElementById('pilih-bahan');
    select.innerHTML = '<option value="">Pilih Bahan</option>';
    semuaBahan.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id_bahan;
        option.textContent = b.nama_bahan;
        option.dataset.satuan = b.satuan; // Simpan satuan di dataset
        select.appendChild(option);
    });
    syncCustomSelectBahan();
}

function setupDropdownBahan() {
    const select = document.getElementById('pilih-bahan');
    const inputSatuan = document.getElementById('satuan-bahan');
    
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.value) {
            inputSatuan.value = selectedOption.dataset.satuan; // Auto-fill satuan
        } else {
            inputSatuan.value = '';
        }
        syncCustomSelectBahan();
    });
}

function setupCustomSelectBahan() {
    const wrapper = document.getElementById('custom-select-bahan-wrapper');
    const trigger = document.getElementById('custom-select-bahan-trigger');
    const searchInput = document.getElementById('custom-select-bahan-search');

    if (!wrapper || !trigger) return;

    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        if (wrapper.classList.contains('disabled')) return;
        const isOpen = wrapper.classList.contains('open');
        wrapper.classList.toggle('open');
        if (!isOpen && searchInput) {
            searchInput.value = '';
            filterCustomOptions('');
            setTimeout(() => searchInput.focus(), 50);
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            filterCustomOptions(e.target.value);
        });
        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });
}

function filterCustomOptions(query) {
    const list = document.getElementById('custom-select-bahan-list');
    if (!list) return;
    const q = query.toLowerCase().trim();
    const options = list.querySelectorAll('.custom-option');
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(q)) {
            opt.classList.remove('hidden');
        } else {
            opt.classList.add('hidden');
        }
    });
}

function syncCustomSelectBahan() {
    const select = document.getElementById('pilih-bahan');
    const list = document.getElementById('custom-select-bahan-list');
    const textSpan = document.getElementById('custom-select-bahan-text');
    const wrapper = document.getElementById('custom-select-bahan-wrapper');

    if (!select || !list || !textSpan) return;

    if (select.disabled) {
        if (wrapper) wrapper.classList.add('disabled');
    } else {
        if (wrapper) wrapper.classList.remove('disabled');
    }

    const selectedValue = select.value;
    let selectedText = 'Pilih Bahan';

    list.innerHTML = '';

    Array.from(select.options).forEach(opt => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-option' + (String(opt.value) === String(selectedValue) ? ' selected' : '');
        optDiv.textContent = opt.text;
        optDiv.dataset.value = opt.value;

        if (String(opt.value) === String(selectedValue) && opt.value !== '') {
            selectedText = opt.text;
        }

        optDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            select.value = opt.value;
            select.dispatchEvent(new Event('change'));
            closeCustomSelectBahan();
        });

        list.appendChild(optDiv);
    });

    textSpan.textContent = selectedText;
}

function closeCustomSelectBahan() {
    const wrapper = document.getElementById('custom-select-bahan-wrapper');
    if (wrapper) wrapper.classList.remove('open');
}

// ===== LOGIKA BAHAN SEMENTARA =====
function tambahBahanSementara() {
    const selectBahan = document.getElementById('pilih-bahan');
    const idBahan = selectBahan.value;
    const namaBahan = selectBahan.options[selectBahan.selectedIndex]?.text;
    const jumlah = document.getElementById('jumlah-bahan').value;
    const satuan = document.getElementById('satuan-bahan').value;

    console.log('Input bahan:', { idBahan, namaBahan, jumlah, satuan });

    if (!idBahan) {
        alert('Pilih bahan dari dropdown!');
        return;
    }

    if (!jumlah || parseFloat(jumlah) <= 0) {
        alert('Jumlah bahan harus diisi dan lebih dari 0!');
        return;
    }

    if (editIndexBahanSementara !== null) {
        // Mode Edit: Cek duplikasi ke item lain selain yang sedang diedit
        const duplicate = bahanSementara.find((b, idx) => b.id_bahan == idBahan && idx !== editIndexBahanSementara);
        if (duplicate) {
            alert('Bahan "' + namaBahan + '" sudah ada di list!');
            return;
        }

        // Update item yang sedang diedit
        bahanSementara[editIndexBahanSementara] = {
            id_bahan: parseInt(idBahan),
            nama_bahan: namaBahan,
            jumlah_butuh: parseFloat(jumlah),
            satuan: satuan
        };
    } else {
        // Mode Tambah Baru: Cek duplikasi
        const exists = bahanSementara.find(b => b.id_bahan == idBahan);
        if (exists) {
            alert('Bahan "' + namaBahan + '" sudah ada di list!');
            return;
        }

        // Tambahkan ke array
        bahanSementara.push({
            id_bahan: parseInt(idBahan),
            nama_bahan: namaBahan,
            jumlah_butuh: parseFloat(jumlah),
            satuan: satuan
        });
    }

    resetFormBahanInput();
    renderBahanSementara();
}

function renderBahanSementara() {
    const tbody = document.getElementById('tbody-bahan-sementara');
    if (bahanSementara.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Belum ada bahan ditambahkan</td></tr>';
        return;
    }

    tbody.innerHTML = bahanSementara.map((b, index) => `
        <tr style="${editIndexBahanSementara === index ? 'background-color: #fff8e1;' : ''}">
            <td>${b.nama_bahan}</td>
            <td>${parseFloat(b.jumlah_butuh).toFixed(3)}</td>
            <td>${b.satuan}</td>
            <td>
                <button type="button" class="btn-icon" onclick="editBahanSementara(${index})" title="Edit Bahan" style="cursor: pointer; margin-right: 5px;">✏️</button>
                <button type="button" class="btn-icon" onclick="hapusBahanSementara(${index})" title="Hapus Bahan" style="cursor: pointer;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function hapusBahanSementara(index) {
    if (editIndexBahanSementara === index) {
        resetFormBahanInput();
    } else if (editIndexBahanSementara !== null && editIndexBahanSementara > index) {
        editIndexBahanSementara--;
    }
    bahanSementara.splice(index, 1);
    renderBahanSementara();
}

function editBahanSementara(index) {
    const b = bahanSementara[index];
    if (!b) return;

    editIndexBahanSementara = index;

    const selectBahan = document.getElementById('pilih-bahan');
    selectBahan.value = b.id_bahan;
    
    const inputJumlah = document.getElementById('jumlah-bahan');
    inputJumlah.value = b.jumlah_butuh;

    const inputSatuan = document.getElementById('satuan-bahan');
    inputSatuan.value = b.satuan;

    const btnSimpan = document.getElementById('btn-simpan-bahan');
    if (btnSimpan) btnSimpan.textContent = 'Update Bahan';

    inputJumlah.focus();
    syncCustomSelectBahan();
    renderBahanSementara();
}

// ===== FILE UPLOAD LOGIC (SAMA SEPERTI SEBELUMNYA) =====
function setupFileInput() {
    const fileInput = document.getElementById('gambar-resep');
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
    const fileInput = document.getElementById('gambar-resep');
    const fileName = document.getElementById('file-name');
    const previewDiv = document.getElementById('image-preview');
    fileInput.value = '';
    fileName.textContent = 'Belum ada file dipilih';
    previewDiv.style.display = 'none';
}

// ===== SUBMIT FORM =====
function setupForm() {
    const form = document.getElementById('form-resep');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const namaMenu = document.getElementById('nama-menu').value.trim();
        const harga = document.getElementById('harga-porsi').value;
        const fileInput = document.getElementById('gambar-resep');
        const file = fileInput.files[0];

        if (!namaMenu || !harga) {
            alert('Nama menu dan harga harus diisi!');
            return;
        }

        // Validasi bahan sementara
        console.log('Bahan sementara:', bahanSementara);
        
        if (!bahanSementara || bahanSementara.length === 0) {
            alert('Minimal 1 bahan harus ditambahkan ke resep!');
            return;
        }

        // Validasi setiap bahan memiliki id_bahan
        for (let i = 0; i < bahanSementara.length; i++) {
            const bahan = bahanSementara[i];
            if (!bahan.id_bahan || isNaN(bahan.id_bahan)) {
                alert(`Bahan ke-${i + 1} (${bahan.nama_bahan}) tidak memiliki ID yang valid!`);
                return;
            }
            if (!bahan.jumlah_butuh || isNaN(bahan.jumlah_butuh)) {
                alert(`Bahan ${bahan.nama_bahan} jumlahnya tidak valid!`);
                return;
            }
        }

        const formData = new FormData();
        formData.append('nama_menu', namaMenu);
        formData.append('harga', harga);
        if (file) formData.append('gambar', file);
        
        // Kirim bahan sebagai JSON string
        const bahanJSON = JSON.stringify(bahanSementara);
        console.log('Bahan JSON:', bahanJSON);
        formData.append('bahan', bahanJSON);

        try {
            let response;
            if (resepAktif) {
                formData.append('existing_gambar', resepAktif.gambar || '');
                response = await fetch(`/api/update-resep/${resepAktif.id_menu}`, {
                    method: 'PUT',
                    body: formData
                });
            } else {
                response = await fetch('/api/tambah-resep', {
                    method: 'POST',
                    body: formData
                });
            }

            const data = await response.json();
            if (response.ok && data.success) {
                alert(resepAktif ? 'Resep berhasil diupdate' : 'Resep berhasil ditambahkan');
                tutupPopupForm();
                await loadDataAwal(); // Reload data
            } else {
                alert('Gagal menyimpan: ' + (data.message || 'Terjadi kesalahan'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan saat menyimpan: ' + error.message);
        }
    });
}

// ===== HAPUS RESEP =====
async function hapusResep(idMenu) {
    const resep = semuaResep.find(r => r.id_menu === idMenu);
    if (!resep) return;

    const konfirmasi = confirm(`Hapus resep "${resep.nama_menu}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/hapus-resep/${idMenu}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Resep berhasil dihapus');
            await loadDataAwal();
        } else {
            alert('Gagal menghapus: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menghapus');
    }
}

// ===== LOGOUT & POPUP CLOSE =====
function setupLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const response = await fetch('/logout', { method: 'POST' });
                if (response.ok) window.location.href = '/login.html';
            } catch (error) { console.error(error); }
        });
    }
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'popup-detail') tutupPopupDetail();
    if (e.target.id === 'popup-form') tutupPopupForm();
});

// ===== FUNGSI TUTUP POPUP DETAIL =====
function tutupPopupDetail() {
    document.getElementById('popup-detail').style.display = 'none';
}
