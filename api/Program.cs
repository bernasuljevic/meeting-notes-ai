using api.Services.MeetingService;
using api.Options;
using api.Data;
using Microsoft.EntityFrameworkCore;
using api.Services;
using System.Collections.Generic;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString(
            "DefaultConnection"));
});

// Whisper servisi
builder.Services.AddSingleton<TranscriptionService>();

builder.Services.Configure<ClaudeOptions>(
    builder.Configuration.GetSection(
        ClaudeOptions.SectionName
    ));

builder.Services.Configure<OllamaOptions>(
    builder.Configuration.GetSection(
        OllamaOptions.SectionName
    ));

// Özetleme servisi: "Summarization:Provider" ayarına göre seçilir.
// - "claude"    -> Anthropic Claude API (bulut, Claude:ApiKey gerekli)
// - "ollama"    -> Yerel LLM (Ollama), transkript kurum disina hic cikmaz; hassas
//                  toplantilarda Claude yerine tercih edilebilir
// - "plaintext" -> LLM kullanmadan duz metin ozet (yer tutucu)
// - "auto" (varsayilan, ayar yoksa) -> Claude:ApiKey doluysa Claude, degilse PlainText
var claudeApiKey = builder.Configuration["Claude:ApiKey"];
var provider = (builder.Configuration["Summarization:Provider"] ?? "auto")
    .Trim()
    .ToLowerInvariant();

if (provider == "auto")
{
    provider = string.IsNullOrWhiteSpace(claudeApiKey) ? "plaintext" : "claude";
}

// Sohbet servisi de aynı "Summarization:Provider" ayarını kullanır — özetleme için
// hangi sağlayıcı seçildiyse, toplantıyla ilgili soru-cevap sohbeti de onu kullanır.
switch (provider)
{
    case "ollama":
        builder.Services.AddHttpClient<ISummarizationService, OllamaSummarizationService>(client =>
        {
            var baseUrl = builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434/";
            client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
            client.Timeout = TimeSpan.FromSeconds(300);
        });

        builder.Services.AddHttpClient<IMeetingChatService, OllamaChatService>(client =>
        {
            var baseUrl = builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434/";
            client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
            client.Timeout = TimeSpan.FromSeconds(300);
        });

        Console.WriteLine("Özetleme ve sohbet servisi: Ollama (yerel LLM) kullanılacak.");
        break;

    case "claude":
        if (string.IsNullOrWhiteSpace(claudeApiKey))
        {
            Console.WriteLine(
                "Uyarı: Summarization:Provider 'claude' olarak ayarlı ama Claude:ApiKey boş — " +
                "PlainText servislerine düşülüyor.");

            builder.Services.AddSingleton<ISummarizationService, PlainTextSummarizationService>();
            builder.Services.AddSingleton<IMeetingChatService, PlainTextChatService>();
        }
        else
        {
            builder.Services.AddHttpClient<ISummarizationService, ClaudeSummarizationService>(client =>
            {
                client.BaseAddress = new Uri("https://api.anthropic.com/");
                client.Timeout = TimeSpan.FromSeconds(300);
            });

            builder.Services.AddHttpClient<IMeetingChatService, ClaudeChatService>(client =>
            {
                client.BaseAddress = new Uri("https://api.anthropic.com/");
                client.Timeout = TimeSpan.FromSeconds(300);
            });

            Console.WriteLine("Özetleme ve sohbet servisi: Claude API kullanılacak.");
        }
        break;

    default:
        builder.Services.AddSingleton<ISummarizationService, PlainTextSummarizationService>();
        builder.Services.AddSingleton<IMeetingChatService, PlainTextChatService>();

        Console.WriteLine("Özetleme ve sohbet servisi: PlainText (yer tutucu).");
        break;
}

