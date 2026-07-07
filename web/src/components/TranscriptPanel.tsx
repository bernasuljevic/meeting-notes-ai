interface TranscriptPanelProps {
  transcript: string | null;
  isTranscribing: boolean;
  error: string | null;
}

export function TranscriptPanel({
  transcript,
  isTranscribing,
  error,
}: TranscriptPanelProps) {
  if (isTranscribing) {
    return (
      <p className="text-gray-600 text-sm">
        Transkript oluşturuluyor...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-red-600 text-sm">
        Transkripsiyon hatası: {error}
      </p>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
    <div className="w-full max-w-md rounded border border-gray-300 p-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-2">
        Transkript
      </h3>

      <p className="text-gray-900 whitespace-pre-wrap">
        {transcript}
      </p>
    </div>
  );
}