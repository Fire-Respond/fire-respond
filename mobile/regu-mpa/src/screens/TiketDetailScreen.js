import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Circle, Marker, UrlTile } from 'react-native-maps';

// Peta dasar dari tile gratis, bukan Google Maps: Expo Go di Android tidak membawa
// kunci API Google Maps, sehingga peta Google tampil hitam (cuma penanda yang muncul).
const TILE = {
  satelit: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  jalan: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
};
import * as api from '../api';
import { POLLING_MS } from '../config';
import { statusInfo, warna } from '../theme';
import { JamSla, Progres, Tombol } from '../ui';
import { ambilLokasi, angka, waktuWIB } from '../util';

const STATUS_TERBUKA = ['MenujuLokasi', 'Dicek', 'Penanganan', 'Pemantauan'];

export default function TiketDetailScreen({ id, versi, onKembali, onForm, onBerubah }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sibuk, setSibuk] = useState(null);   // nama aksi yang sedang jalan
  const [jenisPeta, setJenisPeta] = useState('satelit');

  const muat = useCallback(async () => {
    try {
      setData(await api.detailTiket(id));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    muat();
    const t = setInterval(muat, POLLING_MS);
    return () => clearInterval(t);
  }, [muat, versi]);

  async function jalankan(nama, fn, pesanSukses) {
    setSibuk(nama);
    try {
      await fn();
      await muat();
      onBerubah();
      if (pesanSukses) Alert.alert('Berhasil', pesanSukses);
    } catch (e) {
      Alert.alert('Gagal', e.message);
    } finally {
      setSibuk(null);
    }
  }

  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <Header onKembali={onKembali} judul={`Tiket #${id}`} />
        <View style={s.tengah}>
          {error ? <Text style={s.errorTeks}>{error}</Text> : <ActivityIndicator color={warna.accent} size="large" />}
        </View>
      </View>
    );
  }

  const { tiket: t, update } = data;

  const terima = () => jalankan('terima', () => api.terimaTiket(t.id),
    'Tiket diterima. Status Anda sekarang "Menuju lokasi". Gunakan tombol Navigasi untuk menuju titik panas.');

  const sudahTiba = () => jalankan('tiba', async () => {
    const lok = await ambilLokasi();
    await api.kirimUpdate(t.id, { status: 'Dicek', lat: lok?.lat, lon: lok?.lon, catatan: 'Regu tiba di lokasi.' });
  });

  const mintaBantuan = () => Alert.alert(
    'Minta bantuan BPBD?',
    'BPBD akan langsung menerima notifikasi bahwa api di lokasi ini di luar kemampuan regu.',
    [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Minta bantuan', style: 'destructive',
        onPress: () => jalankan('eskalasi', () => api.eskalasi(t.id, 'Diminta regu dari lapangan.'),
          'Permintaan bantuan terkirim ke BPBD.'),
      },
    ],
  );

  const navigasi = () => Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lon}&travelmode=driving`,
  );

  const aksi = {
    Baru: [{ label: 'Terima & berangkat', onPress: terima, kunci: 'terima' }],
    MenujuLokasi: [
      { label: 'Api ditemukan', jenis: 'bahaya', onPress: () => onForm(t, 'Penanganan') },
      { label: 'Bukan api (alarm palsu)', jenis: 'biasa', onPress: () => onForm(t, 'AlarmPalsu') },
      { label: 'Sudah tiba, sedang dicek', jenis: 'biasa', onPress: sudahTiba, kunci: 'tiba' },
    ],
    Dicek: [
      { label: 'Api ditemukan', jenis: 'bahaya', onPress: () => onForm(t, 'Penanganan') },
      { label: 'Bukan api (alarm palsu)', jenis: 'biasa', onPress: () => onForm(t, 'AlarmPalsu') },
    ],
    Penanganan: [
      { label: 'Api sudah padam', onPress: () => onForm(t, 'Padam') },
      { label: 'Kirim update kondisi api', jenis: 'biasa', onPress: () => onForm(t, 'Penanganan') },
    ],
    Pemantauan: [
      { label: 'Cek ulang: lokasi aman', onPress: () => onForm(t, 'Pemantauan') },
      { label: 'Api muncul lagi', jenis: 'bahaya', onPress: () => onForm(t, 'Penanganan') },
      { label: 'Tutup tiket', jenis: 'biasa', onPress: () => onForm(t, 'Selesai') },
    ],
  }[t.status] || [];

  const bolehEskalasi = STATUS_TERBUKA.includes(t.status) && !t.dieskalasi;
  const wilayah = { latitude: t.lat, longitude: t.lon, latitudeDelta: 0.06, longitudeDelta: 0.06 };
  const [utama, ...lainnya] = aksi;
  const st = statusInfo(t.status);

  return (
    <View style={{ flex: 1 }}>
      <Header onKembali={onKembali} judul={`Tiket #${t.id}`}
        kanan={<Text style={[s.headerStatus, { color: st.warna === '#8C968F' ? warna.redupGelap : '#FFB48F' }]}>{st.label}</Text>} />
      <ScrollView contentContainerStyle={s.isi}>
        <Text style={s.desa}>{t.desa}</Text>
        <View style={{ marginBottom: 14 }}>
          <Progres status={t.status} />
          {t.status === 'Baru' && <JamSla dibuatUtc={t.dibuatUtc} />}
        </View>

        {t.bantuanDikirim && <Banner jenis="ok" teks="Bantuan BPBD sedang menuju lokasi." />}
        {/* Tiket Baru yang lewat batas sudah dijelaskan oleh jam SLA di atas */}
        {t.dieskalasi && !t.bantuanDikirim && t.status !== 'Baru' && (
          <Banner jenis="bahaya" teks={t.eskalasiOtomatis
            ? 'Tiket ini belum direspons lebih dari 30 menit, BPBD sudah diberi tahu otomatis.'
            : 'Bantuan BPBD sudah diminta. Tunggu konfirmasi pengiriman.'} />
        )}
        {t.status === 'Pemantauan' && (
          <Banner jenis="info" teks="Api sudah padam. Cek ulang lokasi secara berkala: api gambut bisa menyala lagi di bawah permukaan." />
        )}

        <View style={s.petaWrap}>
          <MapView
            style={s.peta} initialRegion={wilayah} showsUserLocation showsMyLocationButton
            mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          >
            <UrlTile key={jenisPeta} urlTemplate={TILE[jenisPeta]} maximumZ={19} zIndex={-1} shouldReplaceMapContent />
            <Circle center={wilayah} radius={375} strokeColor="#FFB48F" strokeWidth={2} fillColor="rgba(226,82,15,0.28)" />
            <Marker coordinate={wilayah} title="Titik panas" description={`FRP ${angka(t.frp)} MW`} pinColor="red" />
          </MapView>
          <Pressable
            onPress={() => setJenisPeta((j) => (j === 'satelit' ? 'jalan' : 'satelit'))}
            accessibilityRole="button" style={s.tombolPeta}
          >
            <Text style={s.tombolPetaTeks}>{jenisPeta === 'satelit' ? 'Peta jalan' : 'Citra satelit'}</Text>
          </Pressable>
          <Text style={s.atribusi}>{jenisPeta === 'satelit' ? '© Esri' : '© Esri, HERE, OpenStreetMap'}</Text>
        </View>
        <Text style={s.catatanPeta}>Lingkaran = area deteksi satelit (±375 m). Titik api sebenarnya ada di dalam area ini.</Text>
        <Tombol label="Navigasi ke titik panas" jenis="biasa" onPress={navigasi} style={{ marginTop: 10 }} />

        <View style={s.info}>
          <Info label="Jarak dari desa" nilai={`${angka(t.jarakKm)} km`} />
          <Info label="Intensitas api (FRP)" nilai={`${angka(t.frp)} MW`} />
          <Info label="Terdeteksi satelit" nilai={waktuWIB(t.waktuDeteksiUtc)} />
          <Info label="Tiket dibuat" nilai={waktuWIB(t.dibuatUtc)} />
          <Info label="Koordinat" nilai={`${t.lat?.toFixed(5)}, ${t.lon?.toFixed(5)}`} />
          {t.luasTerbakarHa != null && <Info label="Luas terbakar" nilai={`${angka(t.luasTerbakarHa, 2)} ha`} />}
        </View>

        {(lainnya.length > 0 || bolehEskalasi) && (
          <View style={s.aksi}>
            <Text style={s.judulAksi}>Aksi lain</Text>
            {lainnya.map((a) => (
              <Tombol key={a.label} label={a.label} jenis={a.jenis || 'biasa'} onPress={a.onPress}
                sibuk={a.kunci && sibuk === a.kunci} disabled={!!sibuk} />
            ))}
            {bolehEskalasi && (
              <Tombol label="Minta bantuan BPBD" jenis="biasa" onPress={mintaBantuan}
                sibuk={sibuk === 'eskalasi'} disabled={!!sibuk} style={{ borderColor: warna.bahaya }} />
            )}
          </View>
        )}

        <Text style={s.judulRiwayat}>Riwayat laporan</Text>
        {[...update].reverse().map((u) => <ItemRiwayat key={u.id} u={u} />)}
      </ScrollView>

      {utama && (
        <View style={s.bilahAksi}>
          <Tombol label={utama.label} jenis={utama.jenis || 'utama'} onPress={utama.onPress}
            sibuk={utama.kunci && sibuk === utama.kunci} disabled={!!sibuk} style={{ minHeight: 56 }} />
        </View>
      )}
    </View>
  );
}

