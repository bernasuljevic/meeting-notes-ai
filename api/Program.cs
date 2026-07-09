using api.Services.MeetingService;
using api.Options;
using api.Data;
using Microsoft.EntityFrameworkCore;
using api.Services;
using System.Collections.Generic;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString(
            "DefaultConnection"));
});

// Whisper servisi
builder.Services.AddSingleton<TranscriptionService>();

// Özetleme servisi: Claude:ApiKey doluysa gerçek Claude API'yi, boşsa placeholder'ı kullan.
var claudeApiKey = builder.Configuration["Claude:ApiKey"];

if (!string.IsNullOrWhiteSpace(claudeApiKey))
{
    builder.Services.AddHttpClient<ISummarizationService, ClaudeSummarizationService>(client =>
    {
        client.BaseAddress = new Uri("https://api.anthropic.com/");
        client.Timeout = TimeSpan.FromSeconds(300);
    });

    Console.WriteLine("Özetleme servisi: Claude API kullanılacak.");
}
else
{
    builder.Services.AddSingleton<ISummarizationService, PlainTextSummarizationService>();

    Console.WriteLine("Özetleme servisi: PlainTextSummarizationService (yer tutucu) — Claude:ApiKey ayarlanmadı.");
}

builder.Services.Configure<ClaudeOptions>(
    builder.Configuration.GetSection(
        ClaudeOptions.SectionName
    ));

builder.Services.AddScoped<IMeetingService, MeetingService>();

// CORS: sadece Vite dev sunucusuna izin ver (AllowAnyOrigin prod'da risklidir)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact",
        policy =>
        {
            policy
                .WithOrigins("http://localhost:5173")
                .AllowAnyMethod()
                .AllowAnyHeader();
        });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Whisper modelini uygulama açılışında yükle (ilk istek beklemesin)
app.Services.GetRequiredService<TranscriptionService>();

app.UseCors("AllowReact");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/api/ping", () =>
{
    return Results.Ok(new
    {
        message = "API çalışıyor",
        time = DateTime.Now
    });
});

app.MapPost(
    "/api/transcribe",
    async (
        HttpRequest request,
        TranscriptionService transcriptionService
    ) =>
{
    var form = await request.ReadFormAsync();

    var audio = form.Files["audio"];

    if (audio == null)
    {
        return Results.BadRequest(new
        {
            success = false,
            message = "Ses dosyası bulunamadı"
        });
    }

    if (!int.TryParse(form["seq"], out var seq))
    {
        return Results.BadRequest(new
        {
            success = false,
            message = "Geçerli bir 'seq' değeri bulunamadı"
        });
    }

    Console.WriteLine(
        $"Ses geldi: {audio.FileName} - {audio.Length} byte - seq={seq}"
    );

    await using var stream =
        audio.OpenReadStream();

    try
    {
        var transcript =
            await transcriptionService
                .TranscribeAsync(stream);

        return Results.Ok(new
        {
            success = true,
            seq,
            fileName = audio.FileName,
            size = audio.Length,
            transcript
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine(
            $"Whisper hatası: {ex.Message}"
        );

        return Results.Problem(
            title: "Transkripsiyon başarısız",
            detail: ex.Message
        );
    }
});

app.MapPost("/api/summarize", async (
    SummarizeRequest request,
    ISummarizationService summarizationService,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Transcript))
    {
        return Results.BadRequest(new { error = "Transcript boş olamaz." });
    }

    try
    {
        var summary = await summarizationService.SummarizeAsync(request.Transcript);

        return Results.Ok(new SummarizeResponse
        {
            GeneralSummary = summary.GeneralSummary,
            Decisions = summary.Decisions,
            ActionItems = summary.ActionItems,
            OpenIssuesAndRisks = summary.OpenIssuesAndRisks,
            KeyDiscussionPoints = summary.KeyDiscussionPoints
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Özetleme sırasında hata oluştu.");
        return Results.Problem(
            title: "Özetleme başarısız",
            detail: ex.Message,
            statusCode: 500
        );
    }
});

app.MapPost(
    "/api/meetings",
    async (
        CreateMeetingRequest request,
        IMeetingService meetingService
    ) =>
{
    var meeting =
        await meetingService.CreateMeetingAsync(request);

    return Results.Ok(new
    {
        meeting.Id
    });
});

app.MapGet(
    "/api/meetings",
    async (
        IMeetingService meetingService
    ) =>
{
    var meetings =
        await meetingService.GetMeetingsAsync();

    return Results.Ok(meetings);
});

app.MapGet(
    "/api/meetings/{id:guid}",
    async (
        Guid id,
        IMeetingService meetingService
    ) =>
{
    var meeting =
        await meetingService.GetMeetingAsync(id);

    if (meeting is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(meeting);
});

app.MapDelete("/api/meetings/{id:guid}", async (
    Guid id,
    AppDbContext db) =>
{
    var meeting = await db.Meetings
        .Include(m => m.TranscriptSegments)
        .Include(m => m.Notes)
        .FirstOrDefaultAsync(m => m.Id == id);

    if (meeting is null)
    {
        return Results.NotFound();
    }

    db.TranscriptSegments.RemoveRange(meeting.TranscriptSegments);
    db.MeetingNotes.RemoveRange(meeting.Notes);
    db.Meetings.Remove(meeting);

    await db.SaveChangesAsync();

    return Results.NoContent();
});

app.Run();

public record SummarizeRequest(string Transcript);

public class SummarizeResponse
{
    public string GeneralSummary { get; set; } = string.Empty;
    public List<string> Decisions { get; set; } = new();
    public List<string> ActionItems { get; set; } = new();
    public List<string> OpenIssuesAndRisks { get; set; } = new();
    public List<string> KeyDiscussionPoints { get; set; } = new();
}