namespace api.Services;

public interface ISummarizationService
{
    Task<string> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default
    );
}