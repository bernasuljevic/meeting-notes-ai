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
            "PlainTextSummarizationService kullanılıyor (placeholder — Claude API entegrasyonu bekleniyor). Transcript uzunluğu: {Length}",
            transcript.Length
        );

        var preview = transcript.Length > 200
            ? transcript[..200] + "…"
            : transcript;

        var summary = new MeetingSummary
        {
            GeneralSummary =
$@"Genel Özet (yer tutucu)

Bu not gerçek bir LLM özetlemesi değildir — Claude API entegrasyonu eklenene kadar geçici bir yer tutucudur.

Alınan transkript ({transcript.Length} karakter):

""{preview}""",

            Decisions = new List<string>(),
            ActionItems = new List<string>(),
            OpenIssuesAndRisks = new List<string>(),
            KeyDiscussionPoints = new List<string>()
        };

        return Task.FromResult(summary);
    }
}