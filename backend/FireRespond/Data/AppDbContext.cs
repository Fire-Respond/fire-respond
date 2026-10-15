using FireRespond.Models;
using Microsoft.EntityFrameworkCore;

namespace FireRespond.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Desa> Desa => Set<Desa>();
    public DbSet<Regu> Regu => Set<Regu>();
    public DbSet<Pengguna> Pengguna => Set<Pengguna>();
    public DbSet<TitikPanas> TitikPanas => Set<TitikPanas>();
    public DbSet<Tiket> Tiket => Set<Tiket>();
    public DbSet<UpdateTiket> UpdateTiket => Set<UpdateTiket>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Simpan enum sebagai teks biar gampang dibaca di database
        b.Entity<Tiket>().Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        b.Entity<UpdateTiket>().Property(u => u.Status).HasConversion<string>().HasMaxLength(20);
        b.Entity<Pengguna>().Property(p => p.Role).HasConversion<string>().HasMaxLength(10);

        b.Entity<Pengguna>().HasIndex(p => p.Username).IsUnique();

        // Satu titik panas (posisi + waktu) hanya disimpan sekali
        b.Entity<TitikPanas>().HasIndex(t => new { t.Lat, t.Lon, t.WaktuDeteksiUtc }).IsUnique();
        b.Entity<Tiket>().HasIndex(t => t.Status);

        // Hindari multiple cascade path di SQL Server
        b.Entity<Tiket>().HasOne(t => t.Desa).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<Tiket>().HasOne(t => t.Regu).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<Tiket>().HasOne(t => t.TitikPanas).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<Pengguna>().HasOne(p => p.Regu).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<UpdateTiket>().HasOne(u => u.Pengguna).WithMany().OnDelete(DeleteBehavior.Restrict);
    }
}
