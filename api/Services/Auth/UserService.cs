using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Models;

namespace api.Services.Auth;

public class UserService : IUserService
{
    private readonly AppDbContext _context;
    private readonly ITokenProtector _tokenProtector;

    public UserService(AppDbContext context, ITokenProtector tokenProtector)
    {
        _context = context;
        _tokenProtector = tokenProtector;
    }

    public async Task<(bool Success, string? Error, User? User)> RegisterAsync(
        string username, string password, CancellationToken cancellationToken = default)
    {
        username = username.Trim();

        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
        {
            return (false, "Kullanıcı adı en az 3 karakter olmalı.", null);
        }

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return (false, "Şifre en az 6 karakter olmalı.", null);
        }

        var exists = await _context.Users.AnyAsync(
            u => u.Username.ToLower() == username.ToLower(), cancellationToken);

        if (exists)
        {
            return (false, "Bu kullanıcı adı zaten alınmış.", null);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            PasswordHash = PasswordHasher.Hash(password),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

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
