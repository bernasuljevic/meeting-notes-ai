namespace api.Options;

public class ClaudeOptions
{
    public const string SectionName = "Claude";

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } =
        "claude-sonnet-4-20250514";

    public int MaxTokens { get; set; } = 4096;
}