namespace api.Services;

public interface IMeetingChatService
{
    Task<string> AskAsync(
        string transcript,
        string question,
        CancellationToken cancellationToken = default
    );
}