builder.Services.AddScoped<IMeetingService, MeetingService>();
builder.Services.AddSingleton<IMeetingExportService, MeetingExportService>();

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
        TranscriptionService transcriptionService,
        IMeetingService meetingService
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

    // Opsiyonel: bir önceki parçanın transkript metni. İstemci, aynı kaydın bir
    // önceki parçası zaten çözülmüşse bunu gönderir; Whisper'a "initial prompt"
    // olarak geçilip cümle ortası kesilen parçalarda doğruluğu artırır. Eski
    // istemciler bu alanı hiç göndermeyebilir — geriye dönük uyumlu, opsiyonel.
    var previousContext = form["previousContext"].ToString();

    // Opsiyonel: bu parçanın ait olduğu toplantının kimliği (bkz. POST
    // /api/meetings/start). Verilirse, transkript edilir edilmez o toplantıya
    // kalıcı olarak da yazılır — kayıt bitmeden tarayıcı çökerse/kapanırsa bile
    // o ana kadarki transkript kaybolmasın diye. Eski istemciler veya toplantı
    // başlatma isteği başarısız olduysa bu alan boş gelebilir; geriye dönük
    // uyumlu, opsiyonel.
    Guid? meetingId = Guid.TryParse(form["meetingId"], out var parsedMeetingId)
        ? parsedMeetingId
        : null;

    Console.WriteLine(
        $"Ses geldi: {audio.FileName} - {audio.Length} byte - seq={seq}"
    );

    await using var stream =
        audio.OpenReadStream();

    try
    {
        var transcript =
            await transcriptionService
                .TranscribeAsync(stream, previousContext);

        if (meetingId.HasValue)
        {
            var appended = await meetingService.AppendTranscriptSegmentAsync(
                meetingId.Value, seq, transcript);

            if (!appended)
            {
                Console.WriteLine(
                    $"Uyarı: meetingId={meetingId} bulunamadı, parça #{seq} DB'ye yazılamadı (sadece istemciye döndü)."
                );
            }
        }

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

// Kayıt başlar başlamaz çağrılır: EndedAt = null olan bir toplantı satırı
// oluşturur, döndürdüğü id her /api/transcribe çağrısına eklenip parçaların
// canlı olarak DB'ye yazılmasını sağlar (bkz. TranscribeAsync ve
// PATCH /api/meetings/{id}/finalize). Bu sayede kayıt bitmeden tarayıcı
// çökerse/kapanırsa bile o ana kadarki transkript kaybolmaz.
app.MapPost(
    "/api/meetings/start",
    async (
        StartMeetingRequest request,
        IMeetingService meetingService
    ) =>
{
    var meeting = await meetingService.StartMeetingAsync(request.Title, request.StartedAt);

    return Results.Ok(new
    {
        meeting.Id
    });
});

// Kayıt bitip yapay zekâ özeti hazır olunca çağrılır: /api/meetings/start ile
// oluşturulan toplantıyı gerçek başlık, bitiş zamanı ve özetle tamamlar.
app.MapPatch(
    "/api/meetings/{id:guid}/finalize",
    async (
        Guid id,
        FinalizeMeetingRequest request,
        IMeetingService meetingService
    ) =>
{
    var found = await meetingService.FinalizeMeetingAsync(
        id, request.Title, request.EndedAt, request.Summary);

    if (!found)
    {
        return Results.NotFound();
    }

    return Results.NoContent();
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

app.MapGet("/api/meetings/{id:guid}/export/docx", async (
    Guid id,
    IMeetingService meetingService,
    IMeetingExportService exportService) =>
{
    var meeting = await meetingService.GetMeetingAsync(id);

    if (meeting is null)
    {
        return Results.NotFound();
    }

    var bytes = exportService.GenerateDocx(meeting);
    var fileName = $"{SanitizeFileName(meeting.Title)}.docx";

    return Results.File(
        bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName);
});

app.MapGet("/api/meetings/{id:guid}/export/pdf", async (
    Guid id,
    IMeetingService meetingService,
    IMeetingExportService exportService) =>
{
    var meeting = await meetingService.GetMeetingAsync(id);

    if (meeting is null)
    {
        return Results.NotFound();
    }

    var bytes = exportService.GeneratePdf(meeting);
    var fileName = $"{SanitizeFileName(meeting.Title)}.pdf";

    return Results.File(bytes, "application/pdf", fileName);
});

app.MapPost("/api/meetings/{id:guid}/chat", async (
    Guid id,
    ChatRequest request,
    IMeetingService meetingService,
    IMeetingChatService chatService,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Question))
    {
        return Results.BadRequest(new { error = "Soru boş olamaz." });
    }

    var meeting = await meetingService.GetMeetingAsync(id);

    if (meeting is null)
    {
        return Results.NotFound();
    }

    var transcript = string.Join(" ", meeting.TranscriptSegments.Select(s => s.Text));

    if (string.IsNullOrWhiteSpace(transcript))
    {
        return Results.Ok(new ChatResponse("Bu toplantı için konuşma metni bulunamadı."));
    }

    try
    {
        var answer = await chatService.AskAsync(transcript, request.Question);
        return Results.Ok(new ChatResponse(answer));
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Toplantı sohbeti sırasında hata oluştu.");
        return Results.Problem(
            title: "Soru cevaplanamadı",
            detail: ex.Message,
            statusCode: 500
        );
    }
});

app.Run();

static string SanitizeFileName(string input)
{
    var invalidChars = Path.GetInvalidFileNameChars();
    var sanitized = new string(input.Select(c => invalidChars.Contains(c) ? '_' : c).ToArray()).Trim();

    return string.IsNullOrWhiteSpace(sanitized) ? "toplanti" : sanitized;
}

public record ChatRequest(string Question);

public record ChatResponse(string Answer);

public record SummarizeRequest(string Transcript);

public record StartMeetingRequest(string Title, DateTime StartedAt);

public record FinalizeMeetingRequest(string Title, DateTime EndedAt, MeetingSummary Summary);

public class SummarizeResponse
{
    public string GeneralSummary { get; set; } = string.Empty;
    public List<string> Decisions { get; set; } = new();
    public List<string> ActionItems { get; set; } = new();
    public List<string> OpenIssuesAndRisks { get; set; } = new();
    public List<string> KeyDiscussionPoints { get; set; } = new();
}
