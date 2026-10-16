import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import { warna } from '../theme';
import { IkonMata, Tombol } from '../ui';

export default function LoginScreen({ onMasuk }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState(api.urlServer());
  const [lihatServer, setLihatServer] = useState(false);
  const [lihatPw, setLihatPw] = useState(false);
  const [error, setError] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  async function masuk() {
    if (!username.trim() || !password) {
      setError('Isi username dan password dulu.');
      return;
    }
    if (!/^https?:\/\/\S+$/.test(url.trim())) {
      setError('URL server tidak valid. Contoh: https://abcd.ngrok-free.app');
      setLihatServer(true);
      return;
    }
    setSibuk(true);
    setError(null);
    try {
      onMasuk(await api.login(username.trim(), password, url));
    } catch (e) {
      setError(e.message);
    } finally {
      setSibuk(false);
    }
  }

  const ubah = (fn) => (v) => { fn(v); setError(null); };

  return (
    // Android SDK 57 memakai layout edge-to-edge, jadi layar tidak menyusut sendiri saat keyboard muncul.
    // KeyboardAvoidingView 'padding' mendorong isi ke atas, ScrollView membuatnya bisa digulir naik turun.
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: warna.gambut }} behavior="padding">
      <ScrollView
        contentContainerStyle={s.wrap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={s.logoBadge}>
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityLabel="Logo Fire Respond" />
        </View>
        <Text style={s.judul}>Fire Respond</Text>
        <Text style={s.sub}>Aplikasi regu Masyarakat Peduli Api. Terima alert titik panas dan laporkan kondisi lapangan.</Text>

        <View style={s.kartu}>
          <Text style={s.label}>Username regu</Text>
          <TextInput
            style={s.input} value={username} onChangeText={ubah(setUsername)}
            autoCapitalize="none" autoCorrect={false} placeholder="contoh: regu_a"
            placeholderTextColor={warna.muted}
          />
          <Text style={s.label}>Password</Text>
          <View style={s.pwWrap}>
            <TextInput
              style={[s.input, s.pwInput]} value={password} onChangeText={ubah(setPassword)}
              secureTextEntry={!lihatPw} placeholder="••••••••" placeholderTextColor={warna.muted}
              autoCapitalize="none" autoCorrect={false} onSubmitEditing={masuk}
            />
            <Pressable
              onPress={() => setLihatPw((v) => !v)}
              style={s.pwToggle}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={lihatPw ? 'Sembunyikan password' : 'Lihat password'}
            >
              <IkonMata coret={lihatPw} />
            </Pressable>
          </View>

          <Pressable onPress={() => setLihatServer((v) => !v)} accessibilityRole="button">
            <Text style={s.linkServer}>{lihatServer ? 'Sembunyikan pengaturan server' : 'Pengaturan server'}</Text>
          </Pressable>
          {lihatServer && (
            <>
              <Text style={s.label}>URL server</Text>
              <TextInput
                style={s.input} value={url} onChangeText={ubah(setUrl)} autoCapitalize="none"
                autoCorrect={false} keyboardType="url" placeholder="https://abcd.ngrok-free.app"
                placeholderTextColor={warna.muted}
              />
            </>
          )}

          {error && <Text style={s.error}>{error}</Text>}
          <Tombol label="Masuk" onPress={masuk} sibuk={sibuk} style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: warna.gambut },
  logoBadge: {
    width: 88, height: 88, borderRadius: 22, backgroundColor: '#FFFFFF', alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  logo: { width: 66, height: 66 },
  judul: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: warna.teksGelap },
  sub: { fontSize: 15, textAlign: 'center', color: warna.redupGelap, marginTop: 6, marginBottom: 24, lineHeight: 21 },
  kartu: { backgroundColor: warna.surface, borderRadius: 14, padding: 18 },
  label: { fontSize: 13, fontWeight: '700', color: warna.muted, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: warna.border, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 11, fontSize: 16, color: warna.text, backgroundColor: warna.surface2,
  },
  pwWrap: { justifyContent: 'center' },
  pwInput: { paddingRight: 52 },
  pwToggle: { position: 'absolute', right: 4, padding: 10 },
  linkServer: { color: warna.info, fontSize: 14, marginTop: 14, fontWeight: '600' },
  error: { color: warna.bahaya, fontSize: 14, marginTop: 12 },
});
