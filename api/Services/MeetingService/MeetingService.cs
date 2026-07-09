using api.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text;

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
                MarkdownContent = BuildMarkdownSummary(request.Summary),
                Model = "Placeholder AI"
            });

        _context.Meetings.Add(meeting);

        await _context.SaveChangesAsync(cancellationToken);

        return meeting;
    }

    public async Task<List<MeetingListItemDto>> GetMeetingsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Meetings
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new MeetingListItemDto(
                m.Id,
                m.Title,
                m.StartedAt,
                m.EndedAt,
                m.CreatedAt
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<MeetingDetailDto?> GetMeetingAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.Meetings
            .Where(m => m.Id == id)
            .Select(m => new MeetingDetailDto(
                m.Id,
                m.Title,
                m.StartedAt,
                m.EndedAt,
                m.CreatedAt,

                m.TranscriptSegments
                    .OrderBy(t => t.Seq)
                    .Select(t => new TranscriptSegmentDto(
                        t.Id,
                        t.Seq,
                        t.Text
                    ))
                    .ToList(),

                m.Notes
                    .Select(n => new MeetingNoteDto(
                        n.Id,
                        n.MarkdownContent,
                        n.Model,
                        n.CreatedAt
                    ))
                    .ToList()
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string BuildMarkdownSummary(MeetingSummary summary)
    {
        var sb = new StringBuilder();

        sb.AppendLine("## Özet");
        sb.AppendLine();
        sb.AppendLine(summary.GeneralSummary);
        sb.AppendLine();

        sb.AppendLine("## Alınan Kararlar");
        sb.AppendLine();
        AppendBulletsOrFallback(sb, summary.Decisions, "Karar bulunamadı.");
        sb.AppendLine();

        sb.AppendLine("## Aksiyon Maddeleri");
        sb.AppendLine();
        AppendBulletsOrFallback(sb, summary.ActionItems, "Aksiyon maddesi bulunamadı.");
        sb.AppendLine();

        sb.AppendLine("## Açık Konular ve Riskler");
        sb.AppendLine();
        AppendBulletsOrFallback(sb, summary.OpenIssuesAndRisks, "Açık konu veya risk bulunamadı.");
        sb.AppendLine();

        sb.AppendLine("## Önemli Tartışma Noktaları");
        sb.AppendLine();
        AppendBulletsOrFallback(sb, summary.KeyDiscussionPoints, "Önemli tartışma noktası bulunamadı.");

        return sb.ToString();
    }

    private static void AppendBulletsOrFallback(StringBuilder sb, List<string> items, string fallbackText)
    {
        if (items.Count > 0)
        {
            foreach (var item in items)
            {
                sb.AppendLine($"- {item}");
            }
        }
        else
        {
            sb.AppendLine($"_{fallbackText}_");
        }
    }
}