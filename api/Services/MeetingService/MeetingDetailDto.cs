namespace api.Services.MeetingService;

public record MeetingDetailDto(
    Guid Id,
    string Title,
    DateTime StartedAt,
    DateTime? EndedAt,
    DateTime CreatedAt,
    List<TranscriptSegmentDto> TranscriptSegments,
    List<MeetingNoteDto> Notes
);