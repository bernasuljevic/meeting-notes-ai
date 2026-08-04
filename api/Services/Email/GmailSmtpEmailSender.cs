using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services.Email;

/// <summary>
/// SendGridEmailSender'ın alternatifi - üçüncü bir servis üzerinden Gmail
/// adresi "taklit" etmek yerine (spoofing izlenimi verip spam'e düşüyordu,
/// bkz. SendGridEmailSender'ın yorumu), doğrudan Gmail'in KENDİ SMTP
/// sunucusundan, gerçek hesabınızla gönderiyor - mail gerçekten Google'ın
/// altyapısından çıktığı için ayrı bir alan adı/DKIM kurulumuna gerek kalmadan
/// çok daha güvenilir teslim ediliyor (özellikle Gmail'den Gmail'e).
/// Dezavantajı: Google'ın günlük gönderim sınırı (yeni hesaplarda daha düşük
/// olabilir) ve SendGrid'deki gibi bir teslimat/analytics paneli olmaması.
/// </summary>
public class GmailSmtpEmailSender : IEmailSender
{
    private readonly GmailSmtpOptions _options;
    private readonly ILogger<GmailSmtpEmailSender> _logger;

    public GmailSmtpEmailSender(IOptions<GmailSmtpOptions> options, ILogger<GmailSmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(
        string toEmail, string code, CancellationToken cancellationToken = default)
    {
        using var client = new SmtpClient("smtp.gmail.com", 587)
        {
            Credentials = new NetworkCredential(_options.Email, _options.AppPassword),
            EnableSsl = true
        };

        using var message = new MailMessage
        {
            From = new MailAddress(_options.Email, "MeetBrainz"),
            Subject = "MeetBrainz doğrulama kodunuz",
            IsBodyHtml = true,
            Body = $"""
                <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2 style="color: #241c08;">MeetBrainz doğrulama kodunuz</h2>
                  <p style="color: #4a3a1a;">Hesabınızı doğrulamak için aşağıdaki kodu girin:</p>
                  <div style="background: #f7b916; color: #241c08; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; border-radius: 12px; margin: 24px 0;">
                    {code}
                  </div>
                  <p style="color: #7a6a4a; font-size: 13px;">Bu kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
                </div>
                """
        };
        message.To.Add(toEmail);

        try
        {
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (SmtpException ex)
        {
            _logger.LogError(ex, "Gmail SMTP üzerinden {ToEmail} adresine mail gönderilemedi.", toEmail);
            throw;
        }
    }
}
