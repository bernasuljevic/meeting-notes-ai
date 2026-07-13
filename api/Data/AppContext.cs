using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using api.Models;

namespace api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Meeting> Meetings => Set<Meeting>();

    public DbSet<TranscriptSegment> TranscriptSegments
        => Set<TranscriptSegment>();

    public DbSet<MeetingNote> MeetingNotes
        => Set<MeetingNote>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Meeting>()
            .HasMany(m => m.TranscriptSegments)
            .WithOne(t => t.Meeting)
            .HasForeignKey(t => t.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Meeting>()
            .HasMany(m => m.Notes)
            .WithOne(n => n.Meeting)
            .HasForeignKey(n => n.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);

        // SQL Server'ın datetime2 kolonları DateTime.Kind bilgisini saklamaz;
        // EF Core veritabanından okurken her zaman Kind=Unspecified döner.
        // Bu yüzden System.Text.Json JSON'a "Z" son ekini eklemeden yazıyordu
        // ve tarayıcı, aslında UTC olan zamanı yerel saatmiş gibi yorumluyordu
        // (Türkiye'de 3 saatlik bir kaymaya yol açıyordu). Aşağıdaki converter,
        // tüm DateTime alanlarının okurken/yazarken UTC olarak işaretlenmesini
        // sağlar; böylece frontend'deki mevcut `new Date(iso).toLocaleString(...)`
        // dönüşümü doğru şekilde yerel saate çevirebilir.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            toDb => toDb.Kind == DateTimeKind.Utc ? toDb : toDb.ToUniversalTime(),
            fromDb => DateTime.SpecifyKind(fromDb, DateTimeKind.Utc));

        var nullableUtcConverter = new ValueConverter<DateTime?, DateTime?>(
            toDb => toDb.HasValue
                ? (toDb.Value.Kind == DateTimeKind.Utc ? toDb.Value : toDb.Value.ToUniversalTime())
                : toDb,
            fromDb => fromDb.HasValue
                ? DateTime.SpecifyKind(fromDb.Value, DateTimeKind.Utc)
                : fromDb);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(utcConverter);
                }
                else if (property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(nullableUtcConverter);
                }
            }
        }
    }
}
