namespace api.Services;

public class MeetingSummary
{
    public string GeneralSummary { get; set; } = string.Empty;

    public List<string> Decisions { get; set; } = new();

    public List<string> ActionItems { get; set; } = new();

    public List<string> OpenIssuesAndRisks { get; set; } = new();

    public List<string> KeyDiscussionPoints { get; set; } = new();
}