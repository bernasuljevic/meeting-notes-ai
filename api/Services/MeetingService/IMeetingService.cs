using api.Models;

namespace api.Services.MeetingService;

public interface IMeetingService
{
    Task<Meeting> CreateMeetingAsync(
        CreateMeetingRequest request,
        CancellationToken cancellationToken = default);

    Task<List<MeetingListItemDto>> GetMeetingsAsync(
        CancellationToken cancellationToken = default);

    Task<MeetingDetailDto?> GetMeetingAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}