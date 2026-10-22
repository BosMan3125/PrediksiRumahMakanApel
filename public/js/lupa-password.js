// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    setupFormLupaPassword();
});

// ===== SETUP FORM LUPA PASSWORD =====
function setupFormLupaPassword() {
    const form = document.getElementById('form-lupa-password');
    
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Mencegah form submit default

        // Ambil data dari form
        const nama = document.getElementById('nama').value.trim();
        const noHp = document.getElementById('no_hp').value.trim();
        const alamat = document.getElementById('alamat').value.trim();

        // Validasi data tidak kosong
        if (!nama || !noHp || !alamat) {
            alert('Mohon lengkapi semua data!');
            return;
        }

        // Buat pesan WhatsApp
        const pesan = `Nama : ${nama}\nNo. HP : ${noHp}\nAlamat : ${alamat}\nKeterangan lupa password`;

        // Encode pesan untuk URL
        const pesanEncoded = encodeURIComponent(pesan);

        // Nomor WhatsApp admin (format internasional tanpa +)
        const nomorWA = '628990731069';

        // Buat URL WhatsApp
        const urlWA = `https://wa.me/${nomorWA}?text=${pesanEncoded}`;

        // Buka WhatsApp di tab baru
        window.open(urlWA, '_blank');

        // Tampilkan pesan sukses
        alert('Pesan WhatsApp telah dibuka. Silakan kirim pesan tersebut ke admin untuk mendapatkan password Anda.');
        
        // Reset form
        form.reset();
    });
}