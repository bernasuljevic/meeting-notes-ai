namespace api.Services;

public class PlainTextSummarizationService
    : ISummarizationService
{
    public Task<string> SummarizeAsync(
        string transcript,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(transcript);
    }
}