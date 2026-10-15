namespace FireRespond.Models;

public enum StatusTiket
{
    Baru,           // dibuat otomatis dari titik panas, belum direspons regu
    MenujuLokasi,   // regu menerima tiket dan berangkat
    Dicek,          // regu sudah di lokasi, belum memutuskan
    AlarmPalsu,     // bukan api, tiket ditutup
    Penanganan,     // api dikonfirmasi, sedang dipadamkan
    Padam,          // api padam (transisi singkat sebelum pemantauan)
    Pemantauan,     // dipantau 24 jam, bisa dibuka lagi kalau ada titik panas baru
    Selesai         // tiket ditutup
}

public enum RolePengguna { Admin, Regu }

public class Desa
{
    public int Id { get; set; }
    public string Nama { get; set; } = "";
    public double Lat { get; set; }
    public double Lon { get; set; }
    public double RadiusKm { get; set; } = 5;
    public List<Regu> Regu { get; set; } = new();
}

public class Regu
{
    public int Id { get; set; }
    public string Nama { get; set; } = "";
    public int DesaId { get; set; }
    public Desa? Desa { get; set; }
}

public class Pengguna
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string NamaLengkap { get; set; } = "";
    public RolePengguna Role { get; set; }
    public int? ReguId { get; set; }
    public Regu? Regu { get; set; }
}

public class TitikPanas
{
    public int Id { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public DateTime WaktuDeteksiUtc { get; set; }
    public string Confidence { get; set; } = "";  // VIIRS: l/n/h, MODIS: 0-100
    public string Satelit { get; set; } = "";
    public double Frp { get; set; }               // fire radiative power (MW)
    public bool DariReplay { get; set; }
}

public class Tiket
{
    public int Id { get; set; }
    public int TitikPanasId { get; set; }
    public TitikPanas? TitikPanas { get; set; }
    public int DesaId { get; set; }
    public Desa? Desa { get; set; }
    public int? ReguId { get; set; }
    public Regu? Regu { get; set; }

    public StatusTiket Status { get; set; } = StatusTiket.Baru;
    public double JarakKm { get; set; }

    public bool Dieskalasi { get; set; }
    public bool EskalasiOtomatis { get; set; }   // true kalau dipicu SLA, bukan oleh regu
    public bool BantuanDikirim { get; set; }      // diisi admin BPBD
    public int JumlahDibukaUlang { get; set; }

    public DateTime DibuatUtc { get; set; }
    public DateTime? DireponsUtc { get; set; }
    public DateTime? TibaUtc { get; set; }
    public DateTime? EskalasiUtc { get; set; }
    public DateTime? PadamUtc { get; set; }
    public DateTime? SelesaiUtc { get; set; }

    public double? LuasTerbakarHa { get; set; }
    public List<UpdateTiket> Update { get; set; } = new();
}

public class UpdateTiket
{
    public int Id { get; set; }
    public int TiketId { get; set; }
    public Tiket? Tiket { get; set; }
    public int? PenggunaId { get; set; }          // null = dibuat sistem
    public Pengguna? Pengguna { get; set; }

    public StatusTiket Status { get; set; }
    public string? FotoPath { get; set; }
    public double? Lat { get; set; }
    public double? Lon { get; set; }
    public double? LuasHa { get; set; }
    public string? UkuranApi { get; set; }        // Kecil / Sedang / Besar
    public string? ArahSebaran { get; set; }
    public string? Catatan { get; set; }
    public DateTime WaktuUtc { get; set; }
}
