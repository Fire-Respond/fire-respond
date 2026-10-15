using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.Configuration.Attributes;
using FireRespond.Data;
using FireRespond.Models;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Services;

public class FirmsOptions
{
    public string MapKey { get; set; } = "";
    public string Source { get; set; } = "VIIRS_NOAA20_NRT";
    public string Area { get; set; } = "110.7,-3.6,116.0,0.8";   // barat,selatan,timur,utara (Kalteng)
    public int IntervalMenit { get; set; } = 15;
    public int SlaMenit { get; set; } = 30;
    public int PemantauanJam { get; set; } = 24;
    public double RadiusBukaUlangKm { get; set; } = 1.0;
}

public class FirmsRow
{
    [Name("latitude")] public double Latitude { get; set; }
    [Name("longitude")] public double Longitude { get; set; }
    [Name("acq_date")] public string AcqDate { get; set; } = "";
    [Name("acq_time")] public string AcqTime { get; set; } = "";
    [Name("satellite")] public string Satellite { get; set; } = "";
    [Name("confidence")] public string Confidence { get; set; } = "";
    [Name("frp")] public double Frp { get; set; }
}

public record HasilProses(int Diterima, int Baru, int TiketDibuat, int TiketDibukaUlang);

public class FirmsService
{
    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly FirmsOptions _opt;
    private readonly ILogger<FirmsService> _log;

    public FirmsService(HttpClient http, AppDbContext db,
        Microsoft.Extensions.Options.IOptions<FirmsOptions> opt, ILogger<FirmsService> log)
    {
        _http = http; _db = db; _opt = opt.Value; _log = log;
    }

