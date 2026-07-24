// web/src/components/Recorder.tsx
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Circle,
  Clock3,
  Info,
  Loader2,
  Mic,
  Save,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { useRecorder } from "../hooks/useRecorder";
import { createMeeting } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { LevelMeter } from "./LevelMeter";
import { NotesPanel } from "./NotesPanel";
import { TranscriptPanel } from "./TranscriptPanel";

interface RecorderProps {
  onMeetingSaved?: () => void;
  // AI özeti giriş yapılmadığı/AI ayarlanmadığı için atlandığında, kullanıcıya
  // giriş/AI ayarları dialoglarını açma imkânı sunmak için (App.tsx'ten geçilir).
  onOpenLogin?: () => void;
  onOpenAiSettings?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Kayıt bitip AI özeti hazır olduğunda kullanıcıya gösterilecek başlık
// ÖNERİSİ üretir. Toplantı bu isimle kendiliğinden kaydedilmez; kullanıcı
// öneriyi görür, isterse değiştirir ve "Kaydet"e basarak onaylar.
function generatePlaceholderTitle(date: Date): string {
  const formatted = date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Toplantı - ${formatted}`;
}

export function Recorder({
  onMeetingSaved,
  onOpenLogin,
  onOpenAiSettings,
}: RecorderProps) {
  const { token, hasAiConfigured } = useAuth();

  // Giriş yapılmamış ya da AI ayarları tamamlanmamışsa null geçiyoruz —
  // useRecorder bu durumda özetleme adımını hiç denemeden atlıyor (aiSkipped).
  const {
    isRecording,
    isFinalizing,
    level,
    durationSec,
    transcript,
    notes,
    aiSkipped,
    error,
    startRecording,
    stopRecording,
  } = useRecorder(hasAiConfigured ? token : null);

  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [readyToName, setReadyToName] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const recordingStartedAtRef = useRef<string | null>(null);
  const recordingEndedAtRef = useRef<string | null>(null);
  const hasPromptedForTitleRef = useRef(false);

  const hasTranscript = transcript.length > 0 && !justSaved;
  const hasNotes = notes !== null && !justSaved;

  async function handleStartRecording() {
    const startedAt = new Date().toISOString();
    recordingStartedAtRef.current = startedAt;
    recordingEndedAtRef.current = null;
    hasPromptedForTitleRef.current = false;
    setJustSaved(false);
    setReadyToName(false);
    setTitleDraft("");

    await startRecording();
  }

  function handleStopRecording() {
    recordingEndedAtRef.current = new Date().toISOString();
    stopRecording();
  }

  // Transkript hazır olur olmaz — AI özeti gelmiş olsun (notes) ya da giriş
  // yapılmadığı/AI ayarlanmadığı için hiç denenmemiş olsun (aiSkipped) — toplantıyı
  // doğrudan kendiliğinden kaydetmek yerine bir başlık ÖNERİSİ hazırlayıp
  // kullanıcıdan onay bekle.
  useEffect(() => {
    if (
      (!notes && !aiSkipped) ||
      !transcript ||
      isFinalizing ||
      hasPromptedForTitleRef.current
    ) {
      return;
    }

    hasPromptedForTitleRef.current = true;

    const startedAt = recordingStartedAtRef.current ?? new Date().toISOString();
    setTitleDraft(generatePlaceholderTitle(new Date(startedAt)));
    setReadyToName(true);
  }, [notes, aiSkipped, transcript, isFinalizing]);

  async function handleConfirmSave(e: React.FormEvent) {
    e.preventDefault();

    if (!notes && !aiSkipped) return;

    const startedAt = recordingStartedAtRef.current ?? new Date().toISOString();
    const endedAt = recordingEndedAtRef.current ?? new Date().toISOString();
    const title =
      titleDraft.trim() || generatePlaceholderTitle(new Date(startedAt));

    try {
      setIsSaving(true);

      const result = await createMeeting({
        title,
        startedAt,
        endedAt,
        transcript,
        summary: notes,
      });

      console.log("Toplantı kaydedildi:", result.id);

      toast.success("Toplantı kaydedildi.");
      onMeetingSaved?.();
      setReadyToName(false);
      setJustSaved(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Toplantı kaydedilemedi."
      );
    } finally {
      setIsSaving(false);
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
                bitirdiğinizde yapay zekâ özetlesin, sonra önerilen ismi
                değiştirip kaydedin.
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
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={handleStartRecording}
              disabled={isRecording}
              size="lg"
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Kaydı Başlat
            </Button>

            <Button
              onClick={handleStopRecording}
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

          {aiSkipped && !justSaved && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Yapay zekâ özeti oluşturulmadı: giriş yapılmamış ya da AI
                  ayarları tamamlanmamış. Toplantıyı yine de transkriptle
                  kaydedebilirsin.
                </p>
              </div>

              {(onOpenLogin || onOpenAiSettings) && (
                <div className="flex shrink-0 gap-2">
                  {onOpenLogin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenLogin}
                    >
                      Giriş Yap
                    </Button>
                  )}
                  {onOpenAiSettings && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenAiSettings}
                    >
                      AI Ayarları
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {readyToName && !justSaved && (
            <form
              onSubmit={handleConfirmSave}
              className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Sparkles className="h-4 w-4" />
                Toplantıya bir isim ver (öneriyi değiştirebilirsin)
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  disabled={isSaving}
                  placeholder="Toplantı adı"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  disabled={isSaving || !titleDraft.trim()}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Kaydet
                </Button>
              </div>
            </form>
          )}

          {justSaved && !isSaving && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
              <Mic className="h-4 w-4 shrink-0" />
              <p>Toplantı kaydedildi. Yeni bir kayıt başlatabilirsin.</p>
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
      {!justSaved && (
        <NotesPanel
          summary={hasNotes ? notes : null}
          isSummarizing={isFinalizing}
          error={error}
        />
      )}
    </div>
  );
}
