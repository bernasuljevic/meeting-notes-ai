namespace api.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    // appsettings.json içinde dolu olmalı (login token'larını imzalamak için).
    public string Secret { get; set; } = string.Empty;

    public int ExpiryMinutes { get; set; } = 60 * 24 * 7; // 1 hafta
}
