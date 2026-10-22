// Ambil elemen form dan popup
const formDaftar = document.getElementById('form-daftar');
const popupSukses = document.getElementById('popup-sukses');

// Saat form disubmit
formDaftar.addEventListener('submit', async function(event) {
    event.preventDefault(); // Stop form submit default

    // Ambil nilai dari form
    const password = document.getElementById('password').value;
    const konfirmasiPassword = document.getElementById('konfirmasi_password').value;

    // Validasi: Password harus sama
    if (password !== konfirmasiPassword) {
        alert('Password dan Konfirmasi Password tidak cocok!');
        return;
    }

    // Validasi: Password minimal 8 karakter
    if (password.length < 8) {
        alert('Password minimal 8 karakter!');
        return;
    }

    // Kirim data ke server
    try {
        const response = await fetch('/daftar-pelanggan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nama: document.getElementById('nama').value,
                alamat: document.getElementById('alamat').value,
                no_hp: document.getElementById('no_hp').value,
                username: document.getElementById('username').value,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            // Tampilkan popup sukses
            popupSukses.style.display = 'flex';
        } else {
            alert('Gagal mendaftar: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan saat mendaftar');
    }
});