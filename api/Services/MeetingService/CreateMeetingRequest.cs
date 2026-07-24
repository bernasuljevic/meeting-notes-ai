using api.Services;

namespace api.Services.MeetingService;

// Summary artık nullable: giriş yapmadan/AI ayarı olmadan kayıt yapan bir
// kullanıcı, yapay zekâ özeti hiç üretilmeden sadece transkriptle toplantıyı
// kaydedebilir (bkz. MeetingService.CreateMeetingAsync).
public record CreateMeetingRequest(
    string Title,
    DateTime StartedAt,
    DateTime? EndedAt,
    string Transcript,
    MeetingSummary? Summary
);