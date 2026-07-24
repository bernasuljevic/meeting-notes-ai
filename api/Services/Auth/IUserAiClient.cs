using api.Services;

namespace api.Services.Auth;

/// <summary>
/// /api/summarize ve /api/meetings/{id}/chat için, sunucu genelinde SABİT bir
/// sağlayıcı yerine, isteği yapan kullanıcının kendi seçtiği sağlayıcı/model/
/// token bilgisiyle AI çağrısı yapar.
/// </summary>
public interface IUserAiClient
{
    Task<MeetingSummary> SummarizeAsync(
        string provider, string model, string? apiToken, string transcript,
        CancellationToken cancellationToken = default);

    Task<string> AskAsync(
        string provider, string model, string? apiToken, string transcript, string question,
        CancellationToken cancellationToken = default);
}
