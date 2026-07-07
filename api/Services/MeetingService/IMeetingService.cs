using api.Models;

namespace api.Services;

public interface IMeetingService
{
    Task<Meeting> CreateMeetingAsync(
        string transcript,
        CancellationToken cancellationToken = default);
}