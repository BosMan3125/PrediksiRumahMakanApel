// ===== VARIABEL GLOBAL =====
let daftarBelanja = []; // Data Tab 1 (is_submitted = 0)
let riwayatBelanja = []; // Data Tab 2 (is_submitted = 1)
let currentDetailGrup = null; // Untuk popup detail

// Format angka desimal khas Indonesia (menggunakan koma, tanpa nol buntut)
function formatDesimalIndo(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = parseFloat(val);
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();

    // Cek apakah ada parameter tab dari URL (dari halaman Prediksi)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    if (tabParam === 'daftar') {
        // Langsung aktifkan tab Daftar Belanja
        switchTab('daftar');
    } else {
        // Default: load Daftar Belanja
        loadDaftarBelanja();
    }

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

// ===== SWITCH TAB =====
function switchTab(tabName) {
    // Update tombol tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

    // Update konten tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load data sesuai tab
    if (tabName === 'daftar') {
        loadDaftarBelanja();
    } else if (tabName === 'riwayat') {
        loadRiwayatBelanja();
    }
}

// ===== TAB 1: DAFTAR BELANJA =====

// Load data Daftar Belanja (is_submitted = 0)
async function loadDaftarBelanja() {
    try {
        const response = await fetch('/api/belanja-bahan-daftar');
        const data = await response.json();
        if (response.ok) {
            daftarBelanja = data;
            renderDaftarBelanja();
        }
    } catch (error) {
        console.error('Error load daftar belanja:', error);
    }
}

// Render tabel Daftar Belanja
function renderDaftarBelanja() {
    const tbody = document.getElementById('tbody-daftar-belanja');

    if (daftarBelanja.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 40px;">Belum ada data. Kirim dari halaman Prediksi terlebih dahulu.</td></tr>';
        return;
    }

    tbody.innerHTML = daftarBelanja.map((item, index) => {
        const totalHarga = parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan);
        const s = String(item.sumber || '').toLowerCase();
        const isPreOrder = s.includes('pre-order') || s.includes('preorder') || s.includes('po');
        const sumberBadge = isPreOrder
            ? '<span class="status-badge" style="background-color: #e3f2fd !important; color: #0d47a1 !important; font-weight: bold;">Pre-Order</span>'
            : '<span class="status-badge" style="background-color: #f3e5f5 !important; color: #4a148c !important; font-weight: bold;">Prediksi</span>';
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.nama_bahan}</td>
                <td>${item.satuan}</td>
                <td>${formatDesimalIndo(item.jumlah_beli)}</td>
                <td>Rp ${totalHarga.toLocaleString('id-ID')}</td>
                <td>${sumberBadge}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="bukaPopupEditDaftar(${index})">✏️</button>
                    <button class="btn-action btn-delete" onclick="hapusDaftarBelanja(${item.id_pembelian})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter pencarian di Tab Daftar
function filterDaftarBelanja() {
    const keyword = document.getElementById('search-daftar').value.toLowerCase();
    const filtered = daftarBelanja.filter(item =>
        item.nama_bahan.toLowerCase().includes(keyword)
    );

    const tbody = document.getElementById('tbody-daftar-belanja');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">Tidak ditemukan</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
        const totalHarga = parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan);
        const s = String(item.sumber || '').toLowerCase();
        const isPreOrder = s.includes('pre-order') || s.includes('preorder') || s.includes('po');
        const sumberBadge = isPreOrder
            ? '<span class="status-badge" style="background-color: #e3f2fd !important; color: #0d47a1 !important; font-weight: bold;">Pre-Order</span>'
            : '<span class="status-badge" style="background-color: #f3e5f5 !important; color: #4a148c !important; font-weight: bold;">Prediksi</span>';
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.nama_bahan}</td>
                <td>${item.satuan}</td>
                <td>${formatDesimalIndo(item.jumlah_beli)}</td>
                <td>Rp ${totalHarga.toLocaleString('id-ID')}</td>
                <td>${sumberBadge}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="bukaPopupEditDaftar(${daftarBelanja.indexOf(item)})">✏️</button>
                    <button class="btn-action btn-delete" onclick="hapusDaftarBelanja(${item.id_pembelian})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Buka Popup Edit Daftar Belanja
