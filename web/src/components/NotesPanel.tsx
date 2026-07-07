import type { SummarizeResponse } from "../lib/api";

interface NotesPanelProps {
  summary: SummarizeResponse | null;
  isSummarizing: boolean;
  error: string | null;
}

export function NotesPanel({
  summary,
  isSummarizing,
  error,
}: NotesPanelProps) {
  if (isSummarizing) {
    return (
      <p className="text-gray-600 text-sm">
        Özet oluşturuluyor...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-red-600 text-sm">
        Özetleme hatası: {error}
      </p>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <div className="rounded border border-gray-300 p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          Toplantı Özeti
        </h3>

        <p className="text-gray-900 whitespace-pre-wrap">
          {summary.generalSummary}
        </p>
      </div>

      <div className="rounded border border-gray-300 p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          Kararlar
        </h3>

        {summary.decisions.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {summary.decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">
            Karar bulunamadı.
          </p>
        )}
      </div>

      <div className="rounded border border-gray-300 p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          Yapılacaklar
        </h3>

        {summary.actionItems.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {summary.actionItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">
            Yapılacak madde bulunamadı.
          </p>
        )}
      </div>
    </div>
  );
}