using api.Data;

namespace api.Services.MeetingService;

public class MeetingService : IMeetingService
{
    private readonly AppDbContext _context;
    private readonly ISummarizationService _summarizationService;

    public MeetingService(
        AppDbContext context,
        ISummarizationService summarizationService)
    {
        _context = context;
        _summarizationService = summarizationService;
    }

    public async Task<api.Models.Meeting> CreateMeetingAsync(
    CreateMeetingRequest request,
    CancellationToken cancellationToken = default)
{
    var meeting = new api.Models.Meeting
    {
        Id = Guid.NewGuid(),
        Title = request.Title,
        StartedAt = request.StartedAt,
        EndedAt = request.EndedAt
    };

    meeting.TranscriptSegments.Add(
        new api.Models.TranscriptSegment
        {
            Id = Guid.NewGuid(),
            Seq = 1,
            Text = request.Transcript
        });

    meeting.Notes.Add(
        new api.Models.MeetingNote
        {
            Id = Guid.NewGuid(),
            MarkdownContent = request.Summary.GeneralSummary,
            Model = "Placeholder AI"
        });

    _context.Meetings.Add(meeting);

    await _context.SaveChangesAsync(cancellationToken);

    return meeting;
}

public Task<List<MeetingListItemDto>> GetMeetingsAsync(
    CancellationToken cancellationToken = default)
{
    throw new NotImplementedException();
}

public Task<MeetingDetailDto?> GetMeetingAsync(
    Guid id,
    CancellationToken cancellationToken = default)
{
    throw new NotImplementedException();
}
}