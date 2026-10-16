using FireRespond.Data;
using FireRespond.Models;
using FireRespond.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Controllers.Api;

[ApiController]
[Route("api/tiket")]
public class TiketController : ApiBase
{
    private readonly IWebHostEnvironment _env;

    public TiketController(AppDbContext db, TokenService tokens, IWebHostEnvironment env) : base(db, tokens)
    {
        _env = env;
    }

    // Status tujuan yang boleh dikirim regu, berdasarkan status tiket sekarang
    private static readonly Dictionary<StatusTiket, StatusTiket[]> Transisi = new()
    {
        [StatusTiket.MenujuLokasi] = [StatusTiket.Dicek, StatusTiket.AlarmPalsu, StatusTiket.Penanganan],
        [StatusTiket.Dicek] = [StatusTiket.AlarmPalsu, StatusTiket.Penanganan],
        [StatusTiket.Penanganan] = [StatusTiket.Penanganan, StatusTiket.Padam],
        [StatusTiket.Pemantauan] = [StatusTiket.Pemantauan, StatusTiket.Penanganan, StatusTiket.Selesai],
    };

    private IQueryable<Tiket> DenganRelasi() =>
        Db.Tiket.Include(t => t.Desa).Include(t => t.Regu).Include(t => t.TitikPanas);

    /// GET /api/tiket            -> tiket aktif milik regu (admin: semua regu)
    /// GET /api/tiket?semua=true -> termasuk yang sudah selesai / alarm palsu
    [HttpGet]
    public async Task<IActionResult> Daftar([FromQuery] bool semua = false)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();

        var q = DenganRelasi().AsNoTracking();
        if (saya.Role == RolePengguna.Regu) q = q.Where(t => t.ReguId == saya.ReguId);
        if (!semua) q = q.Where(t => t.Status != StatusTiket.Selesai && t.Status != StatusTiket.AlarmPalsu);

