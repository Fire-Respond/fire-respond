using FireRespond.Data;
using FireRespond.Models;
using FireRespond.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Controllers.Api;

[ApiController]
[Route("api/auth")]
public class AuthController : ApiBase
{
    public AuthController(AppDbContext db, TokenService tokens) : base(db, tokens) { }

    public record LoginRequest(string Username, string Password);

    /// POST /api/auth/login  body: { "username": "regu_a", "password": "firerespond123" }
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var p = await Db.Pengguna.Include(x => x.Regu)
            .FirstOrDefaultAsync(x => x.Username == req.Username);
        if (p is null) return Unauthorized(new { pesan = "Username atau password salah." });

        var cek = new PasswordHasher<Pengguna>().VerifyHashedPassword(p, p.PasswordHash, req.Password);
        if (cek == PasswordVerificationResult.Failed)
            return Unauthorized(new { pesan = "Username atau password salah." });

        return Ok(new
        {
            token = Tokens.Buat(p.Id),
            nama = p.NamaLengkap,
            role = p.Role.ToString(),
            reguId = p.ReguId,
            reguNama = p.Regu?.Nama
        });
    }

    /// GET /api/auth/saya  (cek token masih berlaku)
    [HttpGet("saya")]
    public async Task<IActionResult> Saya()
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();
        return Ok(new { saya.Id, saya.NamaLengkap, Role = saya.Role.ToString(), saya.ReguId });
    }
}
