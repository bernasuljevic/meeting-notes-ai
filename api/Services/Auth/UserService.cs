using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using api.Data;
using api.Models;
using api.Services.Email;

namespace api.Services.Auth;

public partial class UserService : IUserService
{
    private static readonly TimeSpan VerificationCodeLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    private const int MaxVerificationAttempts = 5;

    private readonly AppDbContext _context;
    private readonly ITokenProtector _tokenProtector;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<UserService> _logger;

    public UserService(
        AppDbContext context,
        ITokenProtector tokenProtector,
        IEmailSender emailSender,
        ILogger<UserService> logger)
    {
        _context = context;
        _tokenProtector = tokenProtector;
        _emailSender = emailSender;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error, User? User)> RegisterAsync(
        string username, string email, string password, CancellationToken cancellationToken = default)
    {
        username = username.Trim();
        email = email.Trim();

        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
        {
            return (false, "Kullanıcı adı en az 3 karakter olmalı.", null);
        }

        if (string.IsNullOrWhiteSpace(email) || !EmailFormatRegex().IsMatch(email))
        {
            return (false, "Geçerli bir e-posta adresi girin.", null);
        }

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return (false, "Şifre en az 6 karakter olmalı.", null);
        }

        var usernameTaken = await _context.Users.AnyAsync(
            u => u.Username.ToLower() == username.ToLower(), cancellationToken);

        if (usernameTaken)
        {
            return (false, "Bu kullanıcı adı zaten alınmış.", null);
        }

        var emailTaken = await _context.Users.AnyAsync(
            u => u.Email.ToLower() == email.ToLower(), cancellationToken);

        if (emailTaken)
        {
            return (false, "Bu e-posta adresi zaten kayıtlı.", null);
        }

        var code = VerificationCodeHasher.GenerateCode();
        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = PasswordHasher.Hash(password),
            CreatedAt = now,
            IsEmailVerified = false,
            EmailVerificationCodeHash = VerificationCodeHasher.Hash(code),
            EmailVerificationCodeExpiresAt = now.Add(VerificationCodeLifetime),
            EmailVerificationAttempts = 0,
            LastVerificationCodeSentAt = now
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        await TrySendCodeAsync(user.Email, code, cancellationToken);

