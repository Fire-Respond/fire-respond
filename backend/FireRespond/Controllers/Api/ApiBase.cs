using FireRespond.Data;
using FireRespond.Models;
using FireRespond.Services;
using Microsoft.AspNetCore.Mvc;

namespace FireRespond.Controllers.Api;

public abstract class ApiBase : ControllerBase
{
    protected readonly AppDbContext Db;
    protected readonly TokenService Tokens;

    protected ApiBase(AppDbContext db, TokenService tokens)
    {
        Db = db; Tokens = tokens;
    }

    /// Pengguna yang sedang login, dibaca dari header "Authorization: Bearer <token>".
    protected async Task<Pengguna?> SayaAsync()
    {
        var auth = Request.Headers.Authorization.ToString();
        var token = auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? auth[7..].Trim() : null;
        var id = Tokens.Baca(token);
        return id is null ? null : await Db.Pengguna.FindAsync(id.Value);
    }

    protected static bool BolehAkses(Pengguna saya, Tiket t)
        => saya.Role == RolePengguna.Admin || t.ReguId == saya.ReguId;

    protected IActionResult Gagal(string pesan) => BadRequest(new { pesan });

    // Jangan pakai Forbid(): tanpa skema autentikasi ASP.NET, Forbid() bikin error 500.
    protected IActionResult Dilarang(string pesan = "Tiket ini bukan milik regu Anda.")
        => StatusCode(403, new { pesan });
}

/// Bentuk ringkas tiket yang dikirim ke mobile dan web.
public static class TiketDto
{
    public static object Ringkas(Tiket t) => new
    {
        t.Id,
        Status = t.Status.ToString(),
        Desa = t.Desa?.Nama,
        Regu = t.Regu?.Nama,
        Lat = t.TitikPanas?.Lat,
        Lon = t.TitikPanas?.Lon,
        t.JarakKm,
        Frp = t.TitikPanas?.Frp,
        WaktuDeteksiUtc = t.TitikPanas?.WaktuDeteksiUtc,
        t.DibuatUtc,
        t.DireponsUtc,
        t.TibaUtc,
        t.PadamUtc,
        t.SelesaiUtc,
        t.Dieskalasi,
        t.EskalasiOtomatis,
        t.BantuanDikirim,
        t.JumlahDibukaUlang,
        t.LuasTerbakarHa
    };
}
