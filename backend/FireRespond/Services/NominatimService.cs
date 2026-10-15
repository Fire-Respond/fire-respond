using System.Text.Json;

namespace FireRespond.Services;

/// Cari nama wilayah dari koordinat (reverse geocoding) pakai OpenStreetMap Nominatim.
/// Aturan pakai Nominatim: maksimal 1 request per detik dan wajib pakai User-Agent.
public class NominatimService
{
    private readonly HttpClient _http;
    public NominatimService(HttpClient http) => _http = http;

    public async Task<string?> NamaWilayahAsync(double lat, double lon, CancellationToken ct = default)
    {
        // Invariant biar titik desimal tidak jadi koma di laptop berbahasa Indonesia
        var url = FormattableString.Invariant(
            $"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=jsonv2&zoom=14&accept-language=id");

        using var doc = JsonDocument.Parse(await _http.GetStringAsync(url, ct));
        if (!doc.RootElement.TryGetProperty("address", out var a)) return null;

        string? Ambil(params string[] kunci)
        {
            foreach (var k in kunci)
                if (a.TryGetProperty(k, out var v) && v.GetString() is { Length: > 0 } s) return s;
            return null;
        }

        var desa = Ambil("village", "hamlet", "suburb", "neighbourhood", "town", "city");
        var kabupaten = Ambil("county", "regency", "municipality", "city");

        if (desa is null) return kabupaten;
        return kabupaten is null || kabupaten == desa ? desa : $"{desa}, {kabupaten}";
    }
}
