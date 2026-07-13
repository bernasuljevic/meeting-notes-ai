namespace api.Services.MeetingService;

public interface IMeetingExportService
{
    byte[] GenerateDocx(MeetingDetailDto meeting);

    byte[] GeneratePdf(MeetingDetailDto meeting);
}
