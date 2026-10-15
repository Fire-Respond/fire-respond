using FireRespond.Data;
using FireRespond.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Controllers.Api;

// Dipakai dashboard web BPBD. Catatan: belum dikunci login, lindungi setelah login admin web jadi.
[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db) => _db = db;

    /// GET /api/dashboard/ringkasan -> angka untuk kartu metrik
    [HttpGet("ringkasan")]
    public async Task<IActionResult> Ringkasan()
    {
        var tiket = await _db.Tiket.AsNoTracking().ToListAsync();
        bool Aktif(Tiket t) => t.Status is not (StatusTiket.Selesai or StatusTiket.AlarmPalsu);

        var respons = tiket.Where(t => t.DireponsUtc is not null)
            .Select(t => (t.DireponsUtc!.Value - t.DibuatUtc).TotalMinutes).ToList();
        var padam = tiket.Where(t => t.PadamUtc is not null)
            .Select(t => (t.PadamUtc!.Value - t.DibuatUtc).TotalMinutes).ToList();
        var dicek = tiket.Count(t => t.TibaUtc is not null);
        var alarmPalsu = tiket.Count(t => t.Status == StatusTiket.AlarmPalsu);

        return Ok(new
        {
            totalTiket = tiket.Count,
            tiketAktif = tiket.Count(Aktif),
            tiketBaru = tiket.Count(t => t.Status == StatusTiket.Baru),
            eskalasiAktif = tiket.Count(t => t.Dieskalasi && Aktif(t)),
            alarmPalsu,
            rasioAlarmPalsuPersen = dicek == 0 ? 0 : Math.Round(100.0 * alarmPalsu / dicek, 1),
            rataResponsMenit = respons.Count == 0 ? (double?)null : Math.Round(respons.Average(), 1),
            rataSampaiPadamMenit = padam.Count == 0 ? (double?)null : Math.Round(padam.Average(), 1),
            totalLuasTerbakarHa = Math.Round(tiket.Sum(t => t.LuasTerbakarHa ?? 0), 2),
            dibukaUlang = tiket.Sum(t => t.JumlahDibukaUlang)
        });
    }

    /// GET /api/dashboard/peta?jam=24 -> titik panas, desa + radius, dan tiket aktif untuk peta Leaflet.
    /// Titik hasil replay selalu ikut ditampilkan.
    [HttpGet("peta")]
    public async Task<IActionResult> Peta([FromQuery] int jam = 24)
    {
        var batas = DateTime.UtcNow.AddHours(-jam);

        var titik = await _db.TitikPanas.AsNoTracking()
            .Where(t => t.WaktuDeteksiUtc >= batas || t.DariReplay)
            .OrderByDescending(t => t.WaktuDeteksiUtc)
            .Take(3000)
            .Select(t => new { t.Lat, t.Lon, t.WaktuDeteksiUtc, t.Confidence, t.Frp })
            .ToListAsync();

        var desa = await _db.Desa.AsNoTracking()
            .Select(d => new { d.Id, d.Nama, d.Lat, d.Lon, d.RadiusKm })
            .ToListAsync();

        var tiket = await _db.Tiket.AsNoTracking()
            .Include(t => t.Desa).Include(t => t.Regu).Include(t => t.TitikPanas)
            .Where(t => t.Status != StatusTiket.Selesai && t.Status != StatusTiket.AlarmPalsu)
            .ToListAsync();

        return Ok(new { titikPanas = titik, desa, tiket = tiket.Select(TiketDto.Ringkas) });
    }
}
