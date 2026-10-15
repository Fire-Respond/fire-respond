using FireRespond.Services;
using Microsoft.AspNetCore.Mvc;

namespace FireRespond.Controllers.Api;

// Catatan: belum ada autentikasi. Tambahkan [Authorize(Roles = "Admin")] setelah login admin jadi.
[ApiController]
[Route("api/admin/firms")]
public class AdminFirmsController : ControllerBase
{
    private readonly FirmsService _firms;
    public AdminFirmsController(FirmsService firms) => _firms = firms;

    /// Tarik data terbaru sekarang juga, tanpa nunggu jadwal worker.
    /// POST /api/admin/firms/tarik
    [HttpPost("tarik")]
    public async Task<IActionResult> Tarik(CancellationToken ct)
        => Ok(await _firms.TarikDanProsesAsync(null, ct));

    /// Mode replay untuk demo: tarik data satu tanggal di masa lalu.
    /// POST /api/admin/firms/replay?tanggal=2026-08-21
    [HttpPost("replay")]
    public async Task<IActionResult> Replay([FromQuery] DateOnly tanggal, CancellationToken ct)
        => Ok(await _firms.TarikDanProsesAsync(tanggal, ct));
}
