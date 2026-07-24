namespace api.Services.Auth;

/// <summary>
/// Kullanıcının kendi AI API token'ını (örn. Claude API anahtarı) DB'de düz metin
/// olarak değil, şifrelenmiş halde saklamak için kullanılır.
/// </summary>
public interface ITokenProtector
{
    string Protect(string plainText);

    string Unprotect(string cipherText);
}
