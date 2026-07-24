using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using api.Options;
using api.Services;

namespace api.Services.Auth;

/// <summary>
/// Var olan ClaudeSummarizationService/OllamaSummarizationService/ClaudeChatService/
/// OllamaChatService, uygulama başlarken TEK bir sağlayıcıya sabitleniyor (bkz.
/// Program.cs, appsettings.json'daki Summarization:Provider). Login gerektiren
/// /api/summarize ve /api/meetings/{id}/chat uçları için bu yeterli değil, çünkü
/// her kullanıcının KENDİ sağlayıcı/model/token tercihiyle çağrı yapılması gerekiyor.
///
/// Bu servis o ihtiyacı karşılar: sağlayıcı/model/token, DI'da sabit değil, her
/// çağrıda parametre olarak geliyor. Şu an sadece "claude" ve "ollama" adları
/// gerçekten destekleniyor (büyük/küçük harf duyarsız); kullanıcı ayarlarına başka
/// bir isim girerse, çağrı anında anlaşılır bir hata döner.
/// </summary>
public class UserAiClient : IUserAiClient
{
    private const string ClaudeApiVersion = "2023-06-01";
    private const string ClaudeBaseUrl = "https://api.anthropic.com/";
    private const string ClaudeMessagesPath = "v1/messages";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OllamaOptions _ollamaOptions;
    private readonly ClaudeOptions _claudeDefaults;
    private readonly ILogger<UserAiClient> _logger;

    public UserAiClient(
        IHttpClientFactory httpClientFactory,
        IOptions<OllamaOptions> ollamaOptions,
        IOptions<ClaudeOptions> claudeDefaults,
        ILogger<UserAiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _ollamaOptions = ollamaOptions.Value;
        _claudeDefaults = claudeDefaults.Value;
        _logger = logger;
    }

    public Task<MeetingSummary> SummarizeAsync(
        string provider, string model, string? apiToken, string transcript,
        CancellationToken cancellationToken = default)
    {
        return provider.Trim().ToLowerInvariant() switch
        {
            "claude" => SummarizeWithClaudeAsync(model, apiToken, transcript, cancellationToken),
            "ollama" => SummarizeWithOllamaAsync(model, transcript, cancellationToken),
            _ => throw new InvalidOperationException(
                $"'{provider}' sağlayıcısı henüz desteklenmiyor. Şu an AI ayarlarında 'claude' ya da 'ollama' kullanabilirsin.")
        };
    }

    public Task<string> AskAsync(
        string provider, string model, string? apiToken, string transcript, string question,
        CancellationToken cancellationToken = default)
    {
        return provider.Trim().ToLowerInvariant() switch
        {
            "claude" => AskClaudeAsync(model, apiToken, transcript, question, cancellationToken),
            "ollama" => AskOllamaAsync(model, transcript, question, cancellationToken),
            _ => throw new InvalidOperationException(
                $"'{provider}' sağlayıcısı henüz desteklenmiyor. Şu an AI ayarlarında 'claude' ya da 'ollama' kullanabilirsin.")
        };
    }

    // ---------- Claude ----------

    private async Task<MeetingSummary> SummarizeWithClaudeAsync(
        string model, string? apiToken, string transcript, CancellationToken cancellationToken)
    {
        RequireClaudeToken(apiToken);

        var requestBody = new ClaudeRequest(
            model,
            _claudeDefaults.MaxTokens,
            0.2,
            BuildSummarizeSystemPrompt(),
            new List<ClaudeMessage> { new("user", transcript) });

        var responseBody = await SendClaudeRequestAsync(requestBody, apiToken!, cancellationToken);

        return ParseClaudeSummary(responseBody);
    }

    private async Task<string> AskClaudeAsync(
        string model, string? apiToken, string transcript, string question, CancellationToken cancellationToken)
    {
        RequireClaudeToken(apiToken);

        var userMessage = $"Toplantı transkripti:\n\n{transcript}\n\nSoru: {question}";

        var requestBody = new ClaudeRequest(
            model,
            _claudeDefaults.MaxTokens,
            0.2,
            BuildChatSystemPrompt(),
            new List<ClaudeMessage> { new("user", userMessage) });

        var responseBody = await SendClaudeRequestAsync(requestBody, apiToken!, cancellationToken);

        return ParseClaudeText(responseBody);
    }

    private static void RequireClaudeToken(string? apiToken)
    {
        if (string.IsNullOrWhiteSpace(apiToken))
        {
            throw new InvalidOperationException(
                "Claude kullanmak için AI ayarlarına kendi Claude API token'ını girmelisin.");
        }
    }

