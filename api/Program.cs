var builder = WebApplication.CreateBuilder(args);

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

var app = builder.Build();

app.UseCors("AllowReact");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

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
app.MapPost("/api/transcribe", async (HttpRequest request) =>
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

    return Results.Ok(new
    {
        success = true,
        fileName = audio.FileName,
        size = audio.Length
    });
});

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}