// web/src/components/Recorder.tsx
import { useEffect, useState } from "react";
import { useRecorder } from "../hooks/useRecorder";
import { transcribeAudio } from "../lib/api";

export function Recorder() {
  const { isRecording, level, audioBlob, error, startRecording, stopRecording } = useRecorder();

  // --- YENİ EKLENEN STATE'LER ---
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  // --- YENİ EKLENEN STATE'LER BİTTİ ---

  // audioBlob her yeni kayıt bittiğinde doluyor (useRecorder.ts zaten bunu yapıyor).
  // Bu değişikliği yakalayıp otomatik olarak backend'e gönderiyoruz.
  useEffect(() => {
    if (!audioBlob) {
      return;
    }

    let isCancelled = false;

    async function sendForTranscription() {
      setIsTranscribing(true);
      setTranscribeError(null);
      setTranscript(null);

      try {
        const result = await transcribeAudio(audioBlob!);
        if (!isCancelled) {
          setTranscript(result.transcript);
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : "Transkripsiyon başarısız.";
          setTranscribeError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsTranscribing(false);
        }
      }
    }

    sendForTranscription();

    return () => {
      isCancelled = true;
    };
  }, [audioBlob]);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-xl font-semibold">Ses Kaydı</h2>

      <div className="flex gap-3">
        <button
          onClick={startRecording}
          disabled={isRecording}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Start Recording
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          Stop Recording
        </button>
      </div>

      {isRecording && (
        <div className="w-64 h-3 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-75"
            style={{ width: `${level * 100}%` }}
          />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">Kayıt hatası: {error}</p>}

      {/* --- YENİ EKLENEN GÖRÜNÜM: Transkripsiyon durumu --- */}
      {isTranscribing && (
        <p className="text-gray-600 text-sm">Transkript oluşturuluyor, lütfen bekleyin...</p>
      )}

      {transcribeError && (
        <p className="text-red-600 text-sm">Transkripsiyon hatası: {transcribeError}</p>
      )}

      {transcript && !isTranscribing && (
        <div className="w-full max-w-md rounded border border-gray-300 p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Transkript</h3>
          <p className="text-gray-900 whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
      {/* --- YENİ EKLENEN GÖRÜNÜM BİTTİ --- */}
    </div>
  );
}