        return (true, null, user);
    }

    public async Task<User?> AuthenticateAsync(
        string username, string password, CancellationToken cancellationToken = default)
    {
        username = username.Trim();

        var user = await _context.Users.FirstOrDefaultAsync(
            u => u.Username.ToLower() == username.ToLower(), cancellationToken);

        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
        {
            return null;
        }

        return user;
    }

    public async Task<(bool Success, string? Error, User? User)> VerifyEmailAsync(
        string email, string code, CancellationToken cancellationToken = default)
    {
        email = email.Trim();

        var user = await _context.Users.FirstOrDefaultAsync(
            u => u.Email.ToLower() == email.ToLower(), cancellationToken);

        if (user is null)
        {
            return (false, "Bu e-posta adresiyle bir hesap bulunamadı.", null);
        }

        if (user.IsEmailVerified)
        {
            return (false, "Bu hesap zaten doğrulanmış.", null);
        }

        if (user.EmailVerificationCodeHash is null || user.EmailVerificationCodeExpiresAt is null
            || user.EmailVerificationCodeExpiresAt < DateTime.UtcNow)
        {
            return (false, "Kodun süresi doldu. Yeni bir kod isteyin.", null);
        }

        if (user.EmailVerificationAttempts >= MaxVerificationAttempts)
        {
            return (false, "Çok fazla yanlış deneme yapıldı. Yeni bir kod isteyin.", null);
        }

        if (!VerificationCodeHasher.Verify(code.Trim(), user.EmailVerificationCodeHash))
        {
            user.EmailVerificationAttempts++;
            await _context.SaveChangesAsync(cancellationToken);
            return (false, "Kod hatalı.", null);
        }

        user.IsEmailVerified = true;
        user.EmailVerificationCodeHash = null;
        user.EmailVerificationCodeExpiresAt = null;
        user.EmailVerificationAttempts = 0;

        await _context.SaveChangesAsync(cancellationToken);

        return (true, null, user);
    }

    public async Task<(bool Success, string? Error)> ResendVerificationCodeAsync(
        string email, CancellationToken cancellationToken = default)
    {
        email = email.Trim();

        var user = await _context.Users.FirstOrDefaultAsync(
            u => u.Email.ToLower() == email.ToLower(), cancellationToken);

        if (user is null)
        {
            return (false, "Bu e-posta adresiyle bir hesap bulunamadı.");
        }

        if (user.IsEmailVerified)
        {
            return (false, "Bu hesap zaten doğrulanmış.");
        }

        var now = DateTime.UtcNow;

        if (user.LastVerificationCodeSentAt is not null
            && now - user.LastVerificationCodeSentAt < ResendCooldown)
        {
            return (false, "Çok sık istek gönderdiniz, biraz bekleyip tekrar deneyin.");
        }

        var code = VerificationCodeHasher.GenerateCode();

        user.EmailVerificationCodeHash = VerificationCodeHasher.Hash(code);
        user.EmailVerificationCodeExpiresAt = now.Add(VerificationCodeLifetime);
        user.EmailVerificationAttempts = 0;
        user.LastVerificationCodeSentAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        await TrySendCodeAsync(user.Email, code, cancellationToken);

        return (true, null);
    }

    // Kod gönderimi best-effort - SendGrid (ya da şu an FakeEmailSender) hata
    // atarsa kayıt/resend isteğinin kendisi başarısız olmasın (kullanıcı zaten
    // "kodu tekrar gönder" ile deneyebilir); sadece loglanıyor.
    private async Task TrySendCodeAsync(string email, string code, CancellationToken cancellationToken)
    {
        try
        {
            await _emailSender.SendVerificationCodeAsync(email, code, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Doğrulama kodu {Email} adresine gönderilemedi.", email);
        }
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailFormatRegex();

    public Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

    public async Task<bool> UpdateAiSettingsAsync(
        Guid userId, string provider, string model, string? apiToken,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            return false;
        }

        user.AiProvider = provider.Trim();
        user.AiModel = model.Trim();

        // Token boş gönderilirse mevcut (şifrelenmiş) token'a DOKUNMUYORUZ —
        // frontend'de "token'ı değiştirmek istemiyorsan boş bırak" davranışı
        // bunu gerektiriyor. Token'ı gerçekten silmek isteyen bir kullanıcı
        // senaryosu şu an yok; ileride gerekirse ayrı bir "clear token" ucu
        // eklenebilir. Sadece dolu bir token gönderildiğinde şifreleyip yazıyoruz.
        if (!string.IsNullOrWhiteSpace(apiToken))
        {
            user.AiApiTokenEncrypted = _tokenProtector.Protect(apiToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<(string Provider, string Model, string? ApiToken)?> GetDecryptedAiSettingsAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null || string.IsNullOrWhiteSpace(user.AiProvider) || string.IsNullOrWhiteSpace(user.AiModel))
        {
            return null;
        }

        string? apiToken = null;

        if (!string.IsNullOrWhiteSpace(user.AiApiTokenEncrypted))
        {
            try
            {
                apiToken = _tokenProtector.Unprotect(user.AiApiTokenEncrypted);
            }
            catch (System.Security.Cryptography.CryptographicException)
            {
                // Şifre çözülemedi (örn. Data Protection anahtarları değişti) —
                // token'sız devam et; ilgili sağlayıcı token gerektiriyorsa zaten
                // anlaşılır bir hata dönecek.
                apiToken = null;
            }
        }

        return (user.AiProvider, user.AiModel, apiToken);
    }
}
