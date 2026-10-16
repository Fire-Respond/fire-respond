// URL backend. Ganti dengan URL ngrok yang sedang aktif (tanpa garis miring di akhir).
// Bisa juga diganti langsung dari layar login, di bagian "Pengaturan server".
export const DEFAULT_API_URL = 'https://GANTI-DENGAN-URL-NGROK.ngrok-free.app';

// Seberapa sering aplikasi mengecek tiket baru (milidetik)
export const POLLING_MS = 15000;

// Batas waktu respons sebelum tiket dieskalasi otomatis ke BPBD (sama dengan Firms:SlaMenit di backend)
export const SLA_MENIT = 30;
