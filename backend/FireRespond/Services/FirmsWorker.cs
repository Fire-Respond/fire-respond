using Microsoft.Extensions.Options;

namespace FireRespond.Services;

/// Jalan di background: tiap N menit tarik data FIRMS dan jalankan aturan SLA.
public class FirmsWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly FirmsOptions _opt;
    private readonly ILogger<FirmsWorker> _log;

    public FirmsWorker(IServiceScopeFactory scopes, IOptions<FirmsOptions> opt, ILogger<FirmsWorker> log)
    {
        _scopes = scopes; _opt = opt.Value; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_opt.MapKey))
        {
            _log.LogWarning("Firms:MapKey kosong, penarik data FIRMS tidak dijalankan.");
            return;
        }

        // Aturan SLA dicek tiap menit, data FIRMS ditarik tiap IntervalMenit
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        var tarikBerikutnya = DateTime.UtcNow;

        do
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var firms = scope.ServiceProvider.GetRequiredService<FirmsService>();

                if (DateTime.UtcNow >= tarikBerikutnya)
                {
                    await firms.TarikDanProsesAsync(null, ct);
                    tarikBerikutnya = DateTime.UtcNow.AddMinutes(_opt.IntervalMenit);
                }
                await firms.JalankanAturanAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Jangan sampai worker mati cuma karena internet putus sebentar
                _log.LogError(ex, "Gagal memproses data FIRMS");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
