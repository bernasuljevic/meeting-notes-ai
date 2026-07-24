using Microsoft.AspNetCore.DataProtection;

namespace api.Services.Auth;

/// <summary>
/// ASP.NET Core Data Protection API'sini kullanır (harici paket gerekmez).
/// Anahtarlar varsayılan olarak bu makinede, kullanıcı profili altında saklanır;
/// yani şifrelenmiş token'lar sadece bu uygulamanın çalıştığı makinede çözülebilir.
/// </summary>
public class TokenProtector : ITokenProtector
{
    private readonly IDataProtector _protector;

    public TokenProtector(IDataProtectionProvider provider)
    {
        // Ayrı bir "amaç" (purpose) string'i: bu şifreleme sadece kullanıcı AI
        // token'ları için kullanılır, başka bir Data Protection kullanımıyla karışmaz.
        _protector = provider.CreateProtector("MeetingNotesAi.UserAiToken.v1");
    }

    public string Protect(string plainText) => _protector.Protect(plainText);

    public string Unprotect(string cipherText) => _protector.Unprotect(cipherText);
}
