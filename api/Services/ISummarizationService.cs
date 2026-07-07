namespace api.Services;

public interface ISummarizationService
{
    Task<MeetingSummary> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default
    );
}