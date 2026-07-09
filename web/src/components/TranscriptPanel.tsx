import {
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";

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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />

          <div>
            <h3 className="font-semibold text-slate-800">
              Transkript Oluşturuluyor
            </h3>

            <p className="text-sm text-slate-500">
              Ses kaydı yazıya dönüştürülüyor...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

          <div>
            <h3 className="font-semibold text-red-700">
              Transkripsiyon Hatası
            </h3>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-5">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">

            <FileText className="h-5 w-5 text-white" />

          </div>

          <div>

            <h2 className="text-xl font-bold text-white">
              Transkript
            </h2>

            <p className="text-sm text-slate-300">
              Whisper tarafından oluşturulan konuşma metni
            </p>

          </div>

        </div>

      </div>

      <div className="p-6">

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

          <p className="whitespace-pre-wrap leading-8 text-slate-700">
            {transcript}
          </p>

        </div>

      </div>

    </div>
  );
}