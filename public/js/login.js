// ===== SAAT HALAMAN SELESAI DIMUAT =====
document.addEventListener('DOMContentLoaded', () => {
    setupLoginForm();
});

// ===== SETUP FORM LOGIN =====
function setupLoginForm() {
    const form = document.getElementById('form-login'); // Gunakan ID spesifik
    
    if (!form) {
        console.error('Form login tidak ditemukan');
        return;
    }
    
    form.addEventListener('submit', async function(event) {
        event.preventDefault(); // Mencegah reload halaman

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            alert('Mohon masukkan username dan password!');
            return;
        }

        // Ubah teks tombol jadi "Memproses..." agar user tahu sedang loading
        const btn = form.querySelector('.btn-login');
        const originalText = btn.textContent;
        btn.textContent = 'Memproses...';
        btn.disabled = true;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // PINDAHKAN HALAMAN SECARA EKSPLESIT MENGGUNAKAN URL DARI SERVER
                window.location.href = data.redirect;
            } else {
                alert(data.message || 'Login gagal!');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan jaringan saat login');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}