function bukaPopupEditDaftar(index) {
    const item = daftarBelanja[index];
    document.getElementById('edit-nama-bahan').value = item.nama_bahan;
    document.getElementById('edit-satuan').value = item.satuan;
    document.getElementById('edit-harga-satuan').value = parseFloat(item.harga_satuan);
    document.getElementById('edit-jumlah').value = item.jumlah_beli;
    document.getElementById('popup-edit-daftar').dataset.editIndex = index;

    // Hitung total
    updateTotalEditDaftar();

    document.getElementById('popup-edit-daftar').style.display = 'flex';
}

function updateTotalEditDaftar() {
    const jumlah = parseFloat(document.getElementById('edit-jumlah').value) || 0;
    const harga = parseFloat(document.getElementById('edit-harga-satuan').value) || 0;
    const total = jumlah * harga;
    document.getElementById('edit-total-harga').textContent = `Rp ${total.toLocaleString('id-ID')}`;
}

// Event listener untuk auto-calculate total
document.getElementById('edit-harga-satuan').addEventListener('input', updateTotalEditDaftar);
document.getElementById('edit-jumlah').addEventListener('input', updateTotalEditDaftar);

// Tutup Popup Edit Daftar
function tutupPopupEditDaftar() {
    document.getElementById('popup-edit-daftar').style.display = 'none';
}

