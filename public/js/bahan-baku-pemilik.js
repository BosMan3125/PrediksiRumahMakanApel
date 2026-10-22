// ===== VARIABEL GLOBAL =====
let semuaBahan = [];
let bahanAktif = null;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadBahanBaku();
    setupSearch();
    setupForm();
    setupGambarPreview();
    setupLogout();
    setupKalkulatorMini();
    setupClearNotifOnLeave();
});

// ===== FUNGSI HAPUS NOTIFIKASI JIKA KELUAR HALAMAN =====
function setupClearNotifOnLeave() {
    document.querySelectorAll('.sidebar-menu a, .sidebar-menu button').forEach(el => {
        el.addEventListener('click', () => {
            const href = el.getAttribute('href');
            if (href && !href.includes('bahan-baku-pemilik.html')) {
                localStorage.removeItem('bahan_baku_upgrades');
            }
        });
    });
}

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

// ===== LOAD BAHAN BAKU =====
async function loadBahanBaku() {
    try {
        const response = await fetch('/api/bahan-baku-pemilik', { cache: 'no-store' });
        const data = await response.json();
        
        if (response.ok) {
            semuaBahan = data;
            renderTabel(semuaBahan);
        }
    } catch (error) {
        console.error('Error loading bahan baku:', error);
    }
}

