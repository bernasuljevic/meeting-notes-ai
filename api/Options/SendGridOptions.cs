namespace api.Options;

public class SendGridOptions
{
    public const string SectionName = "SendGrid";

    public string ApiKey { get; set; } = string.Empty;

    // Sender Authentication'da doğrulanmış gönderen adresi - SendGrid,
    // doğrulanmamış bir adresten gönderilen maili reddeder.
    public string FromEmail { get; set; } = string.Empty;

    public string FromName { get; set; } = "MeetBrainz";
}
