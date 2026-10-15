namespace FireRespond.Services;

public static class Geo
{
    private const double RadiusBumiKm = 6371.0;

    /// Jarak dua koordinat dalam kilometer (rumus haversine).
    public static double JarakKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = KeRadian(lat2 - lat1);
        var dLon = KeRadian(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(KeRadian(lat1)) * Math.Cos(KeRadian(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return RadiusBumiKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double KeRadian(double derajat) => derajat * Math.PI / 180.0;
}
