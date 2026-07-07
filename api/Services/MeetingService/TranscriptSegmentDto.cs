namespace api.Services.MeetingService;

public record TranscriptSegmentDto(
    Guid Id,
    int Seq,
    string Text
);