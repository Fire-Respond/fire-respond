using FireRespond.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Data;

public static class SeedData
{
    public static async Task IsiAsync(AppDbContext db)
    {
        await db.Database.MigrateAsync();
        if (await db.Desa.AnyAsync()) return;

        // GANTI koordinat ini dengan koordinat asli desa dari Google Maps
        // (klik kanan di peta -> salin angka lat, lon). Radius dibuat agak besar buat demo.
        var desa = new List<Desa>
        {
            new() { Nama = "Kameloh Baru, Palangka Raya", Lat = -2.30, Lon = 114.05, RadiusKm = 10 },
            new() { Nama = "Cemantan, Pulang Pisau", Lat = -3.405, Lon = 113.770, RadiusKm = 10 },
            new() { Nama = "Kawasan Sungai Seruyan, Seruyan", Lat = -3.153, Lon = 112.410, RadiusKm = 10 },
        };
        db.Desa.AddRange(desa);
        await db.SaveChangesAsync();

        var regu = desa.Select((d, i) => new Regu { Nama = $"Regu MPA {(char)('A' + i)}", DesaId = d.Id }).ToList();
        db.Regu.AddRange(regu);
        await db.SaveChangesAsync();

        var hasher = new PasswordHasher<Pengguna>();
        Pengguna Buat(string user, string nama, RolePengguna role, int? reguId)
        {
            var p = new Pengguna { Username = user, NamaLengkap = nama, Role = role, ReguId = reguId };
            p.PasswordHash = hasher.HashPassword(p, "firerespond123");   // password demo semua akun
            return p;
        }

        db.Pengguna.Add(Buat("admin", "Admin BPBD", RolePengguna.Admin, null));
        db.Pengguna.Add(Buat("regu_a", "Ketua Regu A", RolePengguna.Regu, regu[0].Id));
        db.Pengguna.Add(Buat("regu_b", "Ketua Regu B", RolePengguna.Regu, regu[1].Id));
        db.Pengguna.Add(Buat("regu_c", "Ketua Regu C", RolePengguna.Regu, regu[2].Id));
        await db.SaveChangesAsync();
    }
}
