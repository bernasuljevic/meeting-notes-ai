using api.Services.MeetingService;
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

// Özetleme servisi (şimdilik placeholder, ileride Claude API ile değiştirilecek)
builder.Services.AddSingleton<
    ISummarizationService,
    PlainTextSummarizationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact",
        policy =>
        {
            policy
                .AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader();
        });
});

// Add services to the container.
builder.Services.AddOpenApi();

builder.Services.AddScoped<
    IMeetingService,
    MeetingService>();
// app.UseHttpsRedirection();

var app = builder.Build();


// Whisper modelini uygulama açılışında yükle
app.Services.GetRequiredService<TranscriptionService>();

app.UseCors("AllowReact");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild",
    "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast(
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();

    return forecast;
})
.WithName("GetWeatherForecast");

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

    Console.WriteLine(
        $"Ses geldi: {audio.FileName} - {audio.Length} byte"
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
            ActionItems = summary.ActionItems
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

app.Run();

record WeatherForecast(
    DateOnly Date,
    int TemperatureC,
    string? Summary)
{
    public int TemperatureF =>
        32 + (int)(TemperatureC / 0.5556);
}

public record SummarizeRequest(string Transcript);

public class SummarizeResponse
{
    public string GeneralSummary { get; set; } = string.Empty;
    public List<string> Decisions { get; set; } = new();
    public List<string> ActionItems { get; set; } = new();
}