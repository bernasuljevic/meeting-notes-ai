using Microsoft.Extensions.Logging;

namespace api.Services.Email;

/// <summary>
/// Gerçek bir e-posta servisi (SendGrid API key) bağlanana kadar kullanılan
/// geçici implementasyon - kodu gerçekten göndermek yerine loglara yazar.
/// Böylece SendGrid beklemeden kayıt/doğrulama akışının tamamı uçtan uca
/// test edilebiliyor.
/// </summary>
public class FakeEmailSender : IEmailSender
{
    private readonly ILogger<FakeEmailSender> _logger;

    public FakeEmailSender(ILogger<FakeEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendVerificationCodeAsync(
        string toEmail, string code, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "[FAKE EMAIL] {ToEmail} adresine doğrulama kodu: {Code} (gerçek e-posta servisi henüz bağlı değil)",
            toEmail, code);

        return Task.CompletedTask;
    }
}
