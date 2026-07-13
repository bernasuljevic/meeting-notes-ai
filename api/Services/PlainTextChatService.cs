namespace api.Services;

/// <summary>
/// Claude/Ollama yapılandırılmadığında kullanılan yer tutucu sohbet servisi.
/// Gerçek bir yapay zekâ değildir; durumu şeffaf şekilde bildirir.
/// </summary>
public class PlainTextChatService : IMeetingChatService
{
    private readonly ILogger<PlainTextChatService> _logger;

    public PlainTextChatService(ILogger<PlainTextChatService> logger)
    {
        _logger = logger;
    }

    public Task<string> AskAsync(
        string transcript,
        string question,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("PlainTextChatService ile soru alındı (yapay zekâ aktif değil).");

        return Task.FromResult(
            "Yapay zekâ sohbeti şu anda aktif değil (Claude veya Ollama sağlayıcısı ayarlanmadı). " +
            "Bu gerçek bir yanıt değil, bir yer tutucudur.");
    }
}
