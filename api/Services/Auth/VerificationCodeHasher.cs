using System.Security.Cryptography;
using System.Text;

namespace api.Services.Auth;

/// <summary>
/// E-posta doğrulama kodu için PasswordHasher'ın basitleştirilmiş hali - PBKDF2'nin
/// 100k iterasyonu burada gereksiz (kod zaten 15 dakikada geçersiz oluyor ve
/// deneme sayısı sınırlı, PasswordHasher'daki gibi uzun vadeli bir offline
/// brute-force hedefi değil), düz SHA256 yeterli.
/// </summary>
public static class VerificationCodeHasher
{
    /// <summary>6 haneli, kriptografik olarak güvenli rastgele bir kod üretir.</summary>
    public static string GenerateCode() => RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();

    public static string Hash(string code) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

    public static bool Verify(string code, string storedHash)
    {
        byte[] expected;

        try
        {
            expected = Convert.FromBase64String(storedHash);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = SHA256.HashData(Encoding.UTF8.GetBytes(code));

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
