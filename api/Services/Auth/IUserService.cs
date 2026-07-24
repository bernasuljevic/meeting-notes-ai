using api.Models;

namespace api.Services.Auth;

public interface IUserService
{
    Task<(bool Success, string? Error, User? User)> RegisterAsync(
        string username, string password, CancellationToken cancellationToken = default);

    Task<User?> AuthenticateAsync(
        string username, string password, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> UpdateAiSettingsAsync(
        Guid userId, string provider, string model, string? apiToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Kullanıcının AI çağrısı yapmak için ihtiyaç duyduğu bilgileri, şifresi
    /// çözülmüş halde döner (provider, model, düz metin token). Sadece istek
    /// anında bellekte kullanılır; hiçbir yerde düz metin olarak saklanmaz.
    /// AI ayarı hiç yapılmamışsa null döner.
    /// </summary>
    Task<(string Provider, string Model, string? ApiToken)?> GetDecryptedAiSettingsAsync(
        Guid userId, CancellationToken cancellationToken = default);
}
