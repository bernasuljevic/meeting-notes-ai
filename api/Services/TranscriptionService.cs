using Whisper.net;

namespace api.Services;

public class TranscriptionService : IDisposable
{
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

    public async Task<string> TranscribeAsync(Stream audioStream)
    {
        // whisper.cpp context'i eşzamanlı çalışamaz — istekleri sıraya sok.
        await _semaphore.WaitAsync();

        try
        {
            using var processor =
                _factory.CreateBuilder()
                    .WithLanguage(_language)
                    .Build();

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