(function () {
    const form = document.getElementById('form-login');
    const pesan = document.getElementById('pesan-error');
    const tombol = document.getElementById('btn-masuk');

    function tampilkanError(teks) {
        pesan.textContent = teks;
        pesan.hidden = false;
    }

    form.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { pesan.hidden = true; }));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = form.username.value.trim();
        const password = form.password.value;
        if (!username || !password) {
            tampilkanError('Isi username dan password dulu.');
            return;
        }

        tombol.disabled = true;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.pesan || 'Login gagal.');
            if (data.role !== 'Admin') throw new Error('Akun ini akun regu. Dashboard ini khusus admin BPBD.');

            try {
                localStorage.setItem('fr_token', data.token);
                localStorage.setItem('fr_nama', data.nama);
            } catch { /* browser memblokir penyimpanan */ }
            location.href = '/';
        } catch (err) {
            tampilkanError(err.message);
        } finally {
            tombol.disabled = false;
        }
    });
})();