// Simpan Edit Daftar Belanja
document.getElementById('form-edit-daftar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('popup-edit-daftar').dataset.editIndex);
    const item = daftarBelanja[index];

    const hargaSatuan = parseFloat(document.getElementById('edit-harga-satuan').value);
    const jumlah = parseFloat(document.getElementById('edit-jumlah').value);

    if (isNaN(hargaSatuan) || isNaN(jumlah)) {
        alert('Harga Satuan dan Jumlah harus berupa angka!');
        return;
    }

    try {
        const response = await fetch(`/api/update-belanja-bahan/${item.id_pembelian}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jumlah_beli: jumlah,
                harga_satuan: hargaSatuan,
                total_harga: jumlah * hargaSatuan
            })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            // Update data lokal
            daftarBelanja[index].jumlah_beli = jumlah;
            daftarBelanja[index].harga_satuan = hargaSatuan;
            daftarBelanja[index].total_harga = jumlah * hargaSatuan;
            renderDaftarBelanja();
            tutupPopupEditDaftar();
        } else {
            alert('Gagal mengupdate: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error update:', error);
        alert('Terjadi kesalahan saat mengupdate');
    }
});

// Hapus item dari Daftar Belanja
async function hapusDaftarBelanja(id_pembelian) {
    if (!confirm('Hapus bahan ini dari Daftar Belanja?')) return;

    try {
        const response = await fetch(`/api/hapus-belanja-bahan/${id_pembelian}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok && data.success) {
            daftarBelanja = daftarBelanja.filter(item => item.id_pembelian !== id_pembelian);
            renderDaftarBelanja();
        } else {
            alert('Gagal menghapus: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error hapus:', error);
        alert('Terjadi kesalahan saat menghapus');
    }
}

// Submit Daftar Belanja ke Riwayat (tombol Simpan)
async function submitDaftarBelanja() {
    if (daftarBelanja.length === 0) {
        alert('Tidak ada data untuk di-submit!');
        return;
    }

    if (!confirm(`Kirim ${daftarBelanja.length} bahan ke Riwayat Belanja?`)) return;

    try {
        const response = await fetch('/api/submit-belanja-bahan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: daftarBelanja })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('Berhasil dikirim ke Riwayat Belanja!');
            daftarBelanja = [];
            renderDaftarBelanja();
            // Pindah ke tab riwayat
            switchTab('riwayat');
        } else {
            alert('Gagal mengirim: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error submit:', error);
        alert('Terjadi kesalahan saat mengirim');
    }
}

// ===== TAB 2: RIWAYAT BELANJA =====

// Load data Riwayat Belanja (is_submitted = 1)
async function loadRiwayatBelanja() {
    const filter = document.getElementById('filter-riwayat').value;
    const statusSelect = document.getElementById('filter-status-riwayat');
    const status = statusSelect ? statusSelect.value : '';
    const sumberSelect = document.getElementById('filter-sumber-riwayat');
    const sumber = sumberSelect ? sumberSelect.value : '';

    try {
        const response = await fetch(`/api/belanja-bahan-riwayat?filter=${filter}&status=${status}&sumber=${sumber}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok) {
            riwayatBelanja = data;
            renderRiwayatBelanja();
        }
    } catch (error) {
        console.error('Error load riwayat belanja:', error);
    }
}

function createSumberBadge(items) {
    const list = Array.isArray(items) ? items : [items];
    const isPO = list.some(item => {
        const s = String(item.sumber || '').toLowerCase();
        return s.includes('pre-order') || s.includes('preorder') || s.includes('po');
    });
    if (isPO) {
        return '<span class="status-badge" style="background-color: #e3f2fd !important; color: #0d47a1 !important; font-weight: bold;">Pre-Order</span>';
    } else {
        return '<span class="status-badge" style="background-color: #f3e5f5 !important; color: #4a148c !important; font-weight: bold;">Prediksi</span>';
    }
}

// Render cards Riwayat Belanja (grouped by grup_belanja)
function renderRiwayatBelanja() {
    const container = document.getElementById('cards-riwayat');

    if (riwayatBelanja.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Belum ada riwayat belanja.</p>';
        return;
    }

    // Group by grup_belanja
    const groups = {};
    riwayatBelanja.forEach(item => {
        const grupId = item.grup_belanja;
        if (!groups[grupId]) {
            groups[grupId] = {
                grup_belanja: grupId,
                tanggal: item.tanggal_beli,
                status: item.status,
                items: []
            };
        }
        groups[grupId].items.push(item);
    });

    const groupArray = Object.values(groups).sort((a, b) => {
        return new Date(b.tanggal) - new Date(a.tanggal);
    });

    container.innerHTML = groupArray.map(group => {
        const totalHarga = group.items.reduce((sum, item) => {
            return sum + (parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan));
        }, 0);

        const statusBadge = group.status === 'selesai'
            ? '<span class="status-badge status-selesai">Selesai</span>'
            : '<span class="status-badge status-belum">Belum Dibeli</span>';

        const tanggalFormatted = new Date(group.tanggal).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const sumberBadge = createSumberBadge(group.items);

        return `
            <div class="belanja-card" onclick="bukaPopupDetail('${group.grup_belanja}')">
                <div class="card-header">
                    <div>
                        <div class="card-title">Daftar Belanja</div>
                        <div class="card-date">Tanggal ${tanggalFormatted}</div>
                    </div>
                </div>
                <div class="card-total">Total : Rp ${totalHarga.toLocaleString('id-ID')}</div>
                <table class="card-table">
                    <thead>
                        <tr>
                            <th>Nama Bahan</th>
                            <th>Jumlah</th>
                            <th>Satuan</th>
                            <th>Harga</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.items.slice(0, 3).map(item => `
                            <tr>
                                <td>${item.nama_bahan}</td>
                                <td>${formatDesimalIndo(item.jumlah_beli)}</td>
                                <td>${item.satuan}</td>
                                <td>Rp ${(parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan)).toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                        ${group.items.length > 3 ? `<tr><td colspan="4" style="text-align: center; color: #999;">+${group.items.length - 3} bahan lainnya</td></tr>` : ''}
                    </tbody>
                </table>
                <div class="card-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        ${statusBadge}
                        ${sumberBadge}
                    </div>
                    <button class="btn-print" onclick="event.stopPropagation(); downloadPDF('${group.grup_belanja}')" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">📄 Unduh PDF</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filter pencarian di Tab Riwayat
function filterRiwayatBelanja() {
    const keyword = document.getElementById('search-riwayat').value.toLowerCase();
    const statusSelect = document.getElementById('filter-status-riwayat');
    const statusVal = statusSelect ? statusSelect.value : '';

    const filtered = riwayatBelanja.filter(item => {
        const matchKeyword = item.nama_bahan.toLowerCase().includes(keyword);
        let matchStatus = true;
        if (statusVal === 'belum') {
            matchStatus = item.status !== 'selesai';
        } else if (statusVal === 'selesai') {
            matchStatus = item.status === 'selesai';
        }
        return matchKeyword && matchStatus;
    });

    const container = document.getElementById('cards-riwayat');
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Tidak ditemukan</p>';
        return;
    }

    // Group by grup_belanja
    const groups = {};
    filtered.forEach(item => {
        const grupId = item.grup_belanja;
        if (!groups[grupId]) {
            groups[grupId] = {
                grup_belanja: grupId,
                tanggal: item.tanggal_beli,
                status: item.status,
                items: []
            };
        }
        groups[grupId].items.push(item);
    });

    const groupArray = Object.values(groups).sort((a, b) => {
        return new Date(b.tanggal) - new Date(a.tanggal);
    });

    container.innerHTML = groupArray.map(group => {
        const totalHarga = group.items.reduce((sum, item) => {
            return sum + (parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan));
        }, 0);

        const statusBadge = group.status === 'selesai'
            ? '<span class="status-badge status-selesai">Selesai</span>'
            : '<span class="status-badge status-belum">Belum Dibeli</span>';

        const tanggalFormatted = new Date(group.tanggal).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const sumberBadge = createSumberBadge(group.items);

        return `
            <div class="belanja-card" onclick="bukaPopupDetail('${group.grup_belanja}')">
                <div class="card-header">
                    <div>
                        <div class="card-title">Daftar Belanja</div>
                        <div class="card-date">Tanggal ${tanggalFormatted}</div>
                    </div>
                </div>
                <div class="card-total">Total : Rp ${totalHarga.toLocaleString('id-ID')}</div>
                <table class="card-table">
                    <thead>
                        <tr>
                            <th>Nama Bahan</th>
                            <th>Jumlah</th>
                            <th>Satuan</th>
                            <th>Harga</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.items.slice(0, 3).map(item => `
                            <tr>
                                <td>${item.nama_bahan}</td>
                                <td>${formatDesimalIndo(item.jumlah_beli)}</td>
                                <td>${item.satuan}</td>
                                <td>Rp ${(parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan)).toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                        ${group.items.length > 3 ? `<tr><td colspan="4" style="text-align: center; color: #999;">+${group.items.length - 3} bahan lainnya</td></tr>` : ''}
                    </tbody>
                </table>
                <div class="card-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        ${statusBadge}
                        ${sumberBadge}
                    </div>
                    <button class="btn-print" onclick="event.stopPropagation(); downloadPDF('${group.grup_belanja}')" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">📄 Unduh PDF</button>
                </div>
            </div>
        `;
    }).join('');
}

// Buka Popup Detail Riwayat
function bukaPopupDetail(grupBelanja) {
    const items = riwayatBelanja.filter(item => item.grup_belanja === grupBelanja);
    if (items.length === 0) return;

    currentDetailGrup = grupBelanja;
    const firstItem = items[0];
    const isSelesai = items.every(item => item.status === 'selesai') || firstItem.status === 'selesai';

    const totalHarga = items.reduce((sum, item) => {
        return sum + (parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan));
    }, 0);

    const tanggalFormatted = new Date(firstItem.tanggal_beli).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    document.getElementById('detail-tanggal').textContent = tanggalFormatted;
    document.getElementById('detail-total').textContent = `Rp ${totalHarga.toLocaleString('id-ID')}`;
    document.getElementById('detail-status').textContent = isSelesai ? 'Selesai' : 'Belum Dibeli';

    const elemSumber = document.getElementById('detail-sumber');
    if (elemSumber) {
        elemSumber.innerHTML = createSumberBadge(items);
    }

    const tbody = document.getElementById('tbody-detail-riwayat');
    tbody.innerHTML = items.map((item, index) => {
        const total = parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan);
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.nama_bahan}</td>
                <td>${item.satuan}</td>
                <td>${formatDesimalIndo(item.jumlah_beli)}</td>
                <td>Rp ${parseFloat(item.harga_satuan).toLocaleString('id-ID')}</td>
                <td>Rp ${total.toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');

    // Toggle tombol Tandai Selesai dan Edit berdasarkan status
    const btnSelesai = document.querySelector('#popup-detail-riwayat .btn-selesai');
    const btnEdit = document.querySelector('#popup-detail-riwayat .btn-edit');

    if (isSelesai) {
        if (btnSelesai) btnSelesai.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
    } else {
        if (btnSelesai) btnSelesai.style.display = 'inline-block';
        if (btnEdit) btnEdit.style.display = 'inline-block';
    }

    document.getElementById('popup-detail-riwayat').style.display = 'flex';
}

function tutupPopupDetail() {
    document.getElementById('popup-detail-riwayat').style.display = 'none';
}

// Buka Popup Edit Detail Bahan (dari popup detail)
function bukaPopupEditDetail() {
    const items = riwayatBelanja.filter(item => item.grup_belanja === currentDetailGrup);

    const tbody = document.getElementById('tbody-edit-detail');
    tbody.innerHTML = items.map((item, index) => {
        const total = parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan);
        return `
            <tr>
                <td>${index + 1}</td>
                <td><input type="text" value="${item.nama_bahan}" id="edit-detail-nama-${item.id_pembelian}" readonly></td>
                <td><input type="text" value="${item.satuan}" id="edit-detail-satuan-${item.id_pembelian}" readonly></td>
                <td><input type="number" step="0.001" value="${parseFloat(item.jumlah_beli)}" id="edit-detail-jumlah-${item.id_pembelian}" onchange="updateTotalEditDetail()"></td>
                <td><input type="number" step="0.01" value="${parseFloat(item.harga_satuan)}" id="edit-detail-harga-${item.id_pembelian}" onchange="updateTotalEditDetail()"></td>
                <td id="edit-detail-total-${item.id_pembelian}">Rp ${total.toLocaleString('id-ID')}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="hapusRiwayatDetail(${item.id_pembelian})" style="padding: 5px 10px; font-size: 12px;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('popup-edit-detail').style.display = 'flex';
}

function updateTotalEditDetail() {
    const items = riwayatBelanja.filter(item => item.grup_belanja === currentDetailGrup);
    items.forEach(item => {
        const jumlah = parseFloat(document.getElementById(`edit-detail-jumlah-${item.id_pembelian}`).value) || 0;
        const harga = parseFloat(document.getElementById(`edit-detail-harga-${item.id_pembelian}`).value) || 0;
        const total = jumlah * harga;
        document.getElementById(`edit-detail-total-${item.id_pembelian}`).textContent = `Rp ${total.toLocaleString('id-ID')}`;
    });
}

function tutupPopupEditDetail() {
    document.getElementById('popup-edit-detail').style.display = 'none';
}

// Simpan Edit Detail Bahan
async function simpanEditDetail() {
    const items = riwayatBelanja.filter(item => item.grup_belanja === currentDetailGrup);
    let allSuccess = true;

    for (const item of items) {
        const jumlah = parseFloat(document.getElementById(`edit-detail-jumlah-${item.id_pembelian}`).value);
        const harga = parseFloat(document.getElementById(`edit-detail-harga-${item.id_pembelian}`).value);

        if (isNaN(jumlah) || isNaN(harga)) {
            alert('Jumlah dan Harga Satuan harus berupa angka!');
            return;
        }

        try {
            const response = await fetch(`/api/update-belanja-bahan/${item.id_pembelian}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jumlah_beli: jumlah,
                    harga_satuan: harga,
                    total_harga: jumlah * harga
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                allSuccess = false;
            }
        } catch (error) {
            console.error('Error update:', error);
            allSuccess = false;
        }
    }

    if (allSuccess) {
        alert('Berhasil mengupdate detail bahan!');
        tutupPopupEditDetail();
        tutupPopupDetail();
        loadRiwayatBelanja(); // Reload data
    } else {
        alert('Gagal mengupdate beberapa data.');
    }
}

// Tandai Selesai
async function tandaiSelesai(grupParam) {
    const targetGrup = grupParam || currentDetailGrup;
    if (!targetGrup) {
        alert('Grup belanja tidak ditemukan.');
        return;
    }

    if (!confirm('Tandai belanja ini sebagai Selesai? Stok bahan akan bertambah otomatis.')) return;

    try {
        const response = await fetch(`/api/tandai-belanja-selesai/${targetGrup}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (response.ok && data.success) {
            // Dapatkan item dari data.items atau fallback dari riwayatBelanja
            let itemsUpgraded = (data.items && data.items.length > 0)
                ? data.items
                : riwayatBelanja.filter(item => String(item.grup_belanja) === String(targetGrup));

            if (itemsUpgraded && itemsUpgraded.length > 0) {
                let existingUpgrades = [];
                try {
                    const raw = localStorage.getItem('bahan_baku_upgrades');
                    if (raw) existingUpgrades = JSON.parse(raw).items || [];
                } catch(e) {}

                itemsUpgraded.forEach(newItem => {
                    const bId = newItem.bahan_id || newItem.id_bahan;
                    const jBeli = parseFloat(newItem.jumlah_beli || newItem.jumlah || 0);
                    const idx = existingUpgrades.findIndex(u => String(u.bahan_id) === String(bId));
                    if (idx >= 0) {
                        existingUpgrades[idx].jumlah_beli = parseFloat(existingUpgrades[idx].jumlah_beli) + jBeli;
                    } else {
                        existingUpgrades.push({
                            bahan_id: bId,
                            jumlah_beli: jBeli,
                            satuan: newItem.satuan || ''
                        });
                    }
                });

                localStorage.setItem('bahan_baku_upgrades', JSON.stringify({
                    timestamp: Date.now(),
                    items: existingUpgrades
                }));
            }

            alert('Berhasil! Stok bahan telah ditambahkan.');
            tutupPopupDetail();
            loadRiwayatBelanja(); // Reload data
        } else {
            alert('Gagal: ' + (data.message || 'Terjadi kesalahan'));
        }
    } catch (error) {
        console.error('Error tandai selesai:', error);
        alert('Terjadi kesalahan');
    }
}

// Download PDF (Buka Tab Native PDF Viewer Browser)
async function downloadPDF(grupBelanja) {
    const items = riwayatBelanja.filter(item => item.grup_belanja === grupBelanja);
    if (items.length === 0) {
        alert('Data belanja tidak ditemukan.');
        return;
    }

    const firstItem = items[0];
    const totalHarga = items.reduce((sum, item) => {
        return sum + (parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan));
    }, 0);

    const tanggalFormatted = new Date(firstItem.tanggal_beli).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const statusText = firstItem.status === 'selesai' ? 'Selesai' : 'Belum Dibeli';
    const statusBg = firstItem.status === 'selesai' ? '#d4edda' : '#fff3cd';
    const statusColor = firstItem.status === 'selesai' ? '#155724' : '#856404';

    // Cari nama pelanggan jika sumber dari Pre-Order
    let namaPelanggan = '';
    items.forEach(item => {
        if (!namaPelanggan && item.sumber) {
            const match = item.sumber.match(/\(([^)]+)\)/);
            if (match && match[1]) namaPelanggan = match[1].trim();
        }
    });

    const isPO = items.some(item => {
        const s = String(item.sumber || '').toLowerCase();
        return s.includes('pre-order') || s.includes('preorder') || s.includes('po');
    });

    let docTitle = '';
    if (isPO) {
        docTitle = namaPelanggan ? `Daftar Belanja Pesanan (${namaPelanggan})` : 'Daftar Belanja Pesanan Pelanggan';
    } else {
        docTitle = 'Daftar Belanja Bahan Baku Makanan';
    }

    const sumberText = isPO ? (namaPelanggan ? `Pre-Order (${namaPelanggan})` : 'Pre-Order') : 'Prediksi';
    const sumberBg = isPO ? '#e3f2fd' : '#f3e5f5';
    const sumberColor = isPO ? '#0d47a1' : '#4a148c';
    const filename = `${docTitle.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_')}_${tanggalFormatted.replace(/\s+/g, '_')}.pdf`;

    const htmlString = `
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #333; background: #ffffff; width: 700px; box-sizing: border-box;">
            <h1 style="color: #d35400; margin-top: 0; margin-bottom: 15px; font-size: 22px; border-bottom: 2px solid #d35400; padding-bottom: 8px;">
                🛒 ${docTitle}
            </h1>
            
            <div style="margin-bottom: 20px; font-size: 14px; background: #fdfefe; border: 1px solid #ebedef; padding: 14px; border-radius: 8px;">
                <p style="margin: 6px 0;"><strong>Tanggal Rencana Belanja:</strong> ${tanggalFormatted}</p>
                <p style="margin: 6px 0;"><strong>Status:</strong> <span style="padding: 3px 10px; border-radius: 4px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">${statusText}</span></p>
                <p style="margin: 6px 0;"><strong>Sumber:</strong> <span style="padding: 3px 10px; border-radius: 4px; font-weight: bold; background-color: ${sumberBg}; color: ${sumberColor};">${sumberText}</span></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <thead>
                    <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: center; width: 40px;">No</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left;">Nama Bahan Baku</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: center; width: 70px;">Satuan</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: right; width: 80px;">Jumlah</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: right; width: 110px;">Harga Satuan</th>
                        <th style="border: 1px solid #dee2e6; padding: 10px; text-align: right; width: 120px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => {
                        const total = parseFloat(item.jumlah_beli) * parseFloat(item.harga_satuan);
                        return `
                            <tr>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: center;">${index + 1}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; font-weight: bold;">${item.nama_bahan || '-'}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: center;">${item.satuan || '-'}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: right;">${formatDesimalIndo(item.jumlah_beli)}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: right;">Rp ${parseFloat(item.harga_satuan).toLocaleString('id-ID')}</td>
                                <td style="border: 1px solid #dee2e6; padding: 9px 10px; text-align: right; font-weight: bold;">Rp ${total.toLocaleString('id-ID')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="font-weight: bold; font-size: 16px; margin-top: 20px; text-align: right; background: #f8f9fa; padding: 12px 15px; border-radius: 6px; border: 1px solid #dee2e6;">
                Total Estimasi Belanja: <span style="color: #d35400;">Rp ${totalHarga.toLocaleString('id-ID')}</span>
            </div>
        </div>
    `;

    try {
        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const worker = html2pdf().from(htmlString).set(opt);
            const pdfDoc = await worker.toPdf().get('pdf');
            pdfDoc.setProperties({
                title: docTitle,
                subject: docTitle,
                author: 'Rumah Makan Apel'
            });

            const pdfBlob = await worker.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
        } else {
            alert('Library html2pdf belum siap. Silakan coba beberapa saat lagi.');
        }
    } catch (err) {
        console.error('Error generate PDF Blob:', err);
        alert('Gagal membuka preview PDF.');
    }
}

// ===== TUTUP POPUP KLIK DI LUAR =====
document.addEventListener('click', (e) => {
    const popupEditDaftar = document.getElementById('popup-edit-daftar');
    const popupDetail = document.getElementById('popup-detail-riwayat');
    const popupEditDetail = document.getElementById('popup-edit-detail');

    if (e.target === popupEditDaftar) tutupPopupEditDaftar();
    if (e.target === popupDetail) tutupPopupDetail();
    if (e.target === popupEditDetail) tutupPopupEditDetail();
});

// Hapus item dari Riwayat Belanja (Detail)
async function hapusRiwayatDetail(id_pembelian) {
    if (!confirm("Hapus bahan ini secara permanen dari Riwayat Belanja? Bahan ini akan bisa diprediksi lagi nanti.")) return;

    try {
        const response = await fetch(`/api/hapus-belanja-bahan/${id_pembelian}`, {
            method: "DELETE"
        });
        const data = await response.json();
        if (response.ok && data.success) {
            // Hapus dari state lokal
            riwayatBelanja = riwayatBelanja.filter(item => item.id_pembelian !== id_pembelian);
            // Render ulang popup edit detail
            bukaPopupEditDetail();
            // Render ulang kartu di background
            renderRiwayatBelanja();
        } else {
            alert("Gagal menghapus: " + (data.message || "Terjadi kesalahan"));
        }
    } catch (error) {
        console.error("Error hapus riwayat detail:", error);
        alert("Terjadi kesalahan saat menghapus");
    }
}
