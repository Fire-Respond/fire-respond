import { Platform, Vibration } from 'react-native';

// Notifikasi lokal: dipicu aplikasi sendiri saat polling menemukan tiket baru.
//
// expo-notifications dimuat dengan require di dalam try/catch, BUKAN import biasa.
// Di Expo Go (Android), sebagian modul native-nya (misalnya ExpoTopicSubscriptionModule)
// tidak tersedia, dan import biasa membuat aplikasi crash saat dibuka.
// Kalau modul tidak bisa dimuat, aplikasi tetap jalan: alert memakai getar + banner di layar.

let Notifications = null;
try {
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const CHANNEL = 'alert-titik-panas';
let diizinkan = false;

export async function siapkanNotifikasi() {
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Alert titik panas',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    diizinkan = status === 'granted';
  } catch {
    diizinkan = false;
  }
}

export async function kirimNotifikasi(judul, isi, data = {}) {
  Vibration.vibrate([0, 400, 200, 400]);
  if (!Notifications || !diizinkan) return;
  const content = { title: judul, body: isi, data, sound: 'default' };
  try {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
  } catch {
    try { await Notifications.scheduleNotificationAsync({ content, trigger: null }); } catch { /* abaikan */ }
  }
}

/** Panggil cb(tiketId) saat pengguna mengetuk notifikasi */
export function dengarKetukan(cb) {
  if (!Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r?.notification?.request?.content?.data?.tiketId;
      if (id) cb(Number(id));
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
