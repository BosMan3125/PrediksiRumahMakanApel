// ===== VARIABEL GLOBAL =====
let chartPenjualan = null;
let chartPreorder = null;

// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadDashboardData();
    setupLogout();
    setupFilters();
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

// ===== FUNGSI LOAD SEMUA DATA DASHBOARD =====
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard-pemilik-data');
        const data = await response.json();
        
        if (response.ok) {
            updateTotalPenjualan(data.totalOmzetMinggu || data.totalPenjualanHariIni, data.totalPenjualanLangsung, data.totalPreorder);
            updateBahanHarusDibeli(data.bahanHarusDibeli);
            updateTopMenu(data.topMenu);
            renderChartPenjualan(data.statistikPenjualan);
            renderChartPreorder(data.statistikPreorder);
            updatePreorderTable(data.daftarPreorder);
        } else {
            console.error('Gagal memuat data dashboard:', data.error);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// ===== UPDATE TOTAL PENJUALAN =====
function updateTotalPenjualan(totalOmzet, totalLangsung, totalPreorder) {
    const elTotal = document.getElementById('total-omzet-minggu');
    const elLangsung = document.getElementById('total-penjualan-langsung');
    const elPreorder = document.getElementById('total-preorder-lunas');
    
    if (elTotal) {
        elTotal.textContent = 'Rp ' + parseInt(totalOmzet || 0).toLocaleString('id-ID');
    }
    if (elLangsung) {
        elLangsung.textContent = 'Rp ' + parseInt(totalLangsung || 0).toLocaleString('id-ID');
    }
    if (elPreorder) {
        elPreorder.textContent = 'Rp ' + parseInt(totalPreorder || 0).toLocaleString('id-ID');
    }
}

// ===== UPDATE BAHAN HARUS DIBELI =====
function updateBahanHarusDibeli(bahanList) {
    const tbody = document.querySelector('#bahan-harus-dibeli tbody');
    
    if (!bahanList || bahanList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">Semua stok aman</td></tr>';
        return;
    }
    
    const top5Bahan = bahanList.slice(0, 5);
    tbody.innerHTML = top5Bahan.map((bahan, index) => `
        <tr onclick="window.location.href='bahan-baku-pemilik.html'" style="cursor: pointer;" title="Klik untuk lihat detail bahan baku">
            <td>${index + 1}</td>
            <td>${bahan.nama_bahan}</td>
            <td>${bahan.satuan}</td>
        </tr>
    `).join('');
}

// ===== UPDATE TOP MENU =====
function updateTopMenu(menuList) {
    const tbody = document.querySelector('#top-menu tbody');
    
    if (!menuList || menuList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">Belum ada data</td></tr>';
        return;
    }
    
    tbody.innerHTML = menuList.map((menu, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${menu.nama_menu}</td>
            <td>${menu.jumlah}</td>
        </tr>
    `).join('');
}

// ===== RENDER CHART PENJUALAN =====
function renderChartPenjualan(data) {
    const ctx = document.getElementById('chart-penjualan').getContext('2d');
    
    if (chartPenjualan) {
        chartPenjualan.destroy();
    }
    
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);
    
    chartPenjualan = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan (Rp)',
                data: values,
                backgroundColor: 'rgba(227, 30, 36, 0.6)',
                borderColor: 'rgba(227, 30, 36, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString('id-ID');
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// ===== RENDER CHART PRE-ORDER =====
function renderChartPreorder(data) {
    const ctx = document.getElementById('chart-preorder').getContext('2d');
    
    if (chartPreorder) {
        chartPreorder.destroy();
    }
    
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);
    
    chartPreorder = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Pre-Order',
                data: values,
                backgroundColor: 'rgba(100, 100, 255, 0.6)',
                borderColor: 'rgba(100, 100, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function formatStatusLabel(status) {
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

// ===== UPDATE TABEL PRE-ORDER =====
function updatePreorderTable(daftarPreorder) {
    const tbody = document.querySelector('#preorder-table tbody');
    
    if (!daftarPreorder || daftarPreorder.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">Belum ada pre-order</td></tr>';
        return;
    }
    
    tbody.innerHTML = daftarPreorder.map(po => {
        const statusClass = po.status ? po.status.toLowerCase() : '';
        const statusText = formatStatusLabel(po.status);
        
        return `
            <tr>
                <td>PO-${String(po.id_pre_order).padStart(4, '0')}</td>
                <td>${po.nama_pelanggan || 'N/A'}</td>
                <td>${po.nama_paket || 'N/A'}</td>
                <td>${po.jumlah_porsi}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
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

// ===== SETUP FILTER BULAN =====
function setupFilters() {
    const filterPenjualan = document.getElementById('filter-bulan-penjualan');
    const filterPreorder = document.getElementById('filter-bulan-preorder');
    
    if (filterPenjualan) {
        filterPenjualan.addEventListener('change', () => {
            loadDashboardData(); // Reload data dengan filter
        });
    }
    
    if (filterPreorder) {
        filterPreorder.addEventListener('change', () => {
            loadDashboardData(); // Reload data dengan filter
        });
    }
}