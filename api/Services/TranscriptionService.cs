using Whisper.net;

namespace api.Services;

public class TranscriptionService
{
    private readonly string _modelPath;

    public TranscriptionService()
    {
        _modelPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "Models",
            "ggml-base.bin"
        );
    }

    public async Task<string> TranscribeAsync(
        Stream audioStream)
    {
        using var factory =
            WhisperFactory.FromPath(_modelPath);

        using var processor =
            factory.CreateBuilder()
                .WithLanguage("tr")
                .Build();

        string result = "";

        await foreach (var segment in
            processor.ProcessAsync(audioStream))
        {
            result += segment.Text + " ";
        }

        return result.Trim();
    }
}