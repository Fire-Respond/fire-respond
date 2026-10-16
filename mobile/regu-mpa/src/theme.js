// Sama dengan dashboard BPBD: gambut gelap untuk kerangka, oranye api hanya untuk yang perlu tindakan.
export const warna = {
  bg: '#E9EDE8',
  surface: '#FFFFFF',
  surface2: '#F5F7F4',
  border: '#D3DBD2',
  text: '#18221C',
  muted: '#59665E',
  accent: '#E2520F',
  accentGelap: '#B83F07',
  bahaya: '#C2341B',
  bahayaBg: '#FDEDE4',
  ok: '#2E7D4F',
  okBg: '#E6F3EB',
  info: '#2C6E9B',
  infoBg: '#E4EEF5',
  gambut: '#142019',
  gambut2: '#1E2C24',
  teksGelap: '#E8EEE9',
  redupGelap: '#9DB0A4',
};

export const STATUS = {
  Baru: { label: 'Baru', warna: '#D63B1F' },
  MenujuLokasi: { label: 'Menuju lokasi', warna: '#D98A12' },
  Dicek: { label: 'Dicek', warna: '#A88400' },
  Penanganan: { label: 'Penanganan', warna: '#E2520F' },
  Padam: { label: 'Padam', warna: '#2E7D4F' },
  Pemantauan: { label: 'Pemantauan', warna: '#2C6E9B' },
  Selesai: { label: 'Selesai', warna: '#8C968F' },
  AlarmPalsu: { label: 'Alarm palsu', warna: '#8C968F' },
};

export const statusInfo = (s) => STATUS[s] || { label: s, warna: '#8C968F' };
