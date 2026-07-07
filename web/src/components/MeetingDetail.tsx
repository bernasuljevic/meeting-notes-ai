import ReactMarkdown from "react-markdown";
import type { MeetingDetail as MeetingDetailModel } from "../lib/api";

interface MeetingDetailProps {
  meeting: MeetingDetailModel | null;
}

export function MeetingDetail({
  meeting,
}: MeetingDetailProps) {
  if (!meeting) {
    return (
      <div className="w-full max-w-3xl rounded border border-gray-300 p-4">
        <h2 className="text-xl font-semibold">
          Toplantı Detayı
        </h2>

        <p className="mt-2 text-gray-500">
          Görüntülenecek toplantı seçilmedi.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl rounded border border-gray-300 p-4 mt-6">
      <h2 className="text-2xl font-bold mb-2">
        {meeting.title}
      </h2>

      <p className="text-sm text-gray-500">
        Başlangıç: {new Date(meeting.startedAt).toLocaleString()}
      </p>

      {meeting.endedAt && (
        <p className="text-sm text-gray-500 mb-4">
          Bitiş: {new Date(meeting.endedAt).toLocaleString()}
        </p>
      )}

      <hr className="my-4" />

      <h3 className="font-semibold mb-2">
        Transcript
      </h3>

      {meeting.transcriptSegments.length > 0 ? (
        <div className="rounded border border-gray-300 bg-gray-50 p-4">
          {meeting.transcriptSegments.map((segment) => (
            <p
              key={segment.id}
              className="whitespace-pre-wrap mb-2 last:mb-0"
            >
              {segment.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          Transcript bulunamadı.
        </p>
      )}

      <hr className="my-4" />

      <h3 className="font-semibold mb-2">
        Meeting Notes
      </h3>

      {meeting.notes.length > 0 ? (
        meeting.notes.map((note) => (
          <div
            key={note.id}
            className="mb-3 rounded border border-gray-300 bg-gray-50 p-4"
          >
            <div className="prose prose-sm max-w-none">
  <ReactMarkdown>
    {note.markdownContent}
  </ReactMarkdown>
</div>

            <p className="mt-3 text-sm text-gray-500">
              Model: {note.model}
            </p>
          </div>
        ))
      ) : (
        <p className="text-gray-500">
          Not bulunamadı.
        </p>
      )}
    </div>
  );
}