import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SLA_MENIT } from './config';
import { statusInfo, warna } from './theme';

// 1550 menit lebih mudah dibaca sebagai "25 jam"
function lamanya(menit) {
  const m = Math.floor(menit);
  if (m < 60) return `${m} mnt`;
  const jam = Math.floor(m / 60);
  if (jam < 48) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}

/** Bilah hitung mundur batas respons untuk tiket Baru */
export function JamSla({ dibuatUtc }) {
  const m = Math.max(0, (Date.now() - new Date(dibuatUtc).getTime()) / 60000);
  const persen = Math.min(100, (m / SLA_MENIT) * 100);
  const kritis = m >= SLA_MENIT * 0.66;
  const teks = m >= SLA_MENIT
    ? `${lamanya(m)} tanpa respons. BPBD sudah diberi tahu.`
    : `Terima dalam ${Math.ceil(SLA_MENIT - m)} mnt, setelah itu BPBD diberi tahu.`;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={s.slaBar}>
        <View style={[s.slaIsi, { width: `${persen}%`, backgroundColor: kritis ? warna.bahaya : '#D98A12' }]} />
      </View>
      <Text style={[s.slaTeks, kritis && { color: warna.bahaya, fontWeight: '700' }]}>{teks}</Text>
    </View>
  );
}

const LANGKAH = [
  ['Baru', 'Baru'], ['MenujuLokasi', 'Menuju'], ['Dicek', 'Dicek'],
  ['Penanganan', 'Ditangani'], ['Pemantauan', 'Dipantau'], ['Selesai', 'Selesai'],
];

/** Progres penanganan tiket, dari Baru sampai Selesai */
export function Progres({ status }) {
  if (status === 'AlarmPalsu') return null;
  const kini = status === 'Padam' ? 'Pemantauan' : status;
  const idx = LANGKAH.findIndex(([k]) => k === kini);
  return (
    <View style={s.progres} accessibilityLabel={`Langkah ${idx + 1} dari ${LANGKAH.length}: ${statusInfo(kini).label}`}>
      {LANGKAH.map(([k, label], i) => (
        <View key={k} style={{ flex: 1 }}>
          <View style={[s.progresGaris, i < idx && { backgroundColor: warna.text }, i === idx && { backgroundColor: warna.accent }]} />
          <Text style={[s.progresLabel, i === idx && { color: warna.text, fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Tombol({ label, onPress, jenis = 'utama', disabled, sibuk, style }) {
  const gaya = {
    utama: { bg: warna.accent, fg: '#fff', border: warna.accent },
    bahaya: { bg: warna.bahaya, fg: '#fff', border: warna.bahaya },
    biasa: { bg: warna.surface, fg: warna.text, border: warna.border },
  }[jenis];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || sibuk}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.tombol,
        { backgroundColor: gaya.bg, borderColor: gaya.border },
        (disabled || sibuk) && { opacity: 0.55 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {sibuk ? <ActivityIndicator color={gaya.fg} /> : <Text style={[s.tombolTeks, { color: gaya.fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function BadgeStatus({ status }) {
  const st = statusInfo(status);
  return (
    <View style={[s.badge, { backgroundColor: st.warna }]}>
      <Text style={s.badgeTeks}>{st.label}</Text>
    </View>
  );
}

export function Flag({ teks, jenis = 'biasa' }) {
  const g = {
    merah: { bg: warna.bahayaBg, fg: warna.bahaya },
    hijau: { bg: warna.okBg, fg: warna.ok },
    biru: { bg: warna.infoBg, fg: warna.info },
    biasa: { bg: warna.surface2, fg: warna.muted },
  }[jenis];
  return (
    <View style={[s.flag, { backgroundColor: g.bg }]}>
      <Text style={[s.flagTeks, { color: g.fg }]}>{teks}</Text>
    </View>
  );
}

export function Pilihan({ opsi, nilai, onPilih }) {
  return (
    <View style={s.pilihanWrap}>
      {opsi.map((o) => {
        const aktif = o === nilai;
        return (
          <Pressable
            key={o}
            onPress={() => onPilih(aktif ? null : o)}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            style={[s.chip, aktif && s.chipAktif]}
          >
            <Text style={[s.chipTeks, aktif && s.chipTeksAktif]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  slaBar: { height: 6, borderRadius: 99, backgroundColor: '#EDE3DD', overflow: 'hidden' },
  slaIsi: { height: '100%', borderRadius: 99 },
  slaTeks: { fontSize: 13, color: warna.muted, marginTop: 5 },
  progres: { flexDirection: 'row', gap: 3 },
  progresGaris: { height: 5, borderRadius: 99, backgroundColor: warna.border },
  progresLabel: { fontSize: 11, color: warna.muted, marginTop: 4 },
  tombol: {
    minHeight: 50, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  tombolTeks: { fontSize: 16, fontWeight: '700' },
  badge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTeks: { color: '#fff', fontSize: 12, fontWeight: '700' },
  flag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  flagTeks: { fontSize: 12, fontWeight: '600' },
  pilihanWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: warna.border, backgroundColor: warna.surface,
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9,
  },
  chipAktif: { backgroundColor: warna.accent, borderColor: warna.accent },
  chipTeks: { fontSize: 14, color: warna.text },
  chipTeksAktif: { color: '#fff', fontWeight: '700' },
});