// ===== RENDER TABEL (DIUBAH KE CARD) =====
function renderTabel(listBahan) {
    const container = document.getElementById('bahan-card-container');
    if (!container) return; // Prevent error if container not found
    
    if (listBahan.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; grid-column: 1 / -1; padding: 40px;">Tidak ada data bahan baku</div>';
        return;
    }
    
    let upgradesMap = {};
    try {
        const raw = localStorage.getItem('bahan_baku_upgrades');
        if (raw) {
            const dataObj = JSON.parse(raw);
            if (Date.now() - dataObj.timestamp < 30 * 60 * 1000) {
                (dataObj.items || []).forEach(item => {
                    const bId = item.bahan_id || item.id_bahan;
                    if (bId) {
                        upgradesMap[String(bId)] = {
                            jumlah: parseFloat(item.jumlah_beli || item.jumlah || 0),
                            satuan: item.satuan || ''
                        };
                    }
                });
            }
        }
    } catch(e) {}

    container.innerHTML = listBahan.map(b => {
        const stokSekarang = parseFloat(b.stok_tersedia);
        const stokMin = parseFloat(b.stok_minimal);
        const statusClass = stokSekarang > stokMin ? 'aman' : 'darurat';
        const statusText = stokSekarang > stokMin ? 'Aman' : 'Darurat';

        // Badge kategori
        let kategoriClass = '';
        let kategoriText = '-';
        if (b.kategori === 'cepat_busuk') {
            kategoriClass = 'cepat_busuk';
            kategoriText = 'Cepat Busuk';
        } else if (b.kategori === 'awet') {
            kategoriClass = 'awet';
            kategoriText = 'Awet';
        }

        // Badge Upgrade Notifikasi
        const upgradeInfo = upgradesMap[String(b.id_bahan)];
        let upgradeBadgeHtml = '';
        if (upgradeInfo && upgradeInfo.jumlah > 0) {
            const formattedJumlah = Number.isInteger(upgradeInfo.jumlah) ? upgradeInfo.jumlah : upgradeInfo.jumlah.toFixed(2);
            const displaySatuan = upgradeInfo.satuan || b.satuan || '';
            upgradeBadgeHtml = `<span class="badge upgrade-badge">+${formattedJumlah} ${displaySatuan}</span>`;
        }

        let gambarHtml = `
            <div class="card-img-placeholder">
                <span>Belum Ada Gambar, tambah gambar</span>
            </div>
        `;
        if (b.gambar) {
            gambarHtml = `
                <div class="card-img-placeholder" style="background-color: transparent; border: none; padding: 0;">
                    <img src="/uploads/bahan-baku/${b.gambar}" alt="${b.nama_bahan}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                </div>
            `;
        }

        return `
            <div class="bahan-card">
                ${gambarHtml}
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${b.nama_bahan}</h3>
                        <div class="card-badges">
                            <span class="badge kategori-badge ${kategoriClass}">${kategoriText}</span>
                            <span class="badge status-badge ${statusClass}">${statusText}</span>
                            ${upgradeBadgeHtml}
                        </div>
                    </div>
                    <div class="card-jenis">${b.jenis_bahan || '-'}</div>
                    <div class="card-info">
                        <div class="info-row">
                            <span class="info-label">Stok saat ini</span>
                            <span class="info-value">: ${stokSekarang.toFixed(2)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Satuan</span>
                            <span class="info-value">: ${b.satuan}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Stok Minimal</span>
                            <span class="info-value">: ${stokMin.toFixed(2)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Harga</span>
                            <span class="info-value">: ${b.harga_satuan ? 'Rp ' + parseInt(b.harga_satuan).toLocaleString('id-ID') + ' / ' + b.satuan : '<span style="color:#d9534f;font-style:italic;font-size:12px;">belum kasih harga</span>'}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action btn-edit" onclick="bukaPopupEdit(${b.id_bahan})">✏️</button>
                        <button class="btn-action btn-delete" onclick="hapusBahan(${b.id_bahan})">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (Object.keys(upgradesMap).length > 0) {
        // Hilangkan notifikasi upgrade setelah 60 detik jika pengguna tetap di halaman ini
        setTimeout(() => {
            document.querySelectorAll('.badge.upgrade-badge').forEach(badge => {
                badge.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                badge.style.opacity = '0';
                badge.style.transform = 'scale(0.8)';
                setTimeout(() => badge.remove(), 800);
            });
            localStorage.removeItem('bahan_baku_upgrades');
        }, 60000);
    }
}

// ===== SETUP SEARCH DAN FILTER =====
function setupSearch() {
    const searchInput = document.getElementById('search-bahan');
    const filterKategori = document.getElementById('filter-kategori');
    const filterJenisBahan = document.getElementById('filter-jenis-bahan');

    const filterData = () => {
        const keyword = searchInput ? searchInput.value.toLowerCase() : '';
        const kategori = filterKategori ? filterKategori.value : '';
        const jenisBahan = filterJenisBahan ? filterJenisBahan.value : '';

        const filtered = semuaBahan.filter(b => {
            const matchKeyword = b.nama_bahan.toLowerCase().includes(keyword);
            const matchKategori = kategori ? b.kategori === kategori : true;
            const matchJenis = jenisBahan ? b.jenis_bahan === jenisBahan : true;
            
            return matchKeyword && matchKategori && matchJenis;
        });
        renderTabel(filtered);
    };

    if (searchInput) {
        searchInput.addEventListener('input', filterData);
    }
    if (filterKategori) {
        filterKategori.addEventListener('change', filterData);
    }
    if (filterJenisBahan) {
        filterJenisBahan.addEventListener('change', filterData);
    }
}

// ===== SETUP GAMBAR PREVIEW =====
function setupGambarPreview() {
    const inputGambar = document.getElementById('gambar-bahan');
    const previewImage = document.getElementById('preview-image');
    const previewText = document.getElementById('preview-text');
    
    if (inputGambar) {
        inputGambar.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                    previewText.style.display = 'none';
                }
                reader.readAsDataURL(file);
            }
        });
    }
}

// ===== BUKA POPUP TAMBAH =====
function bukaPopupTambah() {
    bahanAktif = null;
    document.getElementById('popup-title').textContent = 'Tambah Bahan Baku';
    document.getElementById('form-bahan').reset();
    
    // Reset preview gambar
    document.getElementById('preview-image').src = '';
    document.getElementById('preview-image').style.display = 'none';
    document.getElementById('preview-text').style.display = 'block';
    
    // Reset kalkulator
    document.getElementById('kalkulator-mini').style.display = 'none';
    document.getElementById('kalk-jumlah').value = '';
    document.getElementById('kalk-total').value = '';
    
    document.getElementById('popup-bahan').style.display = 'flex';
}

// ===== BUKA POPUP EDIT =====
function bukaPopupEdit(idBahan) {
    bahanAktif = semuaBahan.find(b => b.id_bahan === idBahan);
    if (!bahanAktif) return;
    document.getElementById('popup-title').textContent = 'Edit Bahan Baku';
    document.getElementById('nama-bahan').value = bahanAktif.nama_bahan;
    document.getElementById('stok-tersedia').value = bahanAktif.stok_tersedia;
    document.getElementById('stok-minimal').value = bahanAktif.stok_minimal;
    document.getElementById('satuan').value = bahanAktif.satuan;
    document.getElementById('kategori').value = bahanAktif.kategori || 'awet';
    document.getElementById('jenis-bahan').value = bahanAktif.jenis_bahan || '';
    document.getElementById('harga-satuan').value = bahanAktif.harga_satuan || '';
    
    // Set preview gambar jika ada
    const previewImage = document.getElementById('preview-image');
    const previewText = document.getElementById('preview-text');
    if (bahanAktif.gambar) {
        previewImage.src = `/uploads/bahan-baku/${bahanAktif.gambar}`;
        previewImage.style.display = 'block';
        previewText.style.display = 'none';
    } else {
        previewImage.src = '';
        previewImage.style.display = 'none';
        previewText.style.display = 'block';
    }
    
    // Reset kalkulator
    document.getElementById('kalkulator-mini').style.display = 'none';
    document.getElementById('kalk-jumlah').value = '';
    document.getElementById('kalk-total').value = '';

    document.getElementById('popup-bahan').style.display = 'flex';
}

// ===== TUTUP POPUP =====
function tutupPopup() {
    document.getElementById('popup-bahan').style.display = 'none';
    bahanAktif = null;
}

// ===== SETUP FORM =====
function setupForm() {
    const form = document.getElementById('form-bahan');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const namaBahan = document.getElementById('nama-bahan').value.trim();
        const stokTersedia = document.getElementById('stok-tersedia').value;
        const stokMinimal = document.getElementById('stok-minimal').value;
        const satuan = document.getElementById('satuan').value;
        const kategori = document.getElementById('kategori').value;
        const jenisBahan = document.getElementById('jenis-bahan').value;
        const hargaSatuan = document.getElementById('harga-satuan').value;

        if (!namaBahan || !stokTersedia || !stokMinimal || !satuan || !kategori || !jenisBahan) {
            alert('Semua field harus diisi!');
            return;
        }

        const formData = new FormData();
        formData.append('nama_bahan', namaBahan);
        formData.append('stok_tersedia', stokTersedia);
        formData.append('stok_minimal', stokMinimal);
        formData.append('satuan', satuan);
        formData.append('kategori', kategori);
        formData.append('jenis_bahan', jenisBahan);
        formData.append('harga_satuan', hargaSatuan);
        
        const fileInput = document.getElementById('gambar-bahan');
        if (fileInput.files[0]) {
            formData.append('gambar', fileInput.files[0]);
        }

        try {
            let response;
            if (bahanAktif) {
                response = await fetch(`/api/update-bahan-baku/${bahanAktif.id_bahan}`, {
                    method: 'PUT',
                    body: formData
                });
            } else {
                response = await fetch('/api/tambah-bahan-baku', {
                    method: 'POST',
                    body: formData
                });
            }
            const data = await response.json();
            if (response.ok && data.success) {
                alert(bahanAktif ? 'Bahan baku berhasil diupdate' : 'Bahan baku berhasil ditambahkan');
                tutupPopup();
                await loadBahanBaku();
            } else {
                alert('Gagal menyimpan: ' + (data.message || 'Terjadi kesalahan'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan saat menyimpan');
        }
    });
}

// ===== HAPUS BAHAN BAKU =====
async function hapusBahan(idBahan) {
    const bahan = semuaBahan.find(b => b.id_bahan === idBahan);
    if (!bahan) return;

    const konfirmasi = confirm(`Hapus bahan baku "${bahan.nama_bahan}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!konfirmasi) return;

    try {
        const response = await fetch(`/api/hapus-bahan-baku/${idBahan}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert('Bahan baku berhasil dihapus');
            await loadBahanBaku();
        } else {
            alert('Gagal menghapus: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat menghapus');
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
    const popup = document.getElementById('popup-bahan');
    if (e.target === popup) {
        tutupPopup();
    }
});

// ===== SETUP KALKULATOR MINI =====
function setupKalkulatorMini() {
    const btnToggle = document.getElementById('btn-toggle-kalkulator');
    const containerKalk = document.getElementById('kalkulator-mini');
    const inputJumlah = document.getElementById('kalk-jumlah');
    const inputTotal = document.getElementById('kalk-total');
    const inputHargaUtama = document.getElementById('harga-satuan');

    // Toggle Tampilan Kalkulator
    if (btnToggle && containerKalk) {
        btnToggle.addEventListener('click', () => {
            if (containerKalk.style.display === 'none') {
                containerKalk.style.display = 'block';
                btnToggle.textContent = 'Tutup kalkulator otomatis';
            } else {
                containerKalk.style.display = 'none';
                btnToggle.textContent = 'Beli eceran? Hitung otomatis';
                // Opsional: reset nilai saat ditutup
                inputJumlah.value = '';
                inputTotal.value = '';
            }
        });
    }

    // Fungsi Hitung Otomatis
    const hitungOtomatis = () => {
        const jumlah = parseFloat(inputJumlah.value);
        const total = parseFloat(inputTotal.value);

        if (jumlah > 0 && total >= 0) {
            const hargaPerSatuan = Math.round(total / jumlah);
            inputHargaUtama.value = hargaPerSatuan;
        }
    };

    if (inputJumlah) inputJumlah.addEventListener('input', hitungOtomatis);
    if (inputTotal) inputTotal.addEventListener('input', hitungOtomatis);
}