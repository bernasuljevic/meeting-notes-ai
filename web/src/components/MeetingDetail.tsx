// web/src/components/MeetingDetail.tsx
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  FileDown,
  FileText,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { downloadMeetingExport, type MeetingDetail as MeetingDetailModel } from "../lib/api";
import { MeetingChat } from "./MeetingChat";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MeetingDetailProps {
  meeting: MeetingDetailModel | null;
  onBack?: () => void;
  // Toplantı sohbetinin (MeetingChat) giriş/AI ayarları gerektiğinde ilgili
  // dialogları açabilmesi için App.tsx'ten geçiriliyor.
  onOpenLogin?: () => void;
  onOpenAiSettings?: () => void;
}

export function MeetingDetail({
  meeting,
  onBack,
  onOpenLogin,
  onOpenAiSettings,
}: MeetingDetailProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "pdf" | null>(null);

  async function handleDownload(format: "docx" | "pdf") {
    if (!meeting) return;

    try {
      setDownloadingFormat(format);
      await downloadMeetingExport(meeting.id, format, meeting.title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya indirilemedi.");
    } finally {
      setDownloadingFormat(null);
    }
  }

  if (!meeting) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
            <FileText className="h-7 w-7 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Toplantı Detayı</h2>
            <p className="text-slate-500">Soldaki listeden bir toplantı seçin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl text-white">{meeting.title}</CardTitle>
                <CardDescription className="mt-1 text-slate-300">
                  Toplantı bilgileri
                </CardDescription>
              </div>
            </div>

            <div className="flex gap-2">
              {onBack && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("docx")}
              >
                {downloadingFormat === "docx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Word
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("pdf")}
              >
                {downloadingFormat === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 py-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Başlangıç
            </div>
            <p className="mt-3 font-medium text-slate-800">
              {new Date(meeting.startedAt).toLocaleString("tr-TR")}
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock3 className="h-4 w-4" />
              Bitiş
            </div>
            <p className="mt-3 font-medium text-slate-800">
              {meeting.endedAt
                ? new Date(meeting.endedAt).toLocaleString("tr-TR")
                : "Belirtilmedi"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle>Konuşma Metni</CardTitle>
              <CardDescription>Whisper tarafından oluşturuldu.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {meeting.transcriptSegments.length ? (
            <ScrollArea className="h-96 rounded-2xl border bg-slate-50">
              <div className="space-y-4 p-4">
                {meeting.transcriptSegments.map((segment) => (
                  <div key={segment.id} className="rounded-2xl border bg-white p-5">
                    <p className="whitespace-pre-wrap leading-7 text-slate-700">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              <NotebookPen className="mx-auto mb-3 h-8 w-8" />
              Konuşma metni bulunamadı.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <div>
              <CardTitle>Yapay Zekâ Özeti</CardTitle>
              <CardDescription>Toplantıdan oluşturulan özet</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {meeting.notes.length ? (
            <div className="space-y-5">
              {meeting.notes.map((note) => (
                <div key={note.id} className="rounded-2xl border bg-slate-50 p-6">
                  <article className="prose prose-slate max-w-none">
                    <ReactMarkdown>{note.markdownContent}</ReactMarkdown>
                  </article>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              <Sparkles className="mx-auto mb-3 h-8 w-8" />
              Henüz yapay zekâ özeti oluşturulmamış.
            </div>
          )}
        </CardContent>
      </Card>

      <MeetingChat
        meetingId={meeting.id}
        onOpenLogin={onOpenLogin}
        onOpenAiSettings={onOpenAiSettings}
      />
    </div>
  );
}