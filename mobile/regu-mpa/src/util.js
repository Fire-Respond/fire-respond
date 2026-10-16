import * as Location from 'expo-location';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dua = (n) => String(n).padStart(2, '0');

/** Waktu UTC dari server -> teks WIB, contoh "15 Okt, 09.20 WIB" */
export function waktuWIB(iso) {
  if (!iso) return '–';
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}, ${dua(d.getUTCHours())}.${dua(d.getUTCMinutes())} WIB`;
}

export function sejak(iso) {
  if (!iso) return '';
  const menit = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

/** Angka format Indonesia: 4.2 -> "4,2" */
export function angka(v, desimal = 1) {
  if (v == null || Number.isNaN(Number(v))) return '–';
  return String(Number(Number(v).toFixed(desimal))).replace('.', ',');
}

export function jarakKm(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ambil lokasi GPS sekarang. Mengembalikan { lat, lon, akurasi } atau null kalau gagal. */
export async function ambilLokasi() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const habisWaktu = new Promise((resolve) => setTimeout(() => resolve(null), 12000));
    const posisi = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      habisWaktu,
    ]);
    const p = posisi || (await Location.getLastKnownPositionAsync());
    if (!p) return null;
    return { lat: p.coords.latitude, lon: p.coords.longitude, akurasi: p.coords.accuracy };
  } catch {
    return null;
  }
}
