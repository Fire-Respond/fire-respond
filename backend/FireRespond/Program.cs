using System.Globalization;
using System.Text.Json.Serialization;
using FireRespond.Data;
using FireRespond.Services;
using Microsoft.EntityFrameworkCore;

// Pakai format angka internasional (titik desimal). Tanpa ini, di laptop berbahasa Indonesia
// koordinat "-2.25" dari form mobile bisa terbaca sebagai -225.
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddDataProtection();
builder.Services.AddSingleton<TokenService>();

builder.Services.Configure<FirmsOptions>(builder.Configuration.GetSection("Firms"));
builder.Services.AddHttpClient<FirmsService>(c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHostedService<FirmsWorker>();
builder.Services.AddHttpClient<NominatimService>(c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("FireRespond/1.0 (hackathon JOINTS UGM)");
    c.Timeout = TimeSpan.FromSeconds(20);
});

var app = builder.Build();

// Buat database + isi data awal saat aplikasi pertama kali jalan
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await SeedData.IsiAsync(db);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllers();   // route API ([Route] attribute)
app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
