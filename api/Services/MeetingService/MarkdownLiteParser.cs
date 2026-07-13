namespace api.Services.MeetingService;

public enum MdBlockType
{
    Heading,
    Bullet,
    Paragraph
}

public record MdBlock(MdBlockType Type, string Text);

/// <summary>
/// MeetingService.BuildMarkdownSummary tarafından üretilen, sınırlı ve bilinen
/// bir markdown alt kümesini (## başlık, - madde, _italik_) ayrıştırır.
/// Genel amaçlı bir markdown ayrıştırıcı değildir; sadece bu projenin kendi
/// ürettiği özet formatını dışa aktarma (docx/pdf) amacıyla çözer.
/// </summary>
public static class MarkdownLiteParser
{
    public static List<MdBlock> Parse(string markdown)
    {
        var blocks = new List<MdBlock>();

        if (string.IsNullOrWhiteSpace(markdown))
        {
            return blocks;
        }

        var lines = markdown.Replace("\r\n", "\n").Split('\n');

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();

            if (string.IsNullOrEmpty(line))
            {
                continue;
            }

            if (line.StartsWith("## ", StringComparison.Ordinal))
            {
                blocks.Add(new MdBlock(MdBlockType.Heading, line[3..].Trim()));
            }
            else if (line.StartsWith("- ", StringComparison.Ordinal))
            {
                blocks.Add(new MdBlock(MdBlockType.Bullet, line[2..].Trim()));
            }
            else if (line.Length > 2 && line.StartsWith('_') && line.EndsWith('_'))
            {
                blocks.Add(new MdBlock(MdBlockType.Paragraph, line.Trim('_')));
            }
            else
            {
                blocks.Add(new MdBlock(MdBlockType.Paragraph, line));
            }
        }

        return blocks;
    }
}
