namespace api.Services.MeetingService;

public record MeetingNoteDto(
    Guid Id,
    string MarkdownContent,
    string Model,
    DateTime CreatedAt
);