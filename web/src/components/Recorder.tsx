// web/src/components/Recorder.tsx
import { LevelMeter } from "./LevelMeter";
import { useEffect, useState } from "react";
import { useRecorder } from "../hooks/useRecorder";
import {
  transcribeAudio,
  summarizeTranscript,
} from "../lib/api";

import type {
  SummarizeResponse,
} from "../lib/api";

import { TranscriptPanel } from "./TranscriptPanel";
import { NotesPanel } from "./NotesPanel";

export function Recorder() {
  const { isRecording, level, audioBlob, error, startRecording, stopRecording } = useRecorder();

  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // --- GÜNCELLENDİ: summary artık düz string değil, yapılandırılmış nesne ---
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioBlob) {
      return;
    }

    let isCancelled = false;

    async function sendForTranscription() {
      setIsTranscribing(true);
      setTranscribeError(null);
      setTranscript(null);
      setSummary(null);
      setSummarizeError(null);

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

  async function handleSummarize() {
    if (!transcript) {
      return;
    }

    setIsSummarizing(true);
    setSummarizeError(null);

    try {
      const result = await summarizeTranscript(transcript);
      setSummary(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Özetleme başarısız.";
      setSummarizeError(message);
    } finally {
      setIsSummarizing(false);
    }
  }

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

      <LevelMeter
  level={level}
  isRecording={isRecording}
/>


      {error && <p className="text-red-600 text-sm">Kayıt hatası: {error}</p>}

<TranscriptPanel
  transcript={transcript}
  isTranscribing={isTranscribing}
  error={transcribeError}
/>

{transcript && (
  <button
    onClick={handleSummarize}
    disabled={isSummarizing}
    className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50"
  >
    {isSummarizing
      ? "Özetleniyor..."
      : "Özet Oluştur"}
  </button>
)}

<NotesPanel
  summary={summary}
  isSummarizing={isSummarizing}
  error={summarizeError}
/>

    </div>
  );
}