        var data = await q.OrderByDescending(t => t.DibuatUtc).ToListAsync();
        return Ok(data.Select(TiketDto.Ringkas));
    }

    /// GET /api/tiket/5 -> detail + riwayat update (foto, catatan)
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();

        var t = await DenganRelasi().AsNoTracking()
            .Include(x => x.Update).ThenInclude(u => u.Pengguna)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (!BolehAkses(saya, t)) return Dilarang();

        return Ok(new
        {
            tiket = TiketDto.Ringkas(t),
            update = t.Update.OrderBy(u => u.WaktuUtc).Select(u => new
            {
                u.Id,
                Status = u.Status.ToString(),
                Oleh = u.Pengguna?.NamaLengkap ?? "Sistem",
                u.FotoPath,
                u.Lat, u.Lon, u.LuasHa, u.UkuranApi, u.ArahSebaran, u.Catatan, u.WaktuUtc
            })
        });
    }

    /// POST /api/tiket/5/terima -> regu menerima tiket dan berangkat ke lokasi
    [HttpPost("{id:int}/terima")]
    public async Task<IActionResult> Terima(int id)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();

        var t = await DenganRelasi().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (!BolehAkses(saya, t)) return Dilarang();
        if (t.Status != StatusTiket.Baru) return Gagal("Tiket ini sudah diterima.");

        var now = DateTime.UtcNow;
        t.Status = StatusTiket.MenujuLokasi;
        t.DireponsUtc = now;
        Db.UpdateTiket.Add(new UpdateTiket
        {
            TiketId = t.Id, PenggunaId = saya.Id, Status = t.Status, WaktuUtc = now,
            Catatan = "Regu menerima tiket dan menuju lokasi."
        });
        await Db.SaveChangesAsync();
        return Ok(TiketDto.Ringkas(t));
    }

    public class UpdateForm
    {
        public StatusTiket Status { get; set; }
        public IFormFile? Foto { get; set; }
        public double? Lat { get; set; }
        public double? Lon { get; set; }
        public double? LuasHa { get; set; }
        public string? UkuranApi { get; set; }     // Kecil / Sedang / Besar
        public string? ArahSebaran { get; set; }
        public string? Catatan { get; set; }
    }

    /// POST /api/tiket/5/update  (multipart/form-data)
    /// status: Dicek | AlarmPalsu | Penanganan | Padam | Pemantauan | Selesai
    [HttpPost("{id:int}/update")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateForm f)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();

        var t = await DenganRelasi().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (!BolehAkses(saya, t)) return Dilarang();

        if (!Transisi.TryGetValue(t.Status, out var boleh) || !boleh.Contains(f.Status))
            return Gagal($"Status {t.Status} tidak bisa diubah ke {f.Status}.");

        var wajibFoto = f.Status is StatusTiket.AlarmPalsu or StatusTiket.Padam
                        || (f.Status == StatusTiket.Penanganan && t.Status != StatusTiket.Penanganan);
        if (wajibFoto && f.Foto is null) return Gagal("Foto wajib dilampirkan untuk status ini.");

        string? fotoPath = null;
        if (f.Foto is not null)
        {
            var folder = Path.Combine(_env.WebRootPath, "uploads");
            Directory.CreateDirectory(folder);
            var ext = Path.GetExtension(f.Foto.FileName);
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var nama = $"{Guid.NewGuid():N}{ext}";
            await using (var stream = System.IO.File.Create(Path.Combine(folder, nama)))
            {
                await f.Foto.CopyToAsync(stream);
            }
            fotoPath = $"/uploads/{nama}";
        }

        var now = DateTime.UtcNow;
        switch (f.Status)
        {
            case StatusTiket.Dicek:
                t.TibaUtc ??= now;
                t.Status = StatusTiket.Dicek;
                break;
            case StatusTiket.AlarmPalsu:
                t.TibaUtc ??= now;
                t.Status = StatusTiket.AlarmPalsu;
                t.SelesaiUtc = now;
                break;
            case StatusTiket.Penanganan:
                t.TibaUtc ??= now;
                if (t.Status == StatusTiket.Pemantauan) t.JumlahDibukaUlang++;   // api muncul lagi
                t.Status = StatusTiket.Penanganan;
                break;
            case StatusTiket.Padam:
                t.PadamUtc = now;
                t.Status = StatusTiket.Pemantauan;   // otomatis masuk masa pemantauan 24 jam
                break;
            case StatusTiket.Selesai:
                t.Status = StatusTiket.Selesai;
                t.SelesaiUtc = now;
                break;
            // Pemantauan: laporan cek ulang, status tidak berubah
        }
        if (f.LuasHa is not null) t.LuasTerbakarHa = f.LuasHa;

        Db.UpdateTiket.Add(new UpdateTiket
        {
            TiketId = t.Id, PenggunaId = saya.Id, Status = f.Status, WaktuUtc = now,
            FotoPath = fotoPath, Lat = f.Lat, Lon = f.Lon, LuasHa = f.LuasHa,
            UkuranApi = f.UkuranApi, ArahSebaran = f.ArahSebaran, Catatan = f.Catatan
        });
        await Db.SaveChangesAsync();
        return Ok(TiketDto.Ringkas(t));
    }

    public record EskalasiRequest(string? Catatan);

    /// POST /api/tiket/5/eskalasi  body (opsional): { "catatan": "Api meluas ke kebun warga" }
    [HttpPost("{id:int}/eskalasi")]
    public async Task<IActionResult> Eskalasi(int id, [FromBody] EskalasiRequest? req = null)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();

        var t = await DenganRelasi().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (!BolehAkses(saya, t)) return Dilarang();
        if (t.Status is StatusTiket.Selesai or StatusTiket.AlarmPalsu) return Gagal("Tiket sudah ditutup.");

        var now = DateTime.UtcNow;
        t.Dieskalasi = true;
        t.EskalasiOtomatis = false;
        t.EskalasiUtc = now;
        Db.UpdateTiket.Add(new UpdateTiket
        {
            TiketId = t.Id, PenggunaId = saya.Id, Status = t.Status, WaktuUtc = now,
            Catatan = $"Regu meminta bantuan BPBD. {req?.Catatan}".Trim()
        });
        await Db.SaveChangesAsync();
        return Ok(TiketDto.Ringkas(t));
    }

    /// POST /api/tiket/5/bantuan -> admin BPBD menandai bantuan sudah dikirim
    [HttpPost("{id:int}/bantuan")]
    public async Task<IActionResult> KirimBantuan(int id)
    {
        var saya = await SayaAsync();
        if (saya is null) return Unauthorized();
        if (saya.Role != RolePengguna.Admin) return Dilarang("Hanya admin BPBD yang bisa menandai bantuan.");

        var t = await DenganRelasi().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();

        var now = DateTime.UtcNow;
        t.BantuanDikirim = true;
        Db.UpdateTiket.Add(new UpdateTiket
        {
            TiketId = t.Id, PenggunaId = saya.Id, Status = t.Status, WaktuUtc = now,
            Catatan = "BPBD mengirim bantuan ke lokasi."
        });
        await Db.SaveChangesAsync();
        return Ok(TiketDto.Ringkas(t));
    }
}
