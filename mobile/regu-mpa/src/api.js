import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from './config';

const KUNCI_SESI = 'fr_sesi';
const KUNCI_URL = 'fr_url';

let baseUrl = DEFAULT_API_URL;
let token = null;
let saatSesiHabis = () => {};

const rapikanUrl = (url) => (url || '').trim().replace(/\/+$/, '');

export const urlServer = () => baseUrl;
export const fotoUrl = (path) => (path ? baseUrl + path : null);
export const daftarkanSesiHabis = (fn) => { saatSesiHabis = fn; };

async function request(path, { method = 'GET', json, body, abaikan401 = false } = {}) {
  const headers = {
    Accept: 'application/json',
    // Supaya ngrok versi gratis tidak membalas dengan halaman peringatan HTML
    'ngrok-skip-browser-warning': 'true',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), 30000);
  let res;
  try {
    res = await fetch(baseUrl + path, { method, headers, body, signal: kontrol.signal });
  } catch (e) {
    throw new Error(e?.name === 'AbortError'
      ? 'Server tidak merespons. Cek sinyal atau URL server.'
      : 'Tidak bisa terhubung ke server. Cek sinyal internet dan URL server.');
  } finally {
    clearTimeout(timer);
  }

  const teks = await res.text();
  let data = null;
  try { data = teks ? JSON.parse(teks) : null; } catch { /* bukan JSON, misalnya halaman error ngrok */ }

  if (res.status === 401 && !abaikan401) {
    saatSesiHabis();
    const err = new Error('Sesi habis, silakan masuk lagi.');
    err.code = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(data?.pesan
      || (res.status === 403 ? 'Tiket ini bukan milik regu Anda.'
        : res.status >= 500 ? 'Server sedang bermasalah. Coba lagi sebentar.'
          : `Permintaan gagal (HTTP ${res.status}).`));
  }
  return data;
}

// ---------- Sesi ----------
export async function muatSesi() {
  try {
    const url = await AsyncStorage.getItem(KUNCI_URL);
    if (url) baseUrl = url;
    const raw = await AsyncStorage.getItem(KUNCI_SESI);
    if (!raw) return null;
    const sesi = JSON.parse(raw);
    token = sesi.token;
    return sesi;
  } catch {
    return null;
  }
}

export async function login(username, password, url) {
  baseUrl = rapikanUrl(url) || DEFAULT_API_URL;
  const data = await request('/api/auth/login', {
    method: 'POST', json: { username, password }, abaikan401: true,
  });
  if (data.role !== 'Regu') {
    throw new Error('Akun ini akun admin. Admin BPBD memakai dashboard web, bukan aplikasi regu.');
  }
  token = data.token;
  const sesi = { token: data.token, nama: data.nama, reguNama: data.reguNama };
  try {
    await AsyncStorage.setItem(KUNCI_URL, baseUrl);
    await AsyncStorage.setItem(KUNCI_SESI, JSON.stringify(sesi));
  } catch { /* tetap lanjut walau gagal simpan */ }
  return sesi;
}

export async function keluar() {
  token = null;
  try { await AsyncStorage.removeItem(KUNCI_SESI); } catch { /* abaikan */ }
}

// ---------- Tiket ----------
export const daftarTiket = () => request('/api/tiket');
export const detailTiket = (id) => request(`/api/tiket/${id}`);
export const terimaTiket = (id) => request(`/api/tiket/${id}/terima`, { method: 'POST' });
export const eskalasi = (id, catatan) =>
  request(`/api/tiket/${id}/eskalasi`, { method: 'POST', json: { catatan } });

/** Kirim update lapangan (multipart): status, foto, GPS, luas, ukuran api, arah, catatan */
export function kirimUpdate(id, f) {
  const fd = new FormData();
  fd.append('Status', f.status);
  if (f.foto) {
    fd.append('Foto', {
      uri: f.foto.uri,
      name: f.foto.fileName || `foto-${Date.now()}.jpg`,
      type: f.foto.mimeType || 'image/jpeg',
    });
  }
  const tambah = (k, v) => { if (v != null && v !== '') fd.append(k, String(v)); };
  tambah('Lat', f.lat);
  tambah('Lon', f.lon);
  tambah('LuasHa', f.luasHa);
  tambah('UkuranApi', f.ukuranApi);
  tambah('ArahSebaran', f.arahSebaran);
  tambah('Catatan', f.catatan);
  return kirimMultipart(`/api/tiket/${id}/update`, fd);
}

/**
 * Upload multipart lewat XMLHttpRequest, bukan fetch.
 * fetch bawaan Expo versi baru tidak bisa mengirim file dalam bentuk { uri, name, type }
 * dan langsung gagal sebelum sampai ke server ("Tidak bisa terhubung ke server").
 * XMLHttpRequest milik React Native mendukung bentuk itu sejak lama.
 */
function kirimMultipart(path, fd) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', baseUrl + path);
    xhr.timeout = 60000; // foto bisa beberapa MB, beri waktu lebih lama
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Content-Type multipart (dengan boundary) diisi otomatis, jangan diset manual

    xhr.onload = () => {
      let data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* bukan JSON */ }
      if (xhr.status === 401) {
        saatSesiHabis();
        const err = new Error('Sesi habis, silakan masuk lagi.');
        err.code = 401;
        reject(err);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data?.pesan
          || (xhr.status === 403 ? 'Tiket ini bukan milik regu Anda.'
            : xhr.status === 413 ? 'Foto terlalu besar. Ambil ulang foto.'
              : xhr.status >= 500 ? 'Server sedang bermasalah. Coba lagi sebentar.'
                : `Permintaan gagal (HTTP ${xhr.status}).`)));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error('Tidak bisa terhubung ke server. Cek sinyal internet dan URL server.'));
    xhr.ontimeout = () => reject(new Error('Upload terlalu lama. Cek sinyal lalu coba lagi.'));
    xhr.send(fd);
  });
}
