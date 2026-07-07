namespace api.Services.MeetingService;

public record MeetingListItemDto(
    Guid Id,
    string Title,
    DateTime StartedAt,
    DateTime? EndedAt,
    DateTime CreatedAt
);