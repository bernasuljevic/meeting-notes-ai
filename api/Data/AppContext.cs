using Microsoft.EntityFrameworkCore;
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
    }
}