function Header({ onKembali, judul, kanan }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onKembali} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kembali">
        <Text style={s.kembali}>‹ Kembali</Text>
      </Pressable>
      <Text style={s.headerJudul}>{judul}</Text>
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>{kanan}</View>
    </View>
  );
}

function Banner({ teks, jenis }) {
  const g = {
    ok: [warna.okBg, warna.ok], bahaya: [warna.bahayaBg, warna.bahaya], info: [warna.infoBg, warna.info],
  }[jenis];
  return (
    <View style={[s.banner, { backgroundColor: g[0] }]}>
      <Text style={[s.bannerTeks, { color: g[1] }]}>{teks}</Text>
    </View>
  );
}

function Info({ label, nilai }) {
  return (
    <View style={s.infoItem}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoNilai}>{nilai}</Text>
    </View>
  );
}

function ItemRiwayat({ u }) {
  const st = statusInfo(u.status);
  const detail = [
    u.ukuranApi && `Api ${u.ukuranApi.toLowerCase()}`,
    u.luasHa != null && `${angka(u.luasHa, 2)} ha`,
    u.arahSebaran && `menyebar ke ${u.arahSebaran.toLowerCase()}`,
  ].filter(Boolean).join(' · ');
  return (
    <View style={s.riwayat}>
      <View style={[s.titik, { backgroundColor: st.warna }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.riwayatWaktu}>{waktuWIB(u.waktuUtc)} · {st.label}</Text>
        <Text style={s.riwayatOleh}>{u.oleh}</Text>
        {!!u.catatan && <Text style={s.riwayatTeks}>{u.catatan}</Text>}
        {!!detail && <Text style={s.riwayatTeks}>{detail}</Text>}
        {!!u.fotoPath && (
          <Image source={{ uri: api.fotoUrl(u.fotoPath), headers: { 'ngrok-skip-browser-warning': 'true' } }}
            style={s.foto} resizeMode="cover" accessibilityLabel="Foto lapangan" />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: warna.gambut,
  },
  kembali: { fontSize: 16, color: warna.teksGelap, fontWeight: '700', minWidth: 70 },
  headerJudul: { fontSize: 16, fontWeight: '700', color: warna.teksGelap },
  headerStatus: { fontSize: 14, fontWeight: '800' },
  judulAksi: { fontSize: 14, fontWeight: '700', color: warna.muted },
  bilahAksi: {
    padding: 12, paddingBottom: 14, backgroundColor: warna.surface,
    borderTopWidth: 1, borderTopColor: warna.border,
  },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTeks: { color: warna.bahaya, textAlign: 'center' },
  isi: { padding: 16, paddingBottom: 40 },
  desa: { fontSize: 21, fontWeight: '800', color: warna.text, marginBottom: 10 },
  banner: { borderRadius: 10, padding: 12, marginBottom: 10 },
  bannerTeks: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  petaWrap: { height: 230, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: warna.border },
  peta: { flex: 1 },
  catatanPeta: { fontSize: 12, color: warna.muted, marginTop: 6 },
  tombolPeta: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(20,32,25,0.88)',
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
  },
  tombolPetaTeks: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  atribusi: {
    position: 'absolute', right: 6, bottom: 4, fontSize: 10, color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 4, borderRadius: 3,
  },
  info: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, backgroundColor: warna.surface,
    borderRadius: 12, borderWidth: 1, borderColor: warna.border, padding: 6,
  },
  infoItem: { width: '50%', padding: 8 },
  infoLabel: { fontSize: 12, color: warna.muted },
  infoNilai: { fontSize: 15, fontWeight: '700', color: warna.text, marginTop: 2 },
  aksi: { gap: 10, marginTop: 16 },
  judulRiwayat: { fontSize: 16, fontWeight: '800', color: warna.text, marginTop: 24, marginBottom: 10 },
  riwayat: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  titik: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  riwayatWaktu: { fontSize: 12, color: warna.muted },
  riwayatOleh: { fontSize: 15, fontWeight: '700', color: warna.text },
  riwayatTeks: { fontSize: 14, color: warna.text, marginTop: 2, lineHeight: 20 },
  foto: { width: '100%', height: 180, borderRadius: 10, marginTop: 8, backgroundColor: warna.surface2 },
});
