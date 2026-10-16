import { useEffect, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../api';
import { warna } from '../theme';
import { Pilihan, Tombol } from '../ui';
import { ambilLokasi, angka, jarakKm } from '../util';

const UKURAN = ['Kecil', 'Sedang', 'Besar'];
const ARAH = ['Utara', 'Timur laut', 'Timur', 'Tenggara', 'Selatan', 'Barat daya', 'Barat', 'Barat laut'];

/** Isi form untuk tiap status tujuan. Aturan wajib foto sama dengan backend. */
function konfigurasi(statusLama, statusBaru) {
  switch (statusBaru) {
    case 'Penanganan': {
      const lanjutan = statusLama === 'Penanganan';
      return {
        judul: lanjutan ? 'Update kondisi api'
          : statusLama === 'Pemantauan' ? 'Laporkan api muncul lagi' : 'Konfirmasi api ditemukan',
        petunjuk: lanjutan
          ? 'Kirim update berkala, misalnya tiap 30 menit, supaya BPBD bisa memantau dari kantor.'
          : 'Foto api dari dekat. Lokasi GPS ikut terkirim sebagai bukti laporan.',
        foto: lanjutan ? 'opsional' : 'wajib', ukuran: true, luas: true, arah: true,
        tombol: lanjutan ? 'Kirim update' : 'Konfirmasi api',
      };
    }
    case 'AlarmPalsu':
      return {
        judul: 'Laporkan bukan api',
        petunjuk: 'Foto kondisi lokasi, misalnya bekas pembakaran sampah kecil atau atap seng yang panas. Tiket akan ditutup.',
        foto: 'wajib', tombol: 'Tutup sebagai alarm palsu',
      };
    case 'Padam':
      return {
        judul: 'Laporkan api padam',
        petunjuk: 'Isi perkiraan total luas yang terbakar. Tiket masuk masa pemantauan 24 jam karena api gambut bisa menyala lagi.',
        foto: 'wajib', luas: true, tombol: 'Api sudah padam',
      };
    case 'Pemantauan':
      return {
        judul: 'Laporan cek ulang',
        petunjuk: 'Laporkan bahwa lokasi sudah dicek dan tidak ada api atau asap.',
        foto: 'opsional', tombol: 'Kirim laporan cek ulang',
      };
    case 'Selesai':
      return {
        judul: 'Tutup tiket',
        petunjuk: 'Tutup tiket kalau lokasi sudah benar-benar aman. Tiket juga tertutup otomatis setelah 24 jam pemantauan.',
        foto: 'opsional', tombol: 'Tutup tiket',
      };
    default:
      return { judul: 'Update tiket', foto: 'opsional', tombol: 'Kirim' };
  }
}

export default function UpdateFormScreen({ tiket, status, onKembali, onTerkirim }) {
  const k = konfigurasi(tiket.status, status);
  const [foto, setFoto] = useState(null);
  const [lokasi, setLokasi] = useState(undefined);   // undefined = sedang diambil, null = gagal
  const [ukuran, setUkuran] = useState(null);
  const [arah, setArah] = useState(null);
  const [luas, setLuas] = useState(tiket.luasTerbakarHa != null ? String(tiket.luasTerbakarHa).replace('.', ',') : '');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState({});
  const [sibuk, setSibuk] = useState(false);

  const perbaruiLokasi = async () => {
    setLokasi(undefined);
    setLokasi(await ambilLokasi());
  };
  useEffect(() => { perbaruiLokasi(); }, []);

  async function ambilFoto() {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) {
      setError((e) => ({ ...e, foto: 'Izin kamera ditolak. Aktifkan di pengaturan ponsel.' }));
      return;
    }
    const hasil = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!hasil.canceled && hasil.assets?.[0]) {
      setFoto(hasil.assets[0]);
      setError((e) => ({ ...e, foto: null }));
      perbaruiLokasi();   // lokasi diambil ulang saat foto diambil
    }
  }

  async function kirim() {
    const err = {};
    if (k.foto === 'wajib' && !foto) err.foto = 'Foto wajib dilampirkan untuk laporan ini.';
    let luasAngka = null;
    if (k.luas && luas.trim()) {
      luasAngka = Number(luas.trim().replace(',', '.'));
      if (Number.isNaN(luasAngka) || luasAngka < 0) err.luas = 'Isi luas dalam angka, contoh 1,5';
    }
    if (status === 'Padam' && !luas.trim()) err.luas = 'Isi perkiraan luas yang terbakar.';
    setError(err);
    if (Object.keys(err).length) return;

    setSibuk(true);
    try {
      await api.kirimUpdate(tiket.id, {
        status, foto, lat: lokasi?.lat, lon: lokasi?.lon, luasHa: luasAngka,
        ukuranApi: ukuran, arahSebaran: arah, catatan: catatan.trim(),
      });
      onTerkirim();
    } catch (e) {
      setError({ kirim: e.message });
    } finally {
      setSibuk(false);
    }
  }

  const jarakKeTitik = lokasi ? jarakKm(lokasi.lat, lokasi.lon, tiket.lat, tiket.lon) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable onPress={onKembali} hitSlop={12} accessibilityRole="button" accessibilityLabel="Batal">
          <Text style={s.batal}>Batal</Text>
        </Pressable>
        <Text style={s.headerJudul}>Tiket #{tiket.id}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={s.isi} keyboardShouldPersistTaps="handled">
        <Text style={s.judul}>{k.judul}</Text>
        {!!k.petunjuk && <Text style={s.petunjuk}>{k.petunjuk}</Text>}

        <Bagian label={`Foto lapangan (${k.foto})`} error={error.foto}>
          {foto ? (
            <View>
              <Image source={{ uri: foto.uri }} style={s.foto} />
              <Tombol label="Ambil ulang foto" jenis="biasa" onPress={ambilFoto} style={{ marginTop: 8 }} />
            </View>
          ) : (
            <Tombol label="Buka kamera" jenis="biasa" onPress={ambilFoto} />
          )}
        </Bagian>

        <Bagian label="Lokasi GPS">
          <Text style={s.lokasi}>
            {lokasi === undefined ? 'Mengambil lokasi…'
              : lokasi === null ? 'Lokasi tidak tersedia. Aktifkan GPS, lalu ketuk "Ambil ulang".'
                : `${lokasi.lat.toFixed(5)}, ${lokasi.lon.toFixed(5)} · ${angka(jarakKeTitik, 2)} km dari titik panas`}
          </Text>
          {lokasi !== undefined && (
            <Pressable onPress={perbaruiLokasi} accessibilityRole="button">
              <Text style={s.link}>Ambil ulang lokasi</Text>
            </Pressable>
          )}
        </Bagian>

        {k.ukuran && (
          <Bagian label="Ukuran api">
            <Pilihan opsi={UKURAN} nilai={ukuran} onPilih={setUkuran} />
          </Bagian>
        )}
        {k.luas && (
          <Bagian label={status === 'Padam' ? 'Total luas terbakar (hektare)' : 'Perkiraan luas terbakar (hektare)'} error={error.luas}>
            <TextInput
              style={s.input} value={luas} onChangeText={(v) => { setLuas(v); setError((e) => ({ ...e, luas: null })); }}
              keyboardType="decimal-pad" placeholder="contoh: 1,5" placeholderTextColor={warna.muted}
            />
          </Bagian>
        )}
        {k.arah && (
          <Bagian label="Arah sebaran api">
            <Pilihan opsi={ARAH} nilai={arah} onPilih={setArah} />
          </Bagian>
        )}

        <Bagian label="Catatan (opsional)">
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={catatan} onChangeText={setCatatan}
            multiline placeholder="Contoh: api di lahan gambut, akses lewat jalan kebun sawit"
            placeholderTextColor={warna.muted}
          />
        </Bagian>

      </ScrollView>
      <View style={s.bilahAksi}>
        {!!error.kirim && <Text style={[s.error, { marginTop: 0, marginBottom: 8 }]}>{error.kirim}</Text>}
        {Object.keys(error).some((key) => key !== 'kirim' && error[key]) && (
          <Text style={[s.error, { marginTop: 0, marginBottom: 8 }]}>Lengkapi isian yang ditandai merah di atas.</Text>
        )}
        <Tombol label={k.tombol} onPress={kirim} sibuk={sibuk} style={{ minHeight: 56 }}
          jenis={status === 'Penanganan' && tiket.status !== 'Penanganan' ? 'bahaya' : 'utama'} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bagian({ label, error, children }) {
  return (
    <View style={s.bagian}>
      <Text style={s.label}>{label}</Text>
      {children}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: warna.gambut,
  },
  batal: { fontSize: 16, color: warna.teksGelap, fontWeight: '600', width: 50 },
  headerJudul: { fontSize: 16, fontWeight: '700', color: warna.teksGelap },
  bilahAksi: {
    padding: 12, paddingBottom: 14, backgroundColor: warna.surface,
    borderTopWidth: 1, borderTopColor: warna.border,
  },
  isi: { padding: 16, paddingBottom: 24 },
  judul: { fontSize: 21, fontWeight: '800', color: warna.text },
  petunjuk: { fontSize: 14, color: warna.muted, marginTop: 6, lineHeight: 20 },
  bagian: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: '700', color: warna.muted, marginBottom: 8 },
  foto: { width: '100%', height: 220, borderRadius: 12, backgroundColor: warna.surface2 },
  lokasi: { fontSize: 14, color: warna.text },
  link: { color: warna.info, fontWeight: '600', marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: warna.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 16, color: warna.text, backgroundColor: warna.surface,
  },
  error: { color: warna.bahaya, fontSize: 14, marginTop: 6 },
});
