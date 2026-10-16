import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import * as api from './src/api';
import { POLLING_MS } from './src/config';
import { dengarKetukan, kirimNotifikasi, siapkanNotifikasi } from './src/notif';
import { warna } from './src/theme';
import { angka } from './src/util';
import LoginScreen from './src/screens/LoginScreen';
import TiketListScreen from './src/screens/TiketListScreen';
import TiketDetailScreen from './src/screens/TiketDetailScreen';
import UpdateFormScreen from './src/screens/UpdateFormScreen';

export default function App() {
  const [sesi, setSesi] = useState(undefined);        // undefined = memuat, null = belum login
  const [layar, setLayar] = useState([{ nama: 'daftar' }]);
  const [tiket, setTiket] = useState([]);
  const [memuat, setMemuat] = useState(false);
  const [error, setError] = useState(null);
  const [versi, setVersi] = useState(0);               // naik setiap habis kirim update, memicu muat ulang detail
  const dikenal = useRef(null);                        // tiket dari polling sebelumnya, untuk deteksi perubahan

  const buka = (l) => setLayar((s) => [...s, l]);
  const kembali = () => setLayar((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const keluar = useCallback(async () => {
    await api.keluar();
    dikenal.current = null;
    setTiket([]);
    setLayar([{ nama: 'daftar' }]);
    setSesi(null);
  }, []);

  // ---------- Mulai ----------
  useEffect(() => {
    api.daftarkanSesiHabis(() => {
      Alert.alert('Sesi habis', 'Silakan masuk lagi.');
      keluar();
    });
    api.muatSesi().then(setSesi);
    siapkanNotifikasi();
    return dengarKetukan((id) => setLayar([{ nama: 'daftar' }, { nama: 'detail', id }]));
  }, [keluar]);

  // ---------- Polling tiket + notifikasi ----------
  const muatTiket = useCallback(async (manual = false) => {
    if (manual) setMemuat(true);
    try {
      const data = await api.daftarTiket();
      const lama = dikenal.current;
      if (lama) {
        data.forEach((t) => {
          const sebelum = lama.get(t.id);
          if (!sebelum && t.status === 'Baru') {
            kirimNotifikasi('Titik panas baru terdeteksi',
              `${t.desa} · ${angka(t.jarakKm)} km dari desa. Segera cek lokasi.`, { tiketId: t.id });
          } else if (sebelum && !sebelum.bantuanDikirim && t.bantuanDikirim) {
            kirimNotifikasi('Bantuan BPBD dikirim',
              `Tiket #${t.id} · ${t.desa}: bantuan sedang menuju lokasi.`, { tiketId: t.id });
          } else if (sebelum && sebelum.status === 'Pemantauan' && t.status === 'Penanganan') {
            kirimNotifikasi('Api muncul lagi',
              `Satelit mendeteksi titik panas baru di lokasi tiket #${t.id}. Segera cek ulang.`, { tiketId: t.id });
          }
        });
      }
      dikenal.current = new Map(data.map((t) => [t.id, t]));
      setTiket(data);
      setError(null);
    } catch (e) {
      if (e.code !== 401) setError(e.message);
    } finally {
      if (manual) setMemuat(false);
    }
  }, []);

  useEffect(() => {
    if (!sesi) return undefined;
    muatTiket(true);
    const timer = setInterval(() => muatTiket(false), POLLING_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') muatTiket(false); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [sesi, muatTiket]);

  // ---------- Tombol kembali Android ----------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (layar.length > 1) { kembali(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [layar.length]);

  // ---------- Render ----------
  let isi;
  if (sesi === undefined) {
    isi = <View style={s.tengah}><ActivityIndicator size="large" color={warna.accent} /></View>;
  } else if (!sesi) {
    isi = <LoginScreen onMasuk={setSesi} />;
  } else {
    const atas = layar[layar.length - 1];
    if (atas.nama === 'detail') {
      isi = (
        <TiketDetailScreen
          key={atas.id} id={atas.id} versi={versi} onKembali={kembali}
          onBerubah={() => muatTiket(false)}
          onForm={(t, status) => buka({ nama: 'form', tiket: t, status })}
        />
      );
    } else if (atas.nama === 'form') {
      isi = (
        <UpdateFormScreen
          tiket={atas.tiket} status={atas.status} onKembali={kembali}
          onTerkirim={() => {
            kembali();
            setVersi((v) => v + 1);
            muatTiket(false);
            Alert.alert('Laporan terkirim', 'BPBD langsung melihat update ini di dashboard.');
          }}
        />
      );
    } else {
      isi = (
        <TiketListScreen
          sesi={sesi} tiket={tiket} memuat={memuat} error={error}
          onRefresh={() => muatTiket(true)}
          onBuka={(id) => buka({ nama: 'detail', id })}
          onKeluar={() => Alert.alert('Keluar?', 'Anda tidak akan menerima alert titik panas setelah keluar.', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Keluar', style: 'destructive', onPress: keluar },
          ])}
        />
      );
    }
  }

  return (
    <SafeAreaProvider>
      {/* Area status bar ikut warna header gelap */}
      <SafeAreaView style={s.root} edges={['top']}>
        <StatusBar style="light" />
        <SafeAreaView style={[s.isi, !sesi && { backgroundColor: warna.gambut }]} edges={['bottom']}>
          {isi}
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: warna.gambut },
  isi: { flex: 1, backgroundColor: warna.bg },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
