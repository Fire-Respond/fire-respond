(function () {
    const form = document.getElementById('form-login');
    const pesan = document.getElementById('pesan-error');
    const tombol = document.getElementById('btn-masuk');
    const inputPw = document.getElementById('password');
    const btnTogglePw = document.getElementById('btn-toggle-pw');

    function tampilkanError(teks) {
        pesan.textContent = teks;
        pesan.hidden = false;
    }

    // Toggle lihat kata sandi
    if (btnTogglePw && inputPw) {
        btnTogglePw.addEventListener('click', () => {
            const isPassword = inputPw.type === 'password';
            inputPw.type = isPassword ? 'text' : 'password';
            btnTogglePw.setAttribute('aria-label', isPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
            
            const eyeOpen = btnTogglePw.querySelector('.eye-open');
            const eyeClosed = btnTogglePw.querySelector('.eye-closed');
            if (eyeOpen && eyeClosed) {
                eyeOpen.style.display = isPassword ? 'none' : 'block';
                eyeClosed.style.display = isPassword ? 'block' : 'none';
            }
        });
    }

    form.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { pesan.hidden = true; }));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = form.username.value.trim();
        const password = form.password.value;
        if (!username || !password) {
            tampilkanError('Isi nama pengguna dan kata sandi terlebih dahulu.');
            return;
        }

        tombol.disabled = true;
        tombol.classList.add('loading');
        const btnText = tombol.querySelector('.btn-text');
        const btnSpinner = tombol.querySelector('.btn-spinner');
        if (btnText && btnSpinner) {
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline-block';
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.pesan || 'Masuk gagal. Periksa kembali nama pengguna dan kata sandi.');
            if (data.role !== 'Admin') throw new Error('Akun ini merupakan akun regu lapangan. Dashboard web ini khusus untuk admin BPBD.');

            try {
                localStorage.setItem('fr_token', data.token);
                localStorage.setItem('fr_nama', data.nama);
            } catch { /* browser memblokir penyimpanan lokal */ }
            location.href = '/';
        } catch (err) {
            tampilkanError(err.message);
        } finally {
            tombol.disabled = false;
            tombol.classList.remove('loading');
            if (btnText && btnSpinner) {
                btnText.style.display = 'inline';
                btnSpinner.style.display = 'none';
            }
        }
    });
})();
