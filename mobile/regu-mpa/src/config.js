// URL backend yang sudah di-deploy di Railway (tanpa garis miring di akhir).
// Untuk server lokal, ganti dari layar login di bagian "Pengaturan server".
export const DEFAULT_API_URL = 'https://fire-respond-production.up.railway.app';

// Seberapa sering aplikasi mengecek tiket baru (milidetik)
export const POLLING_MS = 15000;

// Batas waktu respons sebelum tiket dieskalasi otomatis ke BPBD (sama dengan Firms:SlaMenit di backend)
export const SLA_MENIT = 30;
