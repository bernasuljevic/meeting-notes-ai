using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;
using api.Options;

namespace api.Services.Email;

/// <summary>
/// Gerçek e-posta gönderimi - SendGrid API'siyle. IEmailSender'ı çağıran hiçbir
/// kod (UserService) bu implementasyonun var olduğunu bilmiyor; DI kaydı
/// (Program.cs) FakeEmailSender yerine bunu SADECE SendGrid:ApiKey doluysa
/// seçiyor - key henüz yoksa uygulama otomatik olarak FakeEmailSender'a düşüyor.
/// </summary>
public class SendGridEmailSender : IEmailSender
{
    private readonly ISendGridClient _client;
    private readonly SendGridOptions _options;
    private readonly ILogger<SendGridEmailSender> _logger;

    public SendGridEmailSender(
        ISendGridClient client, IOptions<SendGridOptions> options, ILogger<SendGridEmailSender> logger)
    {
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(
        string toEmail, string code, CancellationToken cancellationToken = default)
    {
        var from = new EmailAddress(_options.FromEmail, _options.FromName);
        var to = new EmailAddress(toEmail);

        var plainText = $"MeetBrainz doğrulama kodunuz: {code}\n\nBu kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.";

        var html = $"""
            <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #241c08;">MeetBrainz doğrulama kodunuz</h2>
              <p style="color: #4a3a1a;">Hesabınızı doğrulamak için aşağıdaki kodu girin:</p>
              <div style="background: #f7b916; color: #241c08; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; border-radius: 12px; margin: 24px 0;">
                {code}
              </div>
              <p style="color: #7a6a4a; font-size: 13px;">Bu kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
            </div>
            """;

        var message = MailHelper.CreateSingleEmail(from, to, "MeetBrainz doğrulama kodunuz", plainText, html);

        var response = await _client.SendEmailAsync(message, cancellationToken);

        if ((int)response.StatusCode >= 300)
        {
            var body = await response.Body.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "SendGrid e-posta gönderemedi: {StatusCode} {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"SendGrid e-posta gönderemedi: {response.StatusCode}");
        }
    }
}
