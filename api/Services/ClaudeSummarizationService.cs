using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services;

public class ClaudeSummarizationService : ISummarizationService
{
    private const string ApiVersion = "2023-06-01";
    private const string MessagesEndpoint = "v1/messages";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _httpClient;
    private readonly ClaudeOptions _options;
    private readonly ILogger<ClaudeSummarizationService> _logger;

    public ClaudeSummarizationService(
        HttpClient httpClient,
        IOptions<ClaudeOptions> options,
        ILogger<ClaudeSummarizationService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<MeetingSummary> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default)
    {
        var requestBody = new ClaudeRequest(
            _options.Model,
            _options.MaxTokens,
            0.2,
            BuildSystemPrompt(),
            new List<ClaudeMessage> { new("user", transcript) }
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

        return ParseSummary(responseBody);
    }

    private MeetingSummary ParseSummary(string responseBody)
    {
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

        var jsonText = ExtractJson(text);

        MeetingSummaryDto? dto;

        try
        {
            dto = JsonSerializer.Deserialize<MeetingSummaryDto>(jsonText, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Claude'un ürettiği özet JSON'u ayrıştırılamadı: {Text}", text);
            throw new InvalidOperationException("Claude'dan gelen özet beklenen JSON formatında değil.", ex);
        }

        if (dto is null)
        {
            throw new InvalidOperationException("Claude'dan gelen özet boş.");
        }

        return new MeetingSummary
        {
            GeneralSummary = dto.GeneralSummary ?? string.Empty,
            Decisions = dto.Decisions ?? new List<string>(),
            ActionItems = dto.ActionItems ?? new List<string>(),
            OpenIssuesAndRisks = dto.OpenIssuesAndRisks ?? new List<string>(),
            KeyDiscussionPoints = dto.KeyDiscussionPoints ?? new List<string>()
        };
    }

    private static string ExtractJson(string text)
    {
        var trimmed = text.Trim();

        // Claude bazen JSON'u ```json ... ``` blogu icine sarabilir; olasi fence'leri temizle.
        if (trimmed.StartsWith("```"))
        {
            var firstNewline = trimmed.IndexOf('\n');
            var withoutOpeningFence = firstNewline >= 0 ? trimmed[(firstNewline + 1)..] : trimmed;

            var closingFenceIndex = withoutOpeningFence.LastIndexOf("```", StringComparison.Ordinal);
            trimmed = closingFenceIndex >= 0
                ? withoutOpeningFence[..closingFenceIndex]
                : withoutOpeningFence;
        }

        return trimmed.Trim();
    }

    private static string BuildSystemPrompt() => """
        Sen bir toplanti asistanisin. Sana bir toplantinin otomatik konusma tanima (ASR) ile
        olusturulmus ham transkripti verilecek. Gorevin bu transkripti analiz edip SADECE
        asagidaki alanlari iceren gecerli bir JSON nesnesi dondurmek:

        {
          "generalSummary": string,
          "decisions": string[],
          "actionItems": string[],
          "openIssuesAndRisks": string[],
          "keyDiscussionPoints": string[]
        }

        Kurallar:
        - Yanitin SADECE bu JSON nesnesi olsun; JSON disinda hicbir aciklama, baslik veya
          kod blogu isareti ekleme.
        - Konusmacilar transkriptte belirtilmemistir; belirli bir kisiye atif yapma
          ("Ahmet sunu soyledi" gibi ifadeler kullanma).
        - Transkript otomatik uretildigi icin icinde kucuk yazim/tanima hatalari olabilir;
          bunlari baglamdan makul sekilde tolere et, hata oldugunu ayrica belirtme.
        - Transkriptte acikca gecmeyen hicbir bilgiyi uydurma; bir bolum icin icerik
          bulamazsan ilgili listeyi bos birak.
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

    private class MeetingSummaryDto
    {
        public string? GeneralSummary { get; set; }
        public List<string>? Decisions { get; set; }
        public List<string>? ActionItems { get; set; }
        public List<string>? OpenIssuesAndRisks { get; set; }
        public List<string>? KeyDiscussionPoints { get; set; }
    }
}