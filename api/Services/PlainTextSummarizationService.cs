namespace api.Services;

public class PlainTextSummarizationService : ISummarizationService
{
    private readonly ILogger<PlainTextSummarizationService> _logger;

    public PlainTextSummarizationService(
        ILogger<PlainTextSummarizationService> logger)
    {
        _logger = logger;
    }

    public Task<MeetingSummary> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "PlainTextSummarizationService kullanılıyor. Transcript uzunluğu: {Length}",
            transcript.Length
        );

        var summary = new MeetingSummary
        {
            GeneralSummary =
@"# Genel Özet

Toplantıda proje ilerleyişi konuşuldu.

## Kararlar

- Whisper.NET kullanılacak.
- Backend ASP.NET Core Minimal API olacak.

## Yapılacaklar

- Claude API eklenecek.
- PDF export hazırlanacak.",

            Decisions = new List<string>
            {
                "Whisper.NET kullanılacak.",
                "Backend ASP.NET Core Minimal API olacak."
            },

            ActionItems = new List<string>
            {
                "Claude API eklenecek.",
                "PDF export hazırlanacak."
            }
        };

        return Task.FromResult(summary);
    }
}