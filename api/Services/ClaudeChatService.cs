using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services;

/// <summary>
/// Toplantı transkripti üzerinden serbest metin soru-cevap yapar (Anthropic Claude API).
/// Her soru bağımsız değerlendirilir; önceki sorular/cevaplar backend'e gönderilmez
/// (basit soru-cevap — çok turlu sohbet geçmişi tutulmaz).
/// </summary>
public class ClaudeChatService : IMeetingChatService
{
    private const string ApiVersion = "2023-06-01";
    private const string MessagesEndpoint = "v1/messages";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _httpClient;
    private readonly ClaudeOptions _options;
    private readonly ILogger<ClaudeChatService> _logger;

    public ClaudeChatService(
        HttpClient httpClient,
        IOptions<ClaudeOptions> options,
        ILogger<ClaudeChatService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> AskAsync(
        string transcript,
        string question,
        CancellationToken cancellationToken = default)
    {
        var userMessage = $"Toplantı transkripti:\n\n{transcript}\n\nSoru: {question}";

        var requestBody = new ClaudeRequest(
            _options.Model,
            _options.MaxTokens,
            0.2,
            BuildSystemPrompt(),
            new List<ClaudeMessage> { new("user", userMessage) }
        );

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, MessagesEndpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody, JsonOptions),
                Encoding.UTF8,
                "application/json")
        };

        httpRequest.Headers.Add("x-api-key", _options.ApiKey);
        httpRequest.Headers.Add("anthropic-version", ApiVersion);

        HttpResponseMessage response;

        try
        {
            response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Claude API isteği zaman aşımına uğradı.");
            throw new InvalidOperationException(
                "Claude API'ye ulaşılamadı (zaman aşımı). İnternet bağlantını ve API anahtarını kontrol et.", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Claude API'ye ulaşılamadı.");
            throw new InvalidOperationException(
                "Claude API'ye ulaşılamadı, ayarları kontrol et.", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Claude API hata döndürdü: {StatusCode} - {Body}",
                response.StatusCode,
                responseBody);

            throw new InvalidOperationException(
                $"Claude API hata döndürdü ({(int)response.StatusCode}). API anahtarını ve model adını kontrol et.");
        }

        ClaudeResponse? claudeResponse;

        try
        {
            claudeResponse = JsonSerializer.Deserialize<ClaudeResponse>(responseBody, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Claude API yanıtı ayrıştırılamadı: {Body}", responseBody);
            throw new InvalidOperationException("Claude API yanıtı beklenmeyen formatta.", ex);
        }

        var text = claudeResponse?.Content?.FirstOrDefault(c => c.Type == "text")?.Text;

        if (string.IsNullOrWhiteSpace(text))
        {
            throw new InvalidOperationException("Claude API boş bir yanıt döndürdü.");
        }

        return text.Trim();
    }

    private static string BuildSystemPrompt() => """
        Sen bir toplanti asistanisin. Sana bir toplantinin otomatik konusma tanima (ASR) ile
        olusturulmus ham transkripti ve bu toplanti hakkinda bir soru verilecek.

        Kurallar:
        - SADECE transkriptte gecen bilgilere dayanarak cevap ver.
        - Transkriptte cevaba dair bir bilgi yoksa, bunu acikca belirt
          ("Bu transkriptte bu bilgiye rastlamadim." gibi); uydurma bilgi verme.
        - Elinde zaman/dakika bilgisi olmadigi icin zaman damgasi ("12. dakikada" gibi) uydurma.
        - Kisa ve net cevap ver, gereksiz uzatma.
        - Tum cikti Turkce olsun.
        """;

    private record ClaudeRequest(
        string Model,
        [property: JsonPropertyName("max_tokens")] int MaxTokens,
        double Temperature,
        string System,
        List<ClaudeMessage> Messages
    );

    private record ClaudeMessage(string Role, string Content);

    private record ClaudeResponse(List<ClaudeContentBlock>? Content);

    private record ClaudeContentBlock(string Type, string Text);
}
