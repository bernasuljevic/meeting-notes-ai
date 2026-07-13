using Whisper.net;

namespace api.Services;

public class TranscriptionService : IDisposable
{
    // Bir sonraki parçaya "bağlam" olarak geçilecek metnin üst sınırı. Whisper'ın
    // initial prompt'u zaten kendi içinde son token'larla sınırlanıyor
    // (WithMaxLastTextTokens); buradaki sınır sadece istemciden makul olmayan
    // uzunlukta bir metin gelirse savunma amaçlı.
    private const int MaxContextChars = 200;

    private readonly WhisperFactory _factory;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private readonly string _language;

    public TranscriptionService(IConfiguration configuration)
    {
        var modelPath = configuration["Whisper:ModelPath"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "Models", "ggml-base.bin");

        _language = configuration["Whisper:Language"] ?? "tr";

        Console.WriteLine($"Whisper modeli yükleniyor: {modelPath}");

        _factory = WhisperFactory.FromPath(modelPath);

        Console.WriteLine("Whisper modeli yüklendi.");
    }

    /// <summary>
    /// Bir ses parçasını Türkçe transkript eder. <paramref name="previousContext"/>
    /// verilirse (bir önceki parçanın transkript edilmiş metni), Whisper'a "initial
    /// prompt" olarak geçilir — parçalar birbirinden tamamen bağımsız işlendiği için,
    /// cümlenin bir parçanın sonunda kesilip diğerinin başında devam ettiği durumlarda
    /// doğruluğu artırmak amacıyla.
    /// </summary>
    public async Task<string> TranscribeAsync(Stream audioStream, string? previousContext = null)
    {
        // whisper.cpp context'i eşzamanlı çalışamaz — istekleri sıraya sok.
        await _semaphore.WaitAsync();

        try
        {
            var builder = _factory.CreateBuilder()
                .WithLanguage(_language);

            if (!string.IsNullOrWhiteSpace(previousContext))
            {
                var trimmedContext = previousContext.Length > MaxContextChars
                    ? previousContext[^MaxContextChars..]
                    : previousContext;

                builder = builder.WithPrompt(trimmedContext);
            }

            using var processor = builder.Build();

            var result = new System.Text.StringBuilder();

            await foreach (var segment in processor.ProcessAsync(audioStream))
            {
                result.Append(segment.Text).Append(' ');
            }

            return result.ToString().Trim();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public void Dispose()
    {
        _semaphore.Dispose();
        _factory.Dispose();
    }
}