    private async Task<string> SendClaudeRequestAsync(
        ClaudeRequest requestBody, string apiToken, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(300);

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, ClaudeBaseUrl + ClaudeMessagesPath)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody, JsonOptions),
                Encoding.UTF8,
                "application/json")
        };

        httpRequest.Headers.Add("x-api-key", apiToken);
        httpRequest.Headers.Add("anthropic-version", ClaudeApiVersion);

        HttpResponseMessage response;

        try
        {
            response = await client.SendAsync(httpRequest, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Claude API isteği zaman aşımına uğradı.");
            throw new InvalidOperationException(
                "Claude API'ye ulaşılamadı (zaman aşımı). İnternet bağlantını ve API token'ını kontrol et.", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Claude API'ye ulaşılamadı.");
            throw new InvalidOperationException("Claude API'ye ulaşılamadı.", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Claude API hata döndürdü: {StatusCode} - {Body}", response.StatusCode, responseBody);

            var friendly = response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                ? "Claude API token'ın geçersiz görünüyor. AI ayarlarından kontrol et."
                : $"Claude API hata döndürdü ({(int)response.StatusCode}). Model adını ve token'ı kontrol et.";

            throw new InvalidOperationException(friendly);
        }

        return responseBody;
    }

    private MeetingSummary ParseClaudeSummary(string responseBody)
    {
        var text = ParseClaudeText(responseBody);
        var jsonText = StripCodeFences(text);

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

        return ToMeetingSummary(dto);
    }

    private string ParseClaudeText(string responseBody)
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

        return text.Trim();
    }

    // ---------- Ollama ----------

    private async Task<MeetingSummary> SummarizeWithOllamaAsync(
        string model, string transcript, CancellationToken cancellationToken)
    {
        var requestBody = new OllamaChatRequest(
            model,
            new List<OllamaMessage>
            {
                new("system", BuildSummarizeSystemPrompt()),
                new("user", transcript)
            },
            false,
            "json",
            new OllamaChatOptions(0.2));

        var responseBody = await SendOllamaRequestAsync(requestBody, cancellationToken);

        return ParseOllamaSummary(responseBody);
    }

    private async Task<string> AskOllamaAsync(
        string model, string transcript, string question, CancellationToken cancellationToken)
    {
        var userMessage = $"Toplantı transkripti:\n\n{transcript}\n\nSoru: {question}";

        var requestBody = new OllamaChatRequest(
            model,
            new List<OllamaMessage>
            {
                new("system", BuildChatSystemPrompt()),
                new("user", userMessage)
            },
            false,
            null,
            new OllamaChatOptions(0.2));

        var responseBody = await SendOllamaRequestAsync(requestBody, cancellationToken);

        return ParseOllamaText(responseBody);
    }

    private async Task<string> SendOllamaRequestAsync(
        OllamaChatRequest requestBody, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(300);

        var baseUrl = _ollamaOptions.BaseUrl.EndsWith('/') ? _ollamaOptions.BaseUrl : _ollamaOptions.BaseUrl + "/";

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, baseUrl + "api/chat")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody, JsonOptions),
                Encoding.UTF8,
                "application/json")
        };

        HttpResponseMessage response;

        try
        {
            response = await client.SendAsync(httpRequest, cancellationToken);
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
                "Yerel LLM'e (Ollama) ulaşılamadı. 'ollama serve' çalışıyor mu kontrol et.", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Ollama hata döndürdü: {StatusCode} - {Body}", response.StatusCode, responseBody);
            throw new InvalidOperationException(
                $"Ollama hata döndürdü ({(int)response.StatusCode}). Model adını kontrol et (ollama pull ile indirdin mi?).");
        }

        return responseBody;
    }

    private MeetingSummary ParseOllamaSummary(string responseBody)
    {
        var text = ParseOllamaText(responseBody);
        var jsonText = StripCodeFences(text);

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

        return ToMeetingSummary(dto);
    }

    private string ParseOllamaText(string responseBody)
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

        return text.Trim();
    }

    // ---------- Ortak yardımcılar ----------

    private static MeetingSummary ToMeetingSummary(MeetingSummaryDto dto) => new()
    {
        GeneralSummary = dto.GeneralSummary ?? string.Empty,
        Decisions = dto.Decisions ?? new List<string>(),
        ActionItems = dto.ActionItems ?? new List<string>(),
        OpenIssuesAndRisks = dto.OpenIssuesAndRisks ?? new List<string>(),
        KeyDiscussionPoints = dto.KeyDiscussionPoints ?? new List<string>()
    };

    private static string StripCodeFences(string text)
    {
        var trimmed = text.Trim();

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

    private static string BuildSummarizeSystemPrompt() => """
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
        - Konusmacilar transkriptte belirtilmemistir; belirli bir kisiye atif yapma.
        - Transkript otomatik uretildigi icin icinde kucuk yazim/tanima hatalari olabilir;
          bunlari baglamdan makul sekilde tolere et.
        - Transkriptte acikca gecmeyen hicbir bilgiyi uydurma; bir bolum icin icerik
          bulamazsan ilgili listeyi bos birak.
        - Tum cikti Turkce olsun.
        """;

    private static string BuildChatSystemPrompt() => """
        Sen bir toplanti asistanisin. Sana bir toplantinin otomatik konusma tanima (ASR) ile
        olusturulmus ham transkripti ve bu toplanti hakkinda bir soru verilecek.

        Kurallar:
        - SADECE transkriptte gecen bilgilere dayanarak cevap ver.
        - Transkriptte cevaba dair bir bilgi yoksa, bunu acikca belirt; uydurma bilgi verme.
        - Elinde zaman/dakika bilgisi olmadigi icin zaman damgasi uydurma.
        - Kisa ve net cevap ver, gereksiz uzatma.
        - Tum cikti Turkce olsun.
        """;

    private record ClaudeRequest(
        string Model,
        [property: JsonPropertyName("max_tokens")] int MaxTokens,
        double Temperature,
        string System,
        List<ClaudeMessage> Messages);

    private record ClaudeMessage(string Role, string Content);

    private record ClaudeResponse(List<ClaudeContentBlock>? Content);

    private record ClaudeContentBlock(string Type, string Text);

    private record OllamaChatRequest(
        string Model,
        List<OllamaMessage> Messages,
        bool Stream,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Format,
        OllamaChatOptions Options);

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
