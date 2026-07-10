using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services;

/// <summary>
/// Yerel olarak calisan bir LLM (Ollama - https://ollama.com) uzerinden ozetleme yapar.
/// Transkript hicbir zaman kurum disina cikmaz; hassas toplantilarda Claude API yerine
/// tercih edilebilecek "provider" secenegi olarak eklenmistir.
/// </summary>
public class OllamaSummarizationService : ISummarizationService
{
    private const string ChatEndpoint = "api/chat";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _httpClient;
    private readonly OllamaOptions _options;
    private readonly ILogger<OllamaSummarizationService> _logger;

    public OllamaSummarizationService(
        HttpClient httpClient,
        IOptions<OllamaOptions> options,
        ILogger<OllamaSummarizationService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<MeetingSummary> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default)
    {
        var requestBody = new OllamaChatRequest(
            _options.Model,
            new List<OllamaMessage>
            {
                new("system", BuildSystemPrompt()),
                new("user", transcript)
            },
            false,
            "json",
            new OllamaChatOptions(0.2)
        );

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, ChatEndpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody, JsonOptions),
                Encoding.UTF8,
                "application/json")
        };

        HttpResponseMessage response;

        try
        {
            response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Ollama isteği zaman aşımına uğradı.");
            throw new InvalidOperationException(
                "Yerel LLM'e (Ollama) ulaşılamadı (zaman aşımı). Ollama'nın çalıştığından ve modelin indirildiğinden emin ol.", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Ollama'ya ulaşılamadı.");
            throw new InvalidOperationException(
                "Yerel LLM'e (Ollama) ulaşılamadı. 'ollama serve' çalışıyor mu ve Ollama:BaseUrl ayarı doğru mu kontrol et.", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Ollama hata döndürdü: {StatusCode} - {Body}",
                response.StatusCode,
                responseBody);

            throw new InvalidOperationException(
                $"Ollama hata döndürdü ({(int)response.StatusCode}). Model adını ve Ollama sunucusunun çalıştığını kontrol et.");
        }

        return ParseSummary(responseBody);
    }

    private MeetingSummary ParseSummary(string responseBody)
    {
        OllamaChatResponse? ollamaResponse;

        try
        {
            ollamaResponse = JsonSerializer.Deserialize<OllamaChatResponse>(responseBody, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Ollama yanıtı ayrıştırılamadı: {Body}", responseBody);
            throw new InvalidOperationException("Ollama yanıtı beklenmeyen formatta.", ex);
        }

        var text = ollamaResponse?.Message?.Content;

        if (string.IsNullOrWhiteSpace(text))
        {
            throw new InvalidOperationException("Ollama boş bir yanıt döndürdü.");
        }

        var jsonText = ExtractJson(text);

        MeetingSummaryDto? dto;

        try
        {
            dto = JsonSerializer.Deserialize<MeetingSummaryDto>(jsonText, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Ollama'nın ürettiği özet JSON'u ayrıştırılamadı: {Text}", text);
            throw new InvalidOperationException("Ollama'dan gelen özet beklenen JSON formatında değil.", ex);
        }

        if (dto is null)
        {
            throw new InvalidOperationException("Ollama'dan gelen özet boş.");
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

        // Bazi yerel modeller JSON'u ```json ... ``` blogu icine sarabilir; olasi fence'leri temizle.
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
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

    private record OllamaChatRequest(
        string Model,
        List<OllamaMessage> Messages,
        bool Stream,
        string Format,
        OllamaChatOptions Options
    );

    private record OllamaMessage(string Role, string Content);

    private record OllamaChatOptions(double Temperature);

    private record OllamaChatResponse(OllamaResponseMessage? Message);

    private record OllamaResponseMessage(string Role, string Content);

    private class MeetingSummaryDto
    {
        public string? GeneralSummary { get; set; }
        public List<string>? Decisions { get; set; }
        public List<string>? ActionItems { get; set; }
        public List<string>? OpenIssuesAndRisks { get; set; }
        public List<string>? KeyDiscussionPoints { get; set; }
    }
}
