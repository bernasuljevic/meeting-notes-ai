// web/src/components/Recorder.tsx
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Mic,
  Sparkles,
  Square,
} from "lucide-react";

import { useRecorder } from "../hooks/useRecorder";
import {
  transcribeAudio,
  summarizeTranscript,
  createMeeting,
} from "../lib/api";

import type { SummarizeResponse } from "../lib/api";

import { LevelMeter } from "./LevelMeter";
import { NotesPanel } from "./NotesPanel";
import { SaveMeetingPanel } from "./SaveMeetingPanel";
import { TranscriptPanel } from "./TranscriptPanel";

interface RecorderProps {
  onMeetingSaved?: () => void;
}

export function Recorder({ onMeetingSaved }: RecorderProps) {
  const {
    isRecording,
    level,
    audioBlob,
    error,
    startRecording,
    stopRecording,
  } = useRecorder();

  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummarizeResponse | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);

  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
      setSaveSuccess(null);

      try {
        const result = await transcribeAudio(audioBlob!);

        if (!isCancelled) {
          setTranscript(result.transcript);
        }
      } catch (err) {
        if (!isCancelled) {
          setTranscribeError(
            err instanceof Error
              ? err.message
              : "Transkripsiyon başarısız."
          );
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
    if (!transcript) return;

    setIsSummarizing(true);
    setSummarizeError(null);

    try {
      const result = await summarizeTranscript(transcript);

      setSummary(result);
    } catch (err) {
      setSummarizeError(
        err instanceof Error ? err.message : "Özetleme başarısız."
      );
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleSaveMeeting(title: string) {
    if (!transcript || !summary) {
      return;
    }

    setSaveSuccess(null);

    try {
      const result = await createMeeting({
        title,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        transcript,
        summary,
      });

      console.log("Toplantı kaydedildi:", result.id);

      onMeetingSaved?.();

      setSaveSuccess("Toplantı başarıyla kaydedildi.");
    } catch (err) {
      setSaveSuccess(null);

      alert(
        err instanceof Error ? err.message : "Toplantı kaydedilemedi."
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Kayıt Kartı */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Gradient başlık alanı */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-600 to-slate-900 px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Mic className="h-5 w-5 text-white" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Ses Kaydı
                </h2>
              </div>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-blue-50/90">
                Kaydı başlatın, transkripti otomatik oluşturun ve yapay
                zekâ ile saniyeler içinde özetleyin.
              </p>
            </div>

            {/* Canlı durum göstergesi */}
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors ${
                isRecording
                  ? "bg-red-500/20 text-red-50"
                  : "bg-white/10 text-blue-50/80"
              }`}
            >
              <Circle
                className={`h-2.5 w-2.5 ${
                  isRecording
                    ? "fill-red-400 text-red-400 animate-pulse"
                    : "fill-slate-300 text-slate-300"
                }`}
              />
              {isRecording ? "Kayıt Yapılıyor..." : "Hazır"}
            </div>
          </div>
        </div>

        {/* Kontroller */}
        <div className="space-y-6 px-6 py-8 sm:px-10">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
            >
              <Mic className="h-4 w-4 transition-transform group-hover:scale-110" />
              Kaydı Başlat
            </button>

            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="group inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
            >
              <Square className="h-4 w-4 transition-transform group-hover:scale-110" />
              Kaydı Durdur
            </button>
          </div>

          {/* Ses seviyesi kartı */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
            <LevelMeter level={level} isRecording={isRecording} />
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transkript */}
      <TranscriptPanel
        transcript={transcript}
        isTranscribing={isTranscribing}
        error={transcribeError}
      />

      {transcript && (
        <div className="flex justify-center">
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Özetleniyor...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Yapay Zekâ Özeti Oluştur
              </>
            )}
          </button>
        </div>
      )}

      {/* Notlar / Özet */}
      <NotesPanel
        summary={summary}
        isSummarizing={isSummarizing}
        error={summarizeError}
      />

      {summary && <SaveMeetingPanel onSave={handleSaveMeeting} />}

      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="font-medium">{saveSuccess}</p>
        </div>
      )}
    </div>
  );
}
