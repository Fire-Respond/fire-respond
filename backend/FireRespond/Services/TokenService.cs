using Microsoft.AspNetCore.DataProtection;

namespace FireRespond.Services;

/// Token login sederhana tanpa paket JWT: id pengguna dienkripsi dan diberi masa berlaku.
public class TokenService
{
    private readonly ITimeLimitedDataProtector _protector;

    public TokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("FireRespond.Token").ToTimeLimitedDataProtector();
    }

    public string Buat(int penggunaId) => _protector.Protect(penggunaId.ToString(), TimeSpan.FromDays(7));

    public int? Baca(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            return int.Parse(_protector.Unprotect(token));
        }
        catch
        {
            return null;   // token rusak atau kedaluwarsa
        }
    }
}
