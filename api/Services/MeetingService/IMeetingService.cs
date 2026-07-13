using api.Models;

namespace api.Services.MeetingService;

public interface IMeetingService
{
    Task<Meeting> CreateMeetingAsync(
        CreateMeetingRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Kayıt başlar başlamaz çağrılır: EndedAt = null olan bir toplantı satırı
    /// oluşturur. Dönen id, canlı kayıt sırasında parçaları bu toplantıya
    /// bağlamak (AppendTranscriptSegmentAsync) ve sonunda tamamlamak
    /// (FinalizeMeetingAsync) için kullanılır.
    /// </summary>
    Task<Meeting> StartMeetingAsync(
        string title,
        DateTime startedAt,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Transkript edilmiş bir ses parçasını, StartMeetingAsync ile oluşturulmuş
    /// bir toplantıya kalıcı olarak ekler. Toplantı bulunamazsa false döner.
    /// </summary>
    Task<bool> AppendTranscriptSegmentAsync(
        Guid meetingId,
        int seq,
        string text,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// StartMeetingAsync ile oluşturulmuş bir toplantıyı gerçek başlık, bitiş
    /// zamanı ve AI özetiyle tamamlar. Toplantı bulunamazsa false döner.
    /// </summary>
    Task<bool> FinalizeMeetingAsync(
        Guid meetingId,
        string title,
        DateTime endedAt,
        MeetingSummary summary,
        CancellationToken cancellationToken = default);

    Task<List<MeetingListItemDto>> GetMeetingsAsync(
        CancellationToken cancellationToken = default);

    Task<MeetingDetailDto?> GetMeetingAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
