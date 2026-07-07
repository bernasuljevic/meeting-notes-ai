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
            GeneralSummary = "Toplantıda proje ilerleyişi konuşuldu.",

            Decisions = new List<string>
            {
                "Whisper kullanılacak.",
                "Backend .NET olacak."
            },

            ActionItems = new List<string>
            {
                "Claude API eklenecek.",
                "PDF export yapılacak."
            }
        };

        return Task.FromResult(summary);
    }
}