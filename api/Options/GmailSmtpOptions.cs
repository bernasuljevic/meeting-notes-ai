namespace api.Options;

public class GmailSmtpOptions
{
    public const string SectionName = "GmailSmtp";

    // Gönderen Gmail adresi - Google Hesabı'nda 2 Adımlı Doğrulama açıkken
    // üretilen bir "Uygulama Şifresi" ile birlikte kullanılır (normal Gmail
    // şifresi SMTP için kabul edilmiyor).
    public string Email { get; set; } = string.Empty;

    public string AppPassword { get; set; } = string.Empty;
}
