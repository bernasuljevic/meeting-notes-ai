using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using api.Options;

namespace api.Services;

/// <summary>
/// Yerel olarak calisan bir LLM (Ollama - https://ollama.com) uzerinden ozetleme yapar.
/// Transkript hicbir zaman kurum disina cikmaz; hassas toplantilarda Claude API yerine
/// tercih edilebilecek "provider" secenegi olarak eklenmistir.
///
/// Uzun toplantilar icin MapReduce: transkript, OllamaOptions.MaxDirectCharacters'i
/// asarsa once parcalara bolunup her parcadan kisa maddeler cikarilir ("map"), sonra bu
/// maddeler birlestirilip ayni yapisal JSON semasiyla tekrar ozetlenir ("reduce"). Bu,
/// yerel modellerin (genelde Claude'a gore cok daha dar olan) context penceresini
/// transkriptin sessizce kirpilmasina izin vermeden asmamizi saglar.
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
        if (transcript.Length <= _options.MaxDirectCharacters)
        {
            return await SummarizeContentAsync(transcript, cancellationToken);
        }

        var chunks = SplitIntoChunks(transcript, _options.ChunkCharacters);

        _logger.LogInformation(
            "Transkript {Length} karakter, doğrudan özetleme eşiğini ({Threshold}) aşıyor; " +
            "{ChunkCount} parçaya bölünüp MapReduce özetlemeye geçiliyor.",
            transcript.Length, _options.MaxDirectCharacters, chunks.Count);

        var chunkNotes = new List<string>(chunks.Count);

        for (var i = 0; i < chunks.Count; i++)
        {
            var extracted = await ExtractChunkKeyPointsAsync(chunks[i], i + 1, chunks.Count, cancellationToken);
            chunkNotes.Add($"## Parça {i + 1} Notları\n{extracted}");

            _logger.LogInformation("Parça {Index}/{Total} işlendi.", i + 1, chunks.Count);
        }

        var combinedNotes = string.Join("\n\n", chunkNotes);

        return await SummarizeContentAsync(combinedNotes, cancellationToken);
    }

    /// <summary>
    /// Transkripti (veya MapReduce'un "reduce" adımında, parça notlarının birleşimini)
    /// mevcut yapısal JSON şemasıyla tek seferde özetler. Doğrudan-özetleme ve
    /// MapReduce'un son adımı bu metodu paylaşır.
    /// </summary>
    private async Task<MeetingSummary> SummarizeContentAsync(
        string content,
        CancellationToken cancellationToken)
    {
        var requestBody = new OllamaChatRequest(
            _options.Model,
            new List<OllamaMessage>
            {
                new("system", BuildSystemPrompt()),
                new("user", content)
            },
            false,
            "json",
            new OllamaChatOptions(0.2, _options.NumCtx)
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

    /// <summary>
    /// MapReduce'un "map" adımı: tek bir parçadan, yapısal JSON değil, kısa düz metin
    /// maddeler halinde önemli noktalar çıkarır. Bu notlar daha sonra tüm parçalar için
    /// birleştirilip son "reduce" adımında tekrar özetlenir.
    /// </summary>
    private async Task<string> ExtractChunkKeyPointsAsync(
        string chunk,
        int index,
        int total,
        CancellationToken cancellationToken)
    {
        var requestBody = new OllamaChatRequest(
            _options.Model,
            new List<OllamaMessage>
            {
                new("system", BuildChunkExtractionPrompt(index, total)),
                new("user", chunk)
            },
            false,
            null,
            new OllamaChatOptions(0.2, _options.NumCtx)
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
            _logger.LogError(ex, "Ollama isteği (parça {Index}/{Total}) zaman aşımına uğradı.", index, total);
            throw new InvalidOperationException(
                "Yerel LLM'e (Ollama) ulaşılamadı (zaman aşımı). Ollama'nın çalıştığından ve modelin indirildiğinden emin ol.", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Ollama'ya ulaşılamadı (parça {Index}/{Total}).", index, total);
            throw new InvalidOperationException(
                "Yerel LLM'e (Ollama) ulaşılamadı. 'ollama serve' çalışıyor mu ve Ollama:BaseUrl ayarı doğru mu kontrol et.", ex);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Ollama hata döndürdü (parça {Index}/{Total}): {StatusCode} - {Body}",
                index, total, response.StatusCode, responseBody);

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
            _logger.LogError(
                ex, "Ollama yanıtı (parça {Index}/{Total}) ayrıştırılamadı: {Body}", index, total, responseBody);
            throw new InvalidOperationException("Ollama yanıtı beklenmeyen formatta.", ex);
        }

        var text = ollamaResponse?.Message?.Content;

        return string.IsNullOrWhiteSpace(text)
            ? "Bu parçada önemli bir nokta bulunamadı."
            : StripCodeFences(text).Trim();
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

        return new MeetingSummary
        {
            GeneralSummary = dto.GeneralSummary ?? string.Empty,
            Decisions = dto.Decisions ?? new List<string>(),
            ActionItems = dto.ActionItems ?? new List<string>(),
            OpenIssuesAndRisks = dto.OpenIssuesAndRisks ?? new List<string>(),
            KeyDiscussionPoints = dto.KeyDiscussionPoints ?? new List<string>()
        };
    }

    private static string StripCodeFences(string text)
    {
        var trimmed = text.Trim();

        // Bazi yerel modeller ciktiyi ```json ... ``` (ya da duz ``` ... ```) blogu
        // icine sarabilir; olasi fence'leri temizle.
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

    /// <summary>
    /// Transkripti kelime sinirlarindan kesmeden, hedef karakter boyutuna gore ardisik
    /// parcalara boler. Cok basit ama yeterli: cumle/paragraf sinirlarini aramaz, sadece
    /// kelime ortasinda kesmemeyi garanti eder.
    /// </summary>
    private static List<string> SplitIntoChunks(string transcript, int chunkCharacters)
    {
        var words = transcript.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var chunks = new List<string>();
        var current = new StringBuilder();

        foreach (var word in words)
        {
            if (current.Length > 0 && current.Length + word.Length + 1 > chunkCharacters)
            {
                chunks.Add(current.ToString().Trim());
                current.Clear();
            }

            current.Append(word).Append(' ');
        }

        if (current.Length > 0)
        {
            chunks.Add(current.ToString().Trim());
        }

        return chunks;
    }

    private static string BuildSystemPrompt() => """
        Sen bir toplanti asistanisin. Sana bir toplantinin otomatik konusma tanima (ASR) ile
        olusturulmus ham transkripti (ya da uzun bir transkriptin parca parca cikarilmis
        notlarinin birlesimi) verilecek. Gorevin bunu analiz edip SADECE asagidaki alanlari
        iceren gecerli bir JSON nesnesi dondurmek:

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
        - Girdi, parca parca cikarilmis notlarin birlesimiyse ("## Parça N Notları" basliklari
          gorursen), bunlari tek bir toplantinin farkli bolumleri gibi degerlendirip
          tekrarlari birlestir.
        - Transkriptte acikca gecmeyen hicbir bilgiyi uydurma; bir bolum icin icerik
          bulamazsan ilgili listeyi bos birak.
        - Tum cikti Turkce olsun.
        """;

    private static string BuildChunkExtractionPrompt(int index, int total) => $"""
        Sen bir toplanti asistanisin. Bu, uzun bir toplantinin otomatik konusma tanima (ASR)
        ile olusturulmus transkriptinin {index}/{total}. parcasi; transkript bu parcadan
        once/sonra da devam ediyor olabilir, bu parcayi kendi icinde degerlendir.

        Bu parcadan onemli noktalari KISA maddeler halinde cikar: konusulan konular, alinan
        kararlar (varsa), aksiyon maddeleri (varsa), acik konular/riskler (varsa). Sadece duz
        metin madde listesi don; JSON, baslik veya ek aciklama ekleme. Bu parcada ilgili bir
        sey yoksa tek satirda "Bu parçada önemli bir nokta yok." yaz. Konusmacilar
        belirtilmemistir, belirli bir kisiye atif yapma. Turkce yaz.
        """;

    private record OllamaChatRequest(
        string Model,
        List<OllamaMessage> Messages,
        bool Stream,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Format,
        OllamaChatOptions Options
    );

    private record OllamaMessage(string Role, string Content);

    private record OllamaChatOptions(
        double Temperature,
        [property: JsonPropertyName("num_ctx")] int NumCtx
    );

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
