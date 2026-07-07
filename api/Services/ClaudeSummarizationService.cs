namespace api.Services;

public class ClaudeSummarizationService : ISummarizationService
{
    private readonly ILogger<ClaudeSummarizationService> _logger;

    public ClaudeSummarizationService(
        ILogger<ClaudeSummarizationService> logger)
    {
        _logger = logger;
    }

    public Task<MeetingSummary> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "ClaudeSummarizationService henüz aktif değil."
        );

        throw new NotImplementedException(
            "Claude API henüz yapılandırılmadı."
        );
    }
}