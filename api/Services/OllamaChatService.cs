using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services;

/// <summary>
/// Toplantı transkripti üzerinden serbest metin soru-cevap yapar (yerel LLM - Ollama).
/// Her soru bağımsız değerlendirilir; önceki sorular/cevaplar backend'e gönderilmez
/// (basit soru-cevap — çok turlu sohbet geçmişi tutulmaz).
/// </summary>
public class OllamaChatService : IMeetingChatService
{
    private const string ChatEndpoint = "api/chat";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _httpClient;
    private readonly OllamaOptions _options;
    private readonly ILogger<OllamaChatService> _logger;

    public OllamaChatService(
        HttpClient httpClient,
        IOptions<OllamaOptions> options,
        ILogger<OllamaChatService> logger)
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

        var requestBody = new OllamaChatRequest(
            _options.Model,
            new List<OllamaMessage>
            {
                new("system", BuildSystemPrompt()),
                new("user", userMessage)
            },
            false,
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

    private record OllamaChatRequest(
        string Model,
        List<OllamaMessage> Messages,
        bool Stream,
        OllamaChatOptions Options
    );

    private record OllamaMessage(string Role, string Content);

    private record OllamaChatOptions(double Temperature);

    private record OllamaChatResponse(OllamaResponseMessage? Message);

    private record OllamaResponseMessage(string Role, string Content);
}
