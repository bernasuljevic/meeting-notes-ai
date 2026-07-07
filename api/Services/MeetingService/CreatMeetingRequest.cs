using api.Services;

namespace api.Services.MeetingService;

public record CreateMeetingRequest(
    string Title,
    DateTime StartedAt,
    DateTime? EndedAt,
    string Transcript,
    MeetingSummary Summary
);