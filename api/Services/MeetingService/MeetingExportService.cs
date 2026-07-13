using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace api.Services.MeetingService;

/// <summary>
/// Bir toplantıyı (transkript + yapay zekâ özeti) .docx ve .pdf olarak dışa aktarır.
/// Word tarafı Microsoft'un kendi ücretsiz DocumentFormat.OpenXml kütüphanesini,
/// PDF tarafı QuestPDF'i (Community lisansı) kullanır.
/// "W." öneki, DocumentFormat.OpenXml.Wordprocessing tiplerini (Paragraph, Run, Text vb.)
/// QuestPDF.Fluent'in kendi tipleriyle (ör. Document) çakışmadan kullanabilmek içindir.
/// </summary>
public class MeetingExportService : IMeetingExportService
{
    public byte[] GenerateDocx(MeetingDetailDto meeting)
    {
        using var stream = new MemoryStream();

        using (var wordDocument = WordprocessingDocument.Create(
            stream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDocument.AddMainDocumentPart();
            mainPart.Document = new W.Document();
            var body = mainPart.Document.AppendChild(new W.Body());

            body.AppendChild(CreateHeadingParagraph(meeting.Title, 20));
            body.AppendChild(CreateMetaParagraph(meeting));

            body.AppendChild(CreateHeadingParagraph("Konuşma Metni", 14));
            body.AppendChild(CreateBodyParagraph(BuildTranscriptText(meeting)));

            body.AppendChild(CreateHeadingParagraph("Yapay Zekâ Özeti", 14));

            if (meeting.Notes.Count == 0)
            {
                body.AppendChild(CreateBodyParagraph("Henüz yapay zekâ özeti oluşturulmamış."));
            }
            else
            {
                foreach (var note in meeting.Notes)
                {
                    foreach (var block in MarkdownLiteParser.Parse(note.MarkdownContent))
                    {
                        body.AppendChild(block.Type switch
                        {
                            MdBlockType.Heading => CreateHeadingParagraph(block.Text, 12),
                            MdBlockType.Bullet => CreateBulletParagraph(block.Text),
                            _ => CreateBodyParagraph(block.Text)
                        });
                    }
                }
            }

            mainPart.Document.Save();
        }

        return stream.ToArray();
    }

    public byte[] GeneratePdf(MeetingDetailDto meeting)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var transcriptText = BuildTranscriptText(meeting);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(11));

                page.Header().Column(column =>
                {
                    column.Item().Text(meeting.Title).FontSize(18).Bold();
                    column.Item().PaddingTop(4).Text(BuildMetaText(meeting))
                        .FontSize(9)
                        .FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingTop(15).Column(column =>
                {
                    column.Spacing(8);

                    column.Item().Text("Konuşma Metni").FontSize(13).Bold();
                    column.Item().Text(transcriptText);

                    column.Item().PaddingTop(6).Text("Yapay Zekâ Özeti").FontSize(13).Bold();

                    if (meeting.Notes.Count == 0)
                    {
                        column.Item().Text("Henüz yapay zekâ özeti oluşturulmamış.");
                    }
                    else
                    {
                        foreach (var note in meeting.Notes)
                        {
                            foreach (var block in MarkdownLiteParser.Parse(note.MarkdownContent))
                            {
                                switch (block.Type)
                                {
                                    case MdBlockType.Heading:
                                        column.Item().PaddingTop(4).Text(block.Text).FontSize(11).Bold();
                                        break;
                                    case MdBlockType.Bullet:
                                        column.Item().Text($"•  {block.Text}");
                                        break;
                                    default:
                                        column.Item().Text(block.Text);
                                        break;
                                }
                            }
                        }
                    }
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.CurrentPageNumber();
                    x.Span(" / ");
                    x.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    private static string BuildTranscriptText(MeetingDetailDto meeting)
    {
        var text = string.Join(" ", meeting.TranscriptSegments.Select(s => s.Text));
        return string.IsNullOrWhiteSpace(text) ? "Konuşma metni bulunamadı." : text;
    }

    private static string BuildMetaText(MeetingDetailDto meeting)
    {
        var text = $"Başlangıç: {meeting.StartedAt:dd.MM.yyyy HH:mm}";

        if (meeting.EndedAt.HasValue)
        {
            text += $"   Bitiş: {meeting.EndedAt.Value:dd.MM.yyyy HH:mm}";
        }

        return text;
    }

    private static W.Paragraph CreateHeadingParagraph(string text, int pointSize)
    {
        var runProperties = new W.RunProperties(
            new W.Bold(),
            new W.FontSize { Val = (pointSize * 2).ToString() });

        var run = new W.Run(runProperties, new W.Text(text));

        return new W.Paragraph(
            new W.ParagraphProperties(
                new W.SpacingBetweenLines { Before = "240", After = "120" }),
            run);
    }

    private static W.Paragraph CreateMetaParagraph(MeetingDetailDto meeting)
    {
        var runProperties = new W.RunProperties(
            new W.Color { Val = "666666" },
            new W.FontSize { Val = "18" });

        var run = new W.Run(runProperties, new W.Text(BuildMetaText(meeting)));

        return new W.Paragraph(
            new W.ParagraphProperties(
                new W.SpacingBetweenLines { After = "200" }),
            run);
    }

    private static W.Paragraph CreateBodyParagraph(string text)
    {
        var run = new W.Run(new W.Text(text)
        {
            Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve
        });

        return new W.Paragraph(
            new W.ParagraphProperties(
                new W.SpacingBetweenLines { After = "160" }),
            run);
    }

    private static W.Paragraph CreateBulletParagraph(string text)
    {
        var run = new W.Run(new W.Text($"•  {text}")
        {
            Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve
        });

        return new W.Paragraph(
            new W.ParagraphProperties(
                new W.SpacingBetweenLines { After = "80" },
                new W.Indentation { Left = "360" }),
            run);
    }
}
