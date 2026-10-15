using FireRespond.Data;
using FireRespond.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Controllers.Api;

// Catatan: belum ada autentikasi, sama seperti AdminFirmsController.
[ApiController]
[Route("api/admin")]
public class AdminDesaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NominatimService _geo;

    public AdminDesaController(AppDbContext db, NominatimService geo)
    {
        _db = db; _geo = geo;
    }

    /// POST /api/admin/desa/isi-nama -> isi nama semua desa otomatis dari koordinatnya
    [HttpPost("desa/isi-nama")]
    public async Task<IActionResult> IsiNamaSemuaDesa(CancellationToken ct)
    {
        var hasil = new List<object>();
        foreach (var d in await _db.Desa.ToListAsync(ct))
        {
            var nama = await _geo.NamaWilayahAsync(d.Lat, d.Lon, ct);
            if (!string.IsNullOrWhiteSpace(nama)) d.Nama = nama;
            hasil.Add(new { d.Id, d.Lat, d.Lon, Nama = d.Nama, Ketemu = nama is not null });
            await Task.Delay(1100, ct);   // batas Nominatim: 1 request per detik
        }
        await _db.SaveChangesAsync(ct);
        return Ok(hasil);
    }

    /// GET /api/admin/geo/nama?lat=-3.405&lon=113.77 -> dipakai form Kelola Desa di web
    [HttpGet("geo/nama")]
    public async Task<IActionResult> NamaDariKoordinat([FromQuery] double lat, [FromQuery] double lon, CancellationToken ct)
        => Ok(new { nama = await _geo.NamaWilayahAsync(lat, lon, ct) });
}
