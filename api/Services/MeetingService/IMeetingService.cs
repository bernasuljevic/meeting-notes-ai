using api.Models;

namespace api.Services.MeetingService;

public interface IMeetingService
{
    Task<Meeting> CreateMeetingAsync(
        CreateMeetingRequest request,
        Guid? userId,
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

    /// <summary>
    /// Sadece verilen kullanıcıya ait toplantıları döner — başka bir kullanıcının
    /// toplantıları asla listeye karışmaz.
    /// </summary>
    Task<List<MeetingListItemDto>> GetMeetingsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Toplantı bulunsa bile, verilen kullanıcıya ait değilse null döner (var olup
    /// olmadığını dahi sızdırmamak için "yetkisiz" yerine "bulunamadı" davranışı).
    /// </summary>
    Task<MeetingDetailDto?> GetMeetingAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default);
}
