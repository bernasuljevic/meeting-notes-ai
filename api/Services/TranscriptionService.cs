using Whisper.net;

namespace api.Services;

public class TranscriptionService
{
    private readonly WhisperFactory _factory;

    public TranscriptionService()
    {
        var modelPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "Models",
            "ggml-base.bin"
        );

        Console.WriteLine(
            $"Whisper modeli yükleniyor: {modelPath}"
        );

        _factory = WhisperFactory.FromPath(modelPath);

        Console.WriteLine(
            "Whisper modeli yüklendi."
        );
    }

    public async Task<string> TranscribeAsync(
        Stream audioStream)
    {
        using var processor =
            _factory.CreateBuilder()
                .WithLanguage("tr")
                .Build();

        string result = "";

        await foreach (
            var segment in
            processor.ProcessAsync(audioStream))
        {
            result += segment.Text + " ";
        }

        return result.Trim();
    }
}