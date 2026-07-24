using api.Services.MeetingService;
using api.Options;
using api.Data;
using Microsoft.EntityFrameworkCore;
using api.Services;
using api.Services.Auth;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

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

// --- Login + kullanıcıya özel AI ayarları ---
// Yukarıdaki ISummarizationService/IMeetingChatService seçimi sunucu genelinde
// SABİT bir sağlayıcıya bağlanıyor. Login gerektiren /api/summarize ve
// /api/meetings/{id}/chat uçları artık bunu kullanmıyor; bunun yerine, giriş
// yapan kullanıcının kendi sağlayıcı/model/token tercihiyle çalışan
// IUserAiClient'ı kullanıyor (bkz. Services/Auth/UserAiClient.cs).
builder.Services.Configure<JwtOptions>(
    builder.Configuration.GetSection(JwtOptions.SectionName));

builder.Services.AddDataProtection();
builder.Services.AddHttpClient(); // IHttpClientFactory (UserAiClient için)

builder.Services.AddSingleton<ITokenProtector, TokenProtector>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IUserAiClient, UserAiClient>();

var jwtSecret = builder.Configuration["Jwt:Secret"];

if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException(
        "Jwt:Secret ayarı appsettings.json içinde tanımlı olmalı (login token'larını imzalamak için).");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Varsayılan davranışta ASP.NET Core, token'daki kısa "sub" claim'ini
        // HttpContext.User.Claims içine uzun bir isimle (ClaimTypes.NameIdentifier)
        // eşler. GetUserId aşağıda tam olarak "sub" adını aradığı için, bu eşlemeyi
        // kapatıyoruz — yoksa kullanıcı doğru giriş yapmış olsa bile GetUserId null
        // döner ve istekler yanlışlıkla 401 alır.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

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

app.UseAuthentication();
app.UseAuthorization();

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

// --- Auth uçları ---
// Kayıt ve transkript/toplantı listesi login gerektirmez; sadece AI özellikleri
// (özet çıkarma, toplantıyla soru-cevap) giriş yapmayı ve AI ayarlarının
// (sağlayıcı + model + gerekiyorsa token) tamamlanmış olmasını gerektirir.

app.MapPost("/api/auth/register", async (
    RegisterRequest request,
    IUserService userService,
    IJwtTokenService jwtTokenService) =>
{
    var (success, error, user) = await userService.RegisterAsync(request.Username, request.Password);

    if (!success || user is null)
    {
        return Results.BadRequest(new { error });
    }

    var token = jwtTokenService.GenerateToken(user);

    return Results.Ok(new AuthResponse(token, user.Username));
});

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    IUserService userService,
    IJwtTokenService jwtTokenService) =>
{
    var user = await userService.AuthenticateAsync(request.Username, request.Password);

    if (user is null)
    {
        return Results.Json(new { error = "Kullanıcı adı ya da şifre hatalı." }, statusCode: 401);
    }

    var token = jwtTokenService.GenerateToken(user);

    return Results.Ok(new AuthResponse(token, user.Username));
});

app.MapGet("/api/auth/me", async (
    HttpContext httpContext,
    IUserService userService) =>
{
    var userId = GetUserId(httpContext);

    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var user = await userService.GetByIdAsync(userId.Value);

    if (user is null)
    {
        return Results.Unauthorized();
    }

    return Results.Ok(new MeResponse(
        user.Username,
        user.HasAiConfigured,
        user.AiProvider,
        user.AiModel));
}).RequireAuthorization();

app.MapPut("/api/auth/ai-settings", async (
    HttpContext httpContext,
    UpdateAiSettingsRequest request,
    IUserService userService) =>
{
    var userId = GetUserId(httpContext);

    if (userId is null)
    {
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(request.Provider) || string.IsNullOrWhiteSpace(request.Model))
    {
        return Results.BadRequest(new { error = "Sağlayıcı ve model adı boş olamaz." });
    }

    var updated = await userService.UpdateAiSettingsAsync(
        userId.Value, request.Provider, request.Model, request.ApiToken);

    if (!updated)
    {
        return Results.Unauthorized();
    }

    return Results.NoContent();
}).RequireAuthorization();

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

    // Opsiyonel: bir önceki parçanın transkript metni. İstemci, aynı kaydın bir
    // önceki parçası zaten çözülmüşse bunu gönderir; Whisper'a "initial prompt"
    // olarak geçilip cümle ortası kesilen parçalarda doğruluğu artırır. Eski
    // istemciler bu alanı hiç göndermeyebilir — geriye dönük uyumlu, opsiyonel.
    var previousContext = form["previousContext"].ToString();

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
    HttpContext httpContext,
    IUserService userService,
    IUserAiClient userAiClient,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Transcript))
    {
        return Results.BadRequest(new { error = "Transcript boş olamaz." });
    }

    var userId = GetUserId(httpContext);

    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var aiSettings = await userService.GetDecryptedAiSettingsAsync(userId.Value);

    if (aiSettings is null)
    {
        return Results.BadRequest(new
        {
            error = "Önce AI ayarlarından bir sağlayıcı, model ve (gerekiyorsa) API token belirlemelisin."
        });
    }

    try
    {
        var summary = await userAiClient.SummarizeAsync(
            aiSettings.Value.Provider,
            aiSettings.Value.Model,
            aiSettings.Value.ApiToken,
            request.Transcript);

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
}).RequireAuthorization();

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
    HttpContext httpContext,
    IMeetingService meetingService,
    IUserService userService,
    IUserAiClient userAiClient,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Question))
    {
        return Results.BadRequest(new { error = "Soru boş olamaz." });
    }

    var userId = GetUserId(httpContext);

    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var aiSettings = await userService.GetDecryptedAiSettingsAsync(userId.Value);

    if (aiSettings is null)
    {
        return Results.BadRequest(new
        {
            error = "Önce AI ayarlarından bir sağlayıcı, model ve (gerekiyorsa) API token belirlemelisin."
        });
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
        var answer = await userAiClient.AskAsync(
            aiSettings.Value.Provider,
            aiSettings.Value.Model,
            aiSettings.Value.ApiToken,
            transcript,
            request.Question);

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
}).RequireAuthorization();

app.Run();

static string SanitizeFileName(string input)
{
    var invalidChars = Path.GetInvalidFileNameChars();
    var sanitized = new string(input.Select(c => invalidChars.Contains(c) ? '_' : c).ToArray()).Trim();

    return string.IsNullOrWhiteSpace(sanitized) ? "toplanti" : sanitized;
}

static Guid? GetUserId(HttpContext httpContext)
{
    var subClaim = httpContext.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
    return Guid.TryParse(subClaim, out var userId) ? userId : null;
}

public record ChatRequest(string Question);

public record ChatResponse(string Answer);

public record SummarizeRequest(string Transcript);

public class SummarizeResponse
{
    public string GeneralSummary { get; set; } = string.Empty;
    public List<string> Decisions { get; set; } = new();
    public List<string> ActionItems { get; set; } = new();
    public List<string> OpenIssuesAndRisks { get; set; } = new();
    public List<string> KeyDiscussionPoints { get; set; } = new();
}

public record RegisterRequest(string Username, string Password);

public record LoginRequest(string Username, string Password);

public record AuthResponse(string Token, string Username);

public record MeResponse(string Username, bool HasAiConfigured, string? AiProvider, string? AiModel);

public record UpdateAiSettingsRequest(string Provider, string Model, string? ApiToken);