    /// Tarik data terbaru (tanggal = null) atau data historis untuk mode replay.
    public async Task<HasilProses> TarikDanProsesAsync(DateOnly? tanggal = null, CancellationToken ct = default)
    {
        var url = $"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{_opt.MapKey}/{_opt.Source}/{_opt.Area}/1";
        if (tanggal is not null) url += $"/{tanggal.Value:yyyy-MM-dd}";

        var csv = await _http.GetStringAsync(url, ct);
        if (!csv.StartsWith("latitude", StringComparison.OrdinalIgnoreCase))
        {
            // FIRMS mengembalikan teks error biasa (misal MAP_KEY salah) dengan status 200
            _log.LogWarning("Respons FIRMS bukan CSV: {Isi}", csv.Length > 200 ? csv[..200] : csv);
            return new HasilProses(0, 0, 0, 0);
        }

        var rows = BacaCsv(csv);
        var replay = tanggal is not null;
        int baru = 0, tiketBaru = 0, bukaUlang = 0;

        var semuaDesa = await _db.Desa.Include(d => d.Regu).ToListAsync(ct);
        var kunciBatch = new HashSet<(double, double, DateTime)>();
        var tiketBatch = new List<Tiket>();   // tiket yang dibuat di tarikan ini (belum tersimpan)

        foreach (var r in rows.Where(LolosConfidence))
        {
            var waktu = ParseWaktu(r.AcqDate, r.AcqTime);
            var lat = Math.Round(r.Latitude, 5);
            var lon = Math.Round(r.Longitude, 5);

            if (!kunciBatch.Add((lat, lon, waktu))) continue;
            var sudahAda = await _db.TitikPanas.AnyAsync(
                t => t.Lat == lat && t.Lon == lon && t.WaktuDeteksiUtc == waktu, ct);
            if (sudahAda) continue;

            var titik = new TitikPanas
            {
                Lat = lat, Lon = lon, WaktuDeteksiUtc = waktu,
                Confidence = r.Confidence, Satelit = r.Satellite, Frp = r.Frp, DariReplay = replay
            };
            _db.TitikPanas.Add(titik);
            baru++;

            // Cari desa terdekat yang radiusnya mencakup titik ini
            var target = semuaDesa
                .Select(d => new { Desa = d, Jarak = Geo.JarakKm(lat, lon, d.Lat, d.Lon) })
                .Where(x => x.Jarak <= x.Desa.RadiusKm)
                .OrderBy(x => x.Jarak)
                .FirstOrDefault();
            if (target is null) continue;

            // Titik panas baru di dekat tiket yang masih aktif tidak bikin tiket baru.
            // Satu kebakaran biasanya terdeteksi sebagai beberapa titik bergerombol.
            var tiketAktif = await _db.Tiket.Include(t => t.TitikPanas)
                .Where(t => t.DesaId == target.Desa.Id
                         && t.Status != StatusTiket.AlarmPalsu
                         && t.Status != StatusTiket.Selesai)
                .ToListAsync(ct);
            tiketAktif.AddRange(tiketBatch.Where(t => t.DesaId == target.Desa.Id));
            var dekat = tiketAktif.FirstOrDefault(t =>
                Geo.JarakKm(lat, lon, t.TitikPanas!.Lat, t.TitikPanas.Lon) <= _opt.RadiusBukaUlangKm);

            if (dekat is not null)
            {
                if (dekat.Status is StatusTiket.Pemantauan or StatusTiket.Padam)
                {
                    // Api muncul lagi di lokasi yang sama: buka ulang tiket
                    dekat.Status = StatusTiket.Penanganan;
                    dekat.JumlahDibukaUlang++;
                    _db.UpdateTiket.Add(new UpdateTiket
                    {
                        Tiket = dekat, Status = StatusTiket.Penanganan, WaktuUtc = DateTime.UtcNow,
                        Lat = lat, Lon = lon,
                        Catatan = "Dibuka ulang otomatis: titik panas baru terdeteksi di lokasi yang sama."
                    });
                    bukaUlang++;
                }
                continue;
            }

            var tiket = new Tiket
            {
                TitikPanas = titik,
                DesaId = target.Desa.Id,
                ReguId = target.Desa.Regu.FirstOrDefault()?.Id,
                JarakKm = Math.Round(target.Jarak, 2),
                Status = StatusTiket.Baru,
                DibuatUtc = DateTime.UtcNow   // waktu sekarang, termasuk saat replay, biar SLA tetap masuk akal
            };
            _db.Tiket.Add(tiket);
            tiketBatch.Add(tiket);
            _db.UpdateTiket.Add(new UpdateTiket
            {
                Tiket = tiket, Status = StatusTiket.Baru, WaktuUtc = DateTime.UtcNow,
                Catatan = $"Titik panas terdeteksi {tiket.JarakKm} km dari {target.Desa.Nama}."
            });
            tiketBaru++;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("FIRMS: {Total} baris, {Baru} titik baru, {Tiket} tiket baru, {Ulang} dibuka ulang",
            rows.Count, baru, tiketBaru, bukaUlang);
        return new HasilProses(rows.Count, baru, tiketBaru, bukaUlang);
    }

    /// Aturan otomatis: eskalasi SLA dan penutupan setelah masa pemantauan.
    public async Task JalankanAturanAsync(CancellationToken ct = default)
    {
        var sekarang = DateTime.UtcNow;

        var batasSla = sekarang.AddMinutes(-_opt.SlaMenit);
        var telat = await _db.Tiket
            .Where(t => t.Status == StatusTiket.Baru && !t.Dieskalasi && t.DibuatUtc < batasSla)
            .ToListAsync(ct);
        foreach (var t in telat)
        {
            t.Dieskalasi = true;
            t.EskalasiOtomatis = true;
            t.EskalasiUtc = sekarang;
            _db.UpdateTiket.Add(new UpdateTiket
            {
                TiketId = t.Id, Status = t.Status, WaktuUtc = sekarang,
                Catatan = $"Eskalasi otomatis: tidak direspons regu dalam {_opt.SlaMenit} menit."
            });
        }

        var batasPantau = sekarang.AddHours(-_opt.PemantauanJam);
        var selesai = await _db.Tiket
            .Where(t => t.Status == StatusTiket.Pemantauan && t.PadamUtc < batasPantau)
            .ToListAsync(ct);
        foreach (var t in selesai)
        {
            t.Status = StatusTiket.Selesai;
            t.SelesaiUtc = sekarang;
            _db.UpdateTiket.Add(new UpdateTiket
            {
                TiketId = t.Id, Status = StatusTiket.Selesai, WaktuUtc = sekarang,
                Catatan = $"Ditutup otomatis: tidak ada api baru selama {_opt.PemantauanJam} jam pemantauan."
            });
        }

        if (telat.Count + selesai.Count > 0) await _db.SaveChangesAsync(ct);
    }

    private static List<FirmsRow> BacaCsv(string csv)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            PrepareHeaderForMatch = a => a.Header.Trim().ToLowerInvariant(),
            HeaderValidated = null,
            MissingFieldFound = null
        };
        using var reader = new StringReader(csv);
        using var parser = new CsvReader(reader, config);
        return parser.GetRecords<FirmsRow>().ToList();
    }

    // VIIRS: l = low, n = nominal, h = high. MODIS: angka 0-100.
    private static bool LolosConfidence(FirmsRow r)
    {
        var c = r.Confidence.Trim().ToLowerInvariant();
        if (int.TryParse(c, out var angka)) return angka >= 30;
        return c is "n" or "h" or "nominal" or "high";
    }

    // acq_time format HHMM dalam UTC, kadang tanpa nol di depan (misal "512" = 05:12)
    private static DateTime ParseWaktu(string tanggal, string jam)
    {
        var hhmm = jam.Trim().PadLeft(4, '0');
        var dt = DateTime.ParseExact($"{tanggal} {hhmm}", "yyyy-MM-dd HHmm", CultureInfo.InvariantCulture);
        return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
    }
}
