namespace api.Services.Email;

/// <summary>
/// E-posta gönderimini soyutlar - IUserAiClient/ITokenProtector'la aynı desen.
/// Şu an tek implementasyonu FakeEmailSender (konsola log'lar); SendGrid API key
/// hazır olunca SendGridEmailSender eklenip DI kaydı (AddScoped/AddSingleton
/// çağrısı) değiştirilecek, bu arayüzü çağıran hiçbir kod değişmeyecek.
/// </summary>
public interface IEmailSender
{
    Task SendVerificationCodeAsync(
        string toEmail, string code, CancellationToken cancellationToken = default);
}
