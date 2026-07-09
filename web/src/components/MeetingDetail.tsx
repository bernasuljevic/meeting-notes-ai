// Modernized MeetingDetail.tsx
import ReactMarkdown from "react-markdown";
import { CalendarDays, Clock3, FileText, Sparkles, NotebookPen } from "lucide-react";
import type { MeetingDetail as MeetingDetailModel } from "../lib/api";

interface MeetingDetailProps {
  meeting: MeetingDetailModel | null;
}

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  if (!meeting) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
            <FileText className="h-7 w-7 text-blue-700"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Toplantı Detayı</h2>
            <p className="text-slate-500">Soldaki listeden bir toplantı seçin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <FileText className="h-7 w-7 text-white"/>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{meeting.title}</h1>
                <p className="mt-1 text-slate-300">Toplantı bilgileri</p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Toplantı</span>
          </div>
        </div>

        <div className="grid gap-4 p-8 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><CalendarDays className="h-4 w-4"/>Başlangıç</div>
            <p className="mt-3 font-medium text-slate-800">{new Date(meeting.startedAt).toLocaleString("tr-TR")}</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Clock3 className="h-4 w-4"/>Bitiş</div>
            <p className="mt-3 font-medium text-slate-800">{meeting.endedAt ? new Date(meeting.endedAt).toLocaleString("tr-TR") : "Belirtilmedi"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600"/>
          <div>
            <h2 className="text-xl font-bold">Konuşma Metni</h2>
            <p className="text-sm text-slate-500">Whisper tarafından oluşturuldu.</p>
          </div>
        </div>

        {meeting.transcriptSegments.length ? (
          <div className="space-y-4">
            {meeting.transcriptSegments.map(segment=>(
              <div key={segment.id} className="rounded-2xl border bg-slate-50 p-5">
                <p className="whitespace-pre-wrap leading-7 text-slate-700">{segment.text}</p>
              </div>
            ))}
          </div>
        ):(
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            <NotebookPen className="mx-auto mb-3 h-8 w-8"/>
            Konuşma metni bulunamadı.
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-amber-500"/>
          <div>
            <h2 className="text-xl font-bold">Yapay Zekâ Özeti</h2>
            <p className="text-sm text-slate-500">Toplantıdan oluşturulan özet</p>
          </div>
        </div>

        {meeting.notes.length ? (
          <div className="space-y-5">
            {meeting.notes.map(note=>(
              <div key={note.id} className="rounded-2xl border bg-slate-50 p-6">
                <article className="prose prose-slate max-w-none">
                  <ReactMarkdown>{note.markdownContent}</ReactMarkdown>
                </article>
                <div className="mt-6 flex justify-between border-t pt-4 text-sm">
                  <span className="text-slate-500">Model</span>
                  <span className="rounded-full bg-slate-200 px-3 py-1">{note.model}</span>
                </div>
              </div>
            ))}
          </div>
        ):(
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            <Sparkles className="mx-auto mb-3 h-8 w-8"/>
            Henüz yapay zekâ özeti oluşturulmamış.
          </div>
        )}
      </div>
    </div>
  );
}
