(function () {
    'use strict';

    // ---------- Konfigurasi ----------
    const INTERVAL_REFRESH_MS = 15000;
    const SLA_MENIT = 30;                 // sama dengan Firms:SlaMenit di backend
    const BATAS_JARAK_FOTO_KM = 2;        // foto lebih jauh dari ini ditandai perlu dicek

    const STATUS = {
        Baru:         { label: 'Baru',          warna: '#D63B1F' },
        MenujuLokasi: { label: 'Menuju lokasi', warna: '#D98A12' },
        Dicek:        { label: 'Dicek',         warna: '#A88400' },
        Penanganan:   { label: 'Penanganan',    warna: '#E2520F' },
        Padam:        { label: 'Padam',         warna: '#2E7D4F' },
        Pemantauan:   { label: 'Pemantauan',    warna: '#2C6E9B' },
        Selesai:      { label: 'Selesai',       warna: '#8C968F' },
        AlarmPalsu:   { label: 'Alarm palsu',   warna: '#8C968F' }
    };
    const statusInfo = s => STATUS[s] || { label: s, warna: '#8C968F' };

    // Urutan langkah untuk penanda progres di detail tiket
    const LANGKAH = [
        { kunci: 'Baru', label: 'Baru' },
        { kunci: 'MenujuLokasi', label: 'Menuju' },
        { kunci: 'Dicek', label: 'Dicek' },
        { kunci: 'Penanganan', label: 'Ditangani' },
        { kunci: 'Pemantauan', label: 'Dipantau' },
        { kunci: 'Selesai', label: 'Selesai' }
    ];

    // ---------- Util ----------
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const angka = (v, d = 1) => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d });

    function ambilToken() {
        try { return localStorage.getItem('fr_token'); } catch { return null; }
    }
    function keluar() {
        try { localStorage.removeItem('fr_token'); localStorage.removeItem('fr_nama'); } catch { /* abaikan */ }
        location.href = '/Home/Login';
    }

    function waktu(iso) {
        if (!iso) return '–';
        return new Date(iso).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }) + ' WIB';
    }
    function jamSaja(d) {
        return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    const menitSejak = iso => (Date.now() - new Date(iso).getTime()) / 60000;
    function sejak(iso) {
        if (!iso) return '';
        const m = Math.round(menitSejak(iso));
        if (m < 1) return 'baru saja';
        if (m < 60) return `${m} mnt lalu`;
        const j = Math.floor(m / 60);
        return j < 24 ? `${j} jam lalu` : `${Math.floor(j / 24)} hari lalu`;
    }
    function selisihMenit(dari, ke) {
        if (!dari || !ke) return null;
        return Math.round((new Date(ke) - new Date(dari)) / 60000);
    }
    function jarakKm(lat1, lon1, lat2, lon2) {
        const r = d => d * Math.PI / 180;
        const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const butuhBantuan = t => t.dieskalasi && !t.bantuanDikirim && !['Selesai', 'AlarmPalsu'].includes(t.status);
    const perluTindakan = t => t.status === 'Baru' || butuhBantuan(t);

    let timerToast;
    function toast(teks, jenis = '') {
        const el = $('toast');
        el.textContent = teks;
        el.className = 'toast tampil' + (jenis ? ' ' + jenis : '');
        clearTimeout(timerToast);
        timerToast = setTimeout(() => el.classList.remove('tampil'), 4500);
    }

    async function api(path, opsi = {}) {
        const res = await fetch(path, {
            ...opsi,
            headers: { ...(opsi.headers || {}), Authorization: 'Bearer ' + ambilToken() }
        });
        if (res.status === 401) { keluar(); throw new Error('Sesi habis, silakan masuk lagi.'); }
        if (!res.ok) {
            let pesan;
            try { pesan = (await res.json()).pesan; } catch { /* bukan JSON */ }
            throw new Error(pesan || `Permintaan gagal (HTTP ${res.status}).`);
        }
        return res.json();
    }

    // ---------- Peta ----------
    const peta = L.map('peta', { preferCanvas: true, zoomControl: true }).setView([-2.8, 113.5], 7);
    const dasarSatelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Citra &copy; Esri'
    });
    const dasarJalan = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap'
    });
    dasarJalan.addTo(peta);

    const lapisTitik = L.layerGroup().addTo(peta);
    const lapisDesa = L.layerGroup().addTo(peta);
    const lapisTiket = L.layerGroup().addTo(peta);
    L.control.layers(
        { 'Peta jalan': dasarJalan, 'Citra satelit': dasarSatelit },
        { 'Titik panas': lapisTitik, 'Wilayah regu': lapisDesa, 'Tiket': lapisTiket },
        { collapsed: true }
    ).addTo(peta);

    let penandaTiket = {};
    let sudahDiposisikan = false;

    function ikonTiket(t) {
        const s = statusInfo(t.status);
        const kelas = ['mk'];
        if (perluTindakan(t)) kelas.push('denyut');
        if (butuhBantuan(t)) kelas.push('esk');
        if (t.id === dipilih) kelas.push('pilih');
        return L.divIcon({
            className: '',
            html: `<span class="${kelas.join(' ')}" style="--warna:${s.warna}"></span>`,
            iconSize: [18, 18], iconAnchor: [9, 9]
        });
    }

    function renderPeta(data) {
        lapisTitik.clearLayers();
        data.titikPanas.forEach(t => {
            L.circleMarker([t.lat, t.lon], {
                radius: 3, stroke: false, fillOpacity: .9,
                fillColor: t.confidence === 'h' ? '#ff3b1f' : '#ffa21c'
            }).bindTooltip(`Titik panas, FRP ${angka(t.frp)} MW<br>${waktu(t.waktuDeteksiUtc)}`).addTo(lapisTitik);
        });

        lapisDesa.clearLayers();
        data.desa.forEach(d => {
            L.circle([d.lat, d.lon], {
                radius: d.radiusKm * 1000, color: '#142019', weight: 1.5, dashArray: '6 6', fillColor: '#142019', fillOpacity: .05
            }).addTo(lapisDesa);
            L.marker([d.lat, d.lon], {
                interactive: false,
                icon: L.divIcon({ className: '', html: `<div class="label-desa">${esc(d.nama)}</div>`, iconSize: [0, 0] })
            }).addTo(lapisDesa);
        });

        lapisTiket.clearLayers();
        penandaTiket = {};
        data.tiket.forEach(t => {
            const s = statusInfo(t.status);
            const m = L.marker([t.lat, t.lon], { icon: ikonTiket(t), zIndexOffset: perluTindakan(t) ? 1000 : 0, keyboard: true, title: `Tiket #${t.id}` })
                .bindTooltip(`#${t.id} ${esc(t.desa)}<br>${s.label}`)
                .on('click', () => pilih(t.id))
                .addTo(lapisTiket);
            penandaTiket[t.id] = m;
        });

        if (!sudahDiposisikan) {
            const acuan = Object.values(penandaTiket);
            if (acuan.length) peta.fitBounds(L.featureGroup(acuan).getBounds().pad(0.4));
            else if (data.desa.length) peta.fitBounds(L.latLngBounds(data.desa.map(d => [d.lat, d.lon])).pad(0.6));
            sudahDiposisikan = true;
        }
    }

    function tandaiPilihan() {
        Object.entries(penandaTiket).forEach(([id, m]) => {
            const t = tiketTerakhir.find(x => x.id === Number(id));
            if (t) m.setIcon(ikonTiket(t));
        });
    }

    // ---------- Ringkasan ----------
    function renderRingkasan(r, tiket) {
        const bantuan = tiket.filter(butuhBantuan).length;
        const desa = new Set(tiket.map(t => t.desa)).size;

        $('kpi-baru').textContent = angka(r.tiketBaru, 0);
        $('kpi-eskalasi').textContent = angka(bantuan, 0);
        $('kpi-aktif').textContent = angka(r.tiketAktif, 0);
        $('sub-aktif').textContent = desa ? `di ${desa} wilayah regu` : 'tidak ada tiket aktif';
        $('kpi-respons').textContent = r.rataResponsMenit == null ? '–' : `${angka(r.rataResponsMenit)} mnt`;
        $('kpi-palsu').textContent = `${angka(r.rasioAlarmPalsuPersen)}%`;
        $('kpi-luas').textContent = `${angka(r.totalLuasTerbakarHa, 2)} ha`;
        $('kotak-baru').classList.toggle('menyala', r.tiketBaru > 0);
        $('kotak-eskalasi').classList.toggle('menyala', bantuan > 0);
    }

    // ---------- Antrean ----------
    let dipilih = null;
    let filter = 'semua';
    let tiketTerakhir = [];

    const SARINGAN = {
        semua: () => true,
        aksi: perluTindakan,
        tangani: t => ['MenujuLokasi', 'Dicek', 'Penanganan'].includes(t.status),
        pantau: t => t.status === 'Pemantauan'
    };

    function urutPrioritas(a, b) {
        const skor = t => (butuhBantuan(t) ? 0 : t.status === 'Baru' ? 1 : t.status === 'Penanganan' ? 2 : 3);
        return skor(a) - skor(b) || new Date(a.dibuatUtc) - new Date(b.dibuatUtc);
    }

    function flagTiket(t) {
        const f = [];
        // Tiket Baru yang lewat batas sudah dijelaskan oleh jam SLA, jadi tidak perlu label lagi
        if (butuhBantuan(t) && !(t.eskalasiOtomatis && t.status === 'Baru')) {
            f.push(`<span class="flag merah">${t.eskalasiOtomatis ? 'Lewat batas 30 mnt' : 'Regu minta bantuan'}</span>`);
        }
        if (t.bantuanDikirim) f.push('<span class="flag hijau">Bantuan dikirim</span>');
        if (t.jumlahDibukaUlang > 0) f.push(`<span class="flag merah">Api muncul lagi ${t.jumlahDibukaUlang}×</span>`);
        if (t.luasTerbakarHa != null) f.push(`<span class="flag">${angka(t.luasTerbakarHa, 2)} ha terbakar</span>`);
        return f.join('');
    }

    function jamSla(t) {
        if (t.status !== 'Baru') return '';
        const m = menitSejak(t.dibuatUtc);
        const persen = Math.min(100, (m / SLA_MENIT) * 100);
        const kritis = m >= SLA_MENIT * 0.66;
        const teks = m >= SLA_MENIT
            ? `${Math.floor(m)} mnt tanpa respons, BPBD sudah diberi tahu`
            : `${Math.floor(m)} mnt tanpa respons, eskalasi dalam ${Math.ceil(SLA_MENIT - m)} mnt`;
        return `<div class="sla ${kritis ? 'kritis' : ''}">
            <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${SLA_MENIT}" aria-valuenow="${Math.floor(Math.min(m, SLA_MENIT))}" aria-label="Waktu sejak tiket dibuat">
                <div class="isi-bar" style="width:${persen}%"></div></div>
            <div class="teks">${teks}</div></div>`;
    }

    function renderDaftar() {
        const list = tiketTerakhir;
        Object.keys(SARINGAN).forEach(k => { $('n-' + k).textContent = list.filter(SARINGAN[k]).length; });

        const el = $('daftar');
        const tampil = list.filter(SARINGAN[filter]).sort(urutPrioritas);
        if (!list.length) {
            el.innerHTML = '<p class="kosong">Belum ada tiket aktif. Satelit belum mendeteksi titik panas di wilayah regu. Untuk latihan, putar ulang data satelit tanggal sebelumnya dari bilah atas.</p>';
            return;
        }
        if (!tampil.length) {
            el.innerHTML = '<p class="kosong">Tidak ada tiket di kategori ini.</p>';
            return;
        }
        el.innerHTML = tampil.map(t => {
            const s = statusInfo(t.status);
            return `
            <button class="tiket ${perluTindakan(t) ? 'genting' : ''}" data-id="${t.id}" style="--warna:${s.warna}">
                <div class="baris">
                    <span class="judul"><span class="no">#${t.id}</span>${esc(t.desa)}</span>
                    <span class="status-teks">${s.label}</span>
                </div>
                <div class="meta">${esc(t.regu || 'Belum ada regu')}, ${angka(t.jarakKm)} km dari desa, dibuat ${sejak(t.dibuatUtc)}</div>
                ${jamSla(t)}
                <div class="flags">${flagTiket(t)}</div>
            </button>`;
        }).join('');
        el.querySelectorAll('.tiket').forEach(b => b.addEventListener('click', () => pilih(Number(b.dataset.id))));
    }

    document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
        filter = c.dataset.filter;
        document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
        renderDaftar();
    }));

    // ---------- Detail tiket ----------
    function pilih(id) {
        dipilih = id;
        $('panel-daftar').hidden = true;
        $('panel-detail').hidden = false;
        $('panel-detail').innerHTML = '<p class="kosong" style="padding:16px">Memuat detail tiket…</p>';
        tandaiPilihan();
        const m = penandaTiket[id];
        if (m) peta.flyTo(m.getLatLng(), Math.max(peta.getZoom(), 11), { duration: .6 });
        muatDetail();
    }

    function tutupDetail() {
        dipilih = null;
        tandaiPilihan();
        $('panel-detail').hidden = true;
        $('panel-daftar').hidden = false;
    }

    async function muatDetail() {
        if (dipilih == null) return;
        const id = dipilih;
        try {
            const d = await api(`/api/tiket/${id}`);
            if (dipilih === id) renderDetail(d);
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function langkahHtml(status) {
        if (status === 'AlarmPalsu') return '<p class="flag" style="align-self:flex-start">Ditutup sebagai alarm palsu</p>';
        const kini = status === 'Padam' ? 'Pemantauan' : status;
        const idx = LANGKAH.findIndex(l => l.kunci === kini);
        return `<ol class="langkah" aria-label="Progres penanganan">${LANGKAH.map((l, i) =>
            `<li class="${i < idx ? 'lewat' : i === idx ? 'kini' : ''}" ${i === idx ? 'aria-current="step"' : ''}>
                <div class="garis-langkah"></div><span>${l.label}</span></li>`).join('')}</ol>`;
    }

    function renderDetail({ tiket: t, update }) {
        const bolehKirimBantuan = butuhBantuan(t);

        const linimasa = update.slice().reverse().map(u => {
            const su = statusInfo(u.status);
            let lokasi = '';
            if (u.fotoPath && u.lat != null && u.lon != null && t.lat != null) {
                const jarak = jarakKm(u.lat, u.lon, t.lat, t.lon);
                const jauh = jarak > BATAS_JARAK_FOTO_KM;
                lokasi = `<div class="lokasi-foto ${jauh ? 'jauh' : 'ok'}">
                    Foto diambil ${angka(jarak, 2)} km dari titik panas${jauh ? ', lokasi perlu dicek' : ''}</div>`;
            }
            const rincian = [
                u.ukuranApi && `Api ${esc(u.ukuranApi.toLowerCase())}`,
                u.luasHa != null && `${angka(u.luasHa, 2)} ha`,
                u.arahSebaran && `menyebar ke ${esc(u.arahSebaran.toLowerCase())}`
            ].filter(Boolean).join(', ');
            return `
            <li style="--dot:${su.warna}">
                <div class="waktu">${waktu(u.waktuUtc)}, ${esc(su.label)}</div>
                <div class="oleh">${esc(u.oleh)}</div>
                ${u.catatan ? `<p>${esc(u.catatan)}</p>` : ''}
                ${rincian ? `<p>${rincian}</p>` : ''}
                ${u.fotoPath ? `<a href="${esc(u.fotoPath)}" target="_blank" rel="noopener"><img src="${esc(u.fotoPath)}" alt="Foto lapangan dari ${esc(u.oleh)}"></a>` : ''}
                ${lokasi}
            </li>`;
        }).join('');

        const respons = selisihMenit(t.dibuatUtc, t.direponsUtc);
        const sampaiPadam = selisihMenit(t.dibuatUtc, t.padamUtc);

        $('panel-detail').innerHTML = `
            <div class="panel-head">
                <div class="baris">
                    <button class="kembali" id="btn-kembali">‹ Antrean tiket</button>
                    <span class="status-teks" style="--warna:${statusInfo(t.status).warna}">${statusInfo(t.status).label}</span>
                </div>
            </div>
            <div class="detail-isi">
                <div style="display:flex;flex-direction:column;gap:10px">
                    <h3 class="detail-judul">#${t.id} ${esc(t.desa)}</h3>
                    ${langkahHtml(t.status)}
                    ${jamSla(t)}
                    <div class="flags">${flagTiket(t)}</div>
                </div>
                <dl class="info">
                    <div><dt>Regu</dt><dd>${esc(t.regu || '–')}</dd></div>
                    <div><dt>Jarak dari desa</dt><dd>${angka(t.jarakKm)} km</dd></div>
                    <div><dt>Terdeteksi satelit</dt><dd>${waktu(t.waktuDeteksiUtc)}</dd></div>
                    <div><dt>Intensitas api (FRP)</dt><dd>${angka(t.frp)} MW</dd></div>
                    <div><dt>Waktu respons regu</dt><dd>${respons == null ? 'Belum direspons' : respons + ' mnt'}</dd></div>
                    <div><dt>Tiba di lokasi</dt><dd>${waktu(t.tibaUtc)}</dd></div>
                    <div><dt>Dari deteksi sampai padam</dt><dd>${sampaiPadam == null ? '–' : sampaiPadam + ' mnt'}</dd></div>
                    <div><dt>Luas terbakar</dt><dd>${t.luasTerbakarHa == null ? '–' : angka(t.luasTerbakarHa, 2) + ' ha'}</dd></div>
                </dl>
                <div class="aksi">
                    ${bolehKirimBantuan ? `<button id="btn-bantuan">Kirim bantuan BPBD</button>` : ''}
                    <button class="ghost" id="btn-fokus">Perbesar di peta</button>
                </div>
                <div>
                    <h2 style="margin-bottom:12px">Laporan lapangan</h2>
                    <ul class="timeline">${linimasa}</ul>
                </div>
            </div>`;

        $('btn-kembali').addEventListener('click', tutupDetail);
        $('btn-fokus').addEventListener('click', () => {
            if (t.lat != null) peta.flyTo([t.lat, t.lon], 14, { duration: .6 });
        });
        if (bolehKirimBantuan) {
            $('btn-bantuan').addEventListener('click', async (e) => {
                const tombol = e.currentTarget;
                tombol.disabled = true;
                try {
                    await api(`/api/tiket/${t.id}/bantuan`, { method: 'POST' });
                    toast(`Bantuan dikirim ke tiket #${t.id}. Regu akan menerima kabar di HP.`);
                    await muatSemua();
                } catch (err) {
                    toast(err.message, 'error');
                    tombol.disabled = false;
                }
            });
        }
    }

    // ---------- Muat data ----------
    let sedangMuat = false;
    let idDikenal = null;

    function setLive(ok, teks) {
        $('live').classList.toggle('putus', !ok);
        $('live-teks').textContent = teks;
    }

    async function muatSemua() {
        if (sedangMuat) return;
        sedangMuat = true;
        try {
            const [ringkasan, dataPeta] = await Promise.all([
                api('/api/dashboard/ringkasan'),
                api('/api/dashboard/peta?jam=48')
            ]);

            // Beri tahu admin kalau ada tiket baru sejak refresh terakhir
            if (idDikenal) {
                const baru = dataPeta.tiket.filter(t => !idDikenal.has(t.id) && t.status === 'Baru');
                if (baru.length === 1) toast(`Tiket baru #${baru[0].id} di ${baru[0].desa}. Regu sudah diberi tahu.`, 'alarm');
                else if (baru.length > 1) toast(`${baru.length} tiket baru masuk. Regu terdekat sudah diberi tahu.`, 'alarm');
                const minta = dataPeta.tiket.filter(t => butuhBantuan(t) && !tiketTerakhir.some(x => x.id === t.id && butuhBantuan(x)));
                if (minta.length && !baru.length) toast(`Tiket #${minta[0].id} di ${minta[0].desa} butuh bantuan BPBD.`, 'alarm');
            }
            idDikenal = new Set(dataPeta.tiket.map(t => t.id));
            tiketTerakhir = dataPeta.tiket;

            renderRingkasan(ringkasan, dataPeta.tiket);
            renderPeta(dataPeta);
            renderDaftar();
            if (dipilih != null) await muatDetail();
            setLive(true, `Diperbarui ${jamSaja(new Date())}`);
        } catch (e) {
            setLive(false, 'Koneksi terputus, mencoba lagi');
        } finally {
            sedangMuat = false;
        }
    }

    // ---------- Bilah atas ----------
    async function jalankan(tombol, path, pesanSukses) {
        tombol.disabled = true;
        try {
            const r = await api(path, { method: 'POST' });
            toast(pesanSukses(r));
            sudahDiposisikan = false;
            idDikenal = null;   // tiket hasil putar ulang tidak perlu dimunculkan sebagai notifikasi satu per satu
            await muatSemua();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            tombol.disabled = false;
        }
    }

    $('btn-replay').addEventListener('click', (e) => {
        const tgl = $('tgl-replay').value;
        if (!tgl) { toast('Pilih tanggal yang mau diputar ulang.', 'error'); return; }
        jalankan(e.currentTarget, `/api/admin/firms/replay?tanggal=${tgl}`,
            r => `Data ${tgl} diputar: ${angka(r.baru, 0)} titik panas baru, ${angka(r.tiketDibuat, 0)} tiket dibuat.`);
    });
    $('btn-tarik').addEventListener('click', (e) => {
        jalankan(e.currentTarget, '/api/admin/firms/tarik',
            r => r.diterima === 0 ? 'Satelit belum mendeteksi titik panas baru di area pantauan.'
                                  : `${angka(r.baru, 0)} titik panas baru, ${angka(r.tiketDibuat, 0)} tiket dibuat.`);
    });
    $('btn-keluar').addEventListener('click', keluar);

    function jalankanJam() {
        $('jam').textContent = new Date().toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit'
        }) + ' WIB';
    }

    // ---------- Mulai ----------
    async function mulai() {
        if (!ambilToken()) { keluar(); return; }
        try {
            const saya = await api('/api/auth/saya');
            if (saya.role !== 'Admin') { keluar(); return; }
            $('nama-admin').textContent = saya.namaLengkap;
        } catch {
            setLive(false, 'Server tidak bisa dihubungi');
            return;
        }
        jalankanJam();
        setInterval(jalankanJam, 30000);
        await muatSemua();
        setInterval(muatSemua, INTERVAL_REFRESH_MS);
        // Jam SLA di antrean berjalan walau data belum berubah
        setInterval(() => { if (!$('panel-daftar').hidden) renderDaftar(); }, 30000);
    }

    mulai();
})();
