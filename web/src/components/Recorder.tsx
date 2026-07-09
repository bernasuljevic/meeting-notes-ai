// web/src/components/Recorder.tsx
import {
  AlertTriangle,
  Circle,
  Clock3,
  Info,
  Loader2,
  Mic,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { useRecorder } from "../hooks/useRecorder";
import { createMeeting } from "../lib/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { LevelMeter } from "./LevelMeter";
import { NotesPanel } from "./NotesPanel";
import { SaveMeetingPanel } from "./SaveMeetingPanel";
import { TranscriptPanel } from "./TranscriptPanel";

interface RecorderProps {
  onMeetingSaved?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function Recorder({ onMeetingSaved }: RecorderProps) {
  const {
    isRecording,
    isFinalizing,
    level,
    durationSec,
    transcript,
    notes,
    error,
    startRecording,
    stopRecording,
  } = useRecorder();

  const hasTranscript = transcript.length > 0;

  async function handleSaveMeeting(title: string) {
    if (!transcript || !notes) {
      return;
    }

    try {
      const result = await createMeeting({
        title,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        transcript,
        summary: notes,
      });

      console.log("Toplantı kaydedildi:", result.id);

      onMeetingSaved?.();

      toast.success("Toplantı başarıyla kaydedildi.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Toplantı kaydedilemedi."
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Kayıt Kartı */}
      <Card className="overflow-hidden py-0 shadow-sm transition-shadow hover:shadow-md">
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
                Kaydı başlatın, transkript canlı olarak oluşsun; kaydı
                bitirdiğinizde yapay zekâ otomatik olarak özetlesin.
              </p>
            </div>

            {/* Canlı durum göstergesi */}
            <Badge
              variant={isRecording ? "destructive" : "secondary"}
              className="gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-sm"
            >
              <Circle
                className={`h-2.5 w-2.5 fill-current ${
                  isRecording ? "animate-pulse" : ""
                }`}
              />
              {isRecording ? "Kayıt Yapılıyor..." : "Hazır"}
            </Badge>
          </div>
        </div>

        {/* Kontroller */}
        <CardContent className="space-y-6 px-6 py-8 sm:px-10">
          {/* KVKK / gizlilik bilgilendirmesi */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-relaxed text-blue-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Bu toplantı kaydedilmektedir. Katılımcıları bilgilendirin ve
              gerekiyorsa (özellikle müşteri toplantılarında) rızalarını alın.
              Ses, transkript oluşturmak için kendi cihazınızda işlenir; yapay
              zekâ özeti aktif olduğunda transkript metni, özet oluşturmak
              amacıyla Claude API'ye (Anthropic) gönderilir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={startRecording}
              disabled={isRecording}
              size="lg"
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Kaydı Başlat
            </Button>

            <Button
              onClick={stopRecording}
              disabled={!isRecording}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Kaydı Durdur
            </Button>

            {/* Süre göstergesi */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-600">
              <Clock3 className="h-4 w-4" />
              {formatDuration(durationSec)}
            </div>
          </div>

          <Separator />

          {/* Ses seviyesi kartı */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
            <LevelMeter level={level} isRecording={isRecording} />
          </div>

          {isFinalizing && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <p>Son parçalar işleniyor ve yapay zekâ özeti oluşturuluyor...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transkript (canlı) */}
      <TranscriptPanel
        transcript={hasTranscript ? transcript : null}
        isTranscribing={isRecording || isFinalizing}
        error={null}
      />

      {/* Notlar / Özet (otomatik oluşur) */}
      <NotesPanel
        summary={notes}
        isSummarizing={isFinalizing}
        error={error}
      />

      {notes && <SaveMeetingPanel onSave={handleSaveMeeting} />}
    </div>
  );
}