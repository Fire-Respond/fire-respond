import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { statusInfo, warna } from '../theme';
import { Flag, JamSla } from '../ui';
import { angka, sejak, waktuWIB } from '../util';

function urut(a, b) {
  const skor = (t) => (t.status === 'Baru' ? 0 : t.status === 'Penanganan' ? 1 : 2);
  return skor(a) - skor(b) || new Date(a.dibuatUtc) - new Date(b.dibuatUtc);
}

function ItemTiket({ t, onPress }) {
  const st = statusInfo(t.status);
  const baru = t.status === 'Baru';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tiket ${t.id}, ${t.desa}, ${st.label}`}
      style={({ pressed }) => [s.item, baru && s.itemBaru, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.strip, { backgroundColor: st.warna }]} />
      <View style={s.itemIsi}>
        <View style={s.baris}>
          <Text style={s.desa} numberOfLines={2}>{t.desa}</Text>
          <Text style={[s.status, { color: st.warna }]}>{st.label}</Text>
        </View>
        <Text style={s.meta}>
          {angka(t.jarakKm)} km dari desa, terdeteksi {waktuWIB(t.waktuDeteksiUtc)}
        </Text>
        <Text style={s.metaKecil}>Tiket #{t.id}, dibuat {sejak(t.dibuatUtc)}</Text>
        {baru && <JamSla dibuatUtc={t.dibuatUtc} />}
        {(t.dieskalasi || t.bantuanDikirim || t.jumlahDibukaUlang > 0 || t.status === 'Pemantauan') && (
          <View style={s.flags}>
            {t.dieskalasi && !t.bantuanDikirim && !baru && <Flag teks="Bantuan BPBD diminta" jenis="merah" />}
            {t.bantuanDikirim && <Flag teks="Bantuan BPBD menuju lokasi" jenis="hijau" />}
            {t.jumlahDibukaUlang > 0 && <Flag teks={`Api muncul lagi ${t.jumlahDibukaUlang}×`} jenis="merah" />}
            {t.status === 'Pemantauan' && <Flag teks="Cek ulang lokasi" jenis="biru" />}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function TiketListScreen({ sesi, tiket, memuat, error, onRefresh, onBuka, onKeluar }) {
  const jumlahBaru = tiket.filter((t) => t.status === 'Baru').length;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <View style={s.logoBadge}>
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.regu}>{sesi.reguNama || 'Regu MPA'}</Text>
          <Text style={s.nama}>{sesi.nama}</Text>
        </View>
        <Pressable onPress={onKeluar} accessibilityRole="button" hitSlop={10} style={s.keluarWrap}>
          <Text style={s.keluar}>Keluar</Text>
        </Pressable>
      </View>

      {jumlahBaru > 0 && (
        <View style={s.alert} accessibilityLiveRegion="polite">
          <Text style={s.alertJudul}>
            {jumlahBaru === 1 ? '1 titik panas baru' : `${jumlahBaru} titik panas baru`} di wilayah regu
          </Text>
          <Text style={s.alertTeks}>Buka tiket, tekan “Terima & berangkat”, lalu cek lokasinya.</Text>
        </View>
      )}
      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorTeks}>{error}</Text>
        </View>
      )}

      <FlatList
        data={[...tiket].sort(urut)}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => <ItemTiket t={item} onPress={() => onBuka(item.id)} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={memuat} onRefresh={onRefresh} colors={[warna.accent]} />}
        ListHeaderComponent={<Text style={s.judulList}>Tiket aktif ({tiket.length})</Text>}
        ListEmptyComponent={!memuat && (
          <View style={s.kosong}>
            <View style={s.kosongIkon} />
            <Text style={s.kosongJudul}>Wilayah aman, belum ada titik panas</Text>
            <Text style={s.kosongTeks}>
              Biarkan aplikasi tetap terbuka. Ponsel akan berbunyi saat satelit mendeteksi titik panas di wilayah regu.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: warna.gambut,
  },
  // Logo di kotak putih supaya petir navy tetap terlihat di header gelap
  logoBadge: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 28, height: 28 },
  regu: { fontSize: 18, fontWeight: '800', color: warna.teksGelap },
  nama: { fontSize: 13, color: warna.redupGelap },
  keluarWrap: { borderWidth: 1, borderColor: '#3A4D42', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  keluar: { color: warna.teksGelap, fontSize: 14, fontWeight: '600' },
  alert: { backgroundColor: warna.accent, paddingHorizontal: 16, paddingVertical: 12 },
  alertJudul: { color: '#fff', fontWeight: '800', fontSize: 16 },
  alertTeks: { color: '#FFE7DA', fontSize: 14, marginTop: 2 },
  errorBox: { backgroundColor: warna.bahayaBg, paddingHorizontal: 16, paddingVertical: 10 },
  errorTeks: { color: warna.bahaya, fontSize: 14 },
  list: { padding: 12, gap: 10, flexGrow: 1 },
  judulList: { fontSize: 14, fontWeight: '700', color: warna.muted, marginBottom: 2, marginLeft: 2 },
  item: {
    flexDirection: 'row', backgroundColor: warna.surface, borderRadius: 12,
    borderWidth: 1, borderColor: warna.border, overflow: 'hidden',
  },
  itemBaru: { borderColor: '#F2B49A' },
  strip: { width: 5 },
  itemIsi: { flex: 1, padding: 14 },
  baris: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  desa: { fontSize: 17, fontWeight: '800', color: warna.text, flex: 1 },
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 14, color: warna.text, marginTop: 4 },
  metaKecil: { fontSize: 13, color: warna.muted, marginTop: 2 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  kosong: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 28 },
  kosongIkon: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: warna.ok, marginBottom: 16,
    backgroundColor: warna.okBg,
  },
  kosongJudul: { fontSize: 17, fontWeight: '800', color: warna.text, textAlign: 'center' },
  kosongTeks: { fontSize: 14, color: warna.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
