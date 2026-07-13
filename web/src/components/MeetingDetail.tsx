// web/src/components/MeetingDetail.tsx
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { downloadMeetingExport, type MeetingDetail as MeetingDetailModel } from "../lib/api";
import { MeetingChat } from "./MeetingChat";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MeetingDetailProps {
  meeting: MeetingDetailModel | null;
}

// AI özetinin markdown içeriği ("## Başlık" bloklarından oluşur, bkz.
// MeetingService.BuildMarkdownSummary) sadece GÖRÜNÜM amaçlı, her başlığı
// ayrı bir karta yerleştirmek için burada bölünür. Veri hâlâ tek parça
// `note.markdownContent` olarak API'den geliyor ve render için hâlâ
// ReactMarkdown kullanılıyor; bu sadece aynı string'i birden çok kez
// ReactMarkdown'a vermek anlamına geliyor.
interface SummarySection {
  heading: string;
  body: string;
}

function splitMarkdownSections(markdown: string): SummarySection[] {
  const chunks = markdown
    .split(/\n(?=##\s)/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (chunks.length === 0) {
    return [{ heading: "Özet", body: markdown.trim() }];
  }

  return chunks.map((chunk) => {
    const headingMatch = chunk.match(/^##\s+(.+)/);

    if (!headingMatch) {
      return { heading: "Özet", body: chunk };
    }

    const heading = headingMatch[1].trim();
    const body = chunk.slice(headingMatch[0].length).trim();

    return { heading, body };
  });
}

interface SectionStyle {
  match: RegExp;
  icon: ReactNode;
  iconBg: string;
}

const SECTION_STYLES: SectionStyle[] = [
  {
    match: /özet/i,
    icon: <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
  },
  {
    match: /karar/i,
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
  },
  {
    match: /aksiyon|yapılacak/i,
    icon: <ListChecks className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
  },
  {
    match: /risk|açık konu/i,
    icon: <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />,
    iconBg: "bg-red-100 dark:bg-red-500/15",
  },
  {
    match: /tartışma/i,
    icon: <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
    iconBg: "bg-violet-100 dark:bg-violet-500/15",
  },
];

const DEFAULT_SECTION_STYLE: Omit<SectionStyle, "match"> = {
  icon: <FileText className="h-4 w-4 text-slate-600 dark:text-slate-300" />,
  iconBg: "bg-slate-100 dark:bg-slate-700/60",
};

function getSectionStyle(heading: string) {
  return (
    SECTION_STYLES.find((style) => style.match.test(heading)) ??
    DEFAULT_SECTION_STYLE
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingDetail({ meeting }: MeetingDetailProps) {
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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-500/15">
            <FileText className="h-7 w-7 text-blue-700 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Toplantı Detayı</h2>
            <p className="text-slate-500 dark:text-slate-400">Soldaki listeden bir toplantı seçin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-xl text-white">
                  {meeting.title}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs text-slate-300">
                  Toplantı bilgileri
                </CardDescription>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("docx")}
              >
                {downloadingFormat === "docx" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                Word
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("pdf")}
              >
                {downloadingFormat === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-wrap items-center gap-2 bg-slate-50/60 py-3 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-400 dark:text-slate-500">Başlangıç</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {formatDateTime(meeting.startedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            <Clock3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-400 dark:text-slate-500">Bitiş</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {meeting.endedAt ? formatDateTime(meeting.endedAt) : "Belirtilmedi"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="summary" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            AI Özeti
          </TabsTrigger>
          <TabsTrigger value="transcript" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Konuşma Metni
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-5">
          {meeting.notes.length ? (
            meeting.notes.map((note) => {
              const sections = splitMarkdownSections(note.markdownContent);
              const isOdd = sections.length % 2 === 1;

              return (
                <div key={note.id} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sections.map((section, index) => {
                      const style = getSectionStyle(section.heading);
                      const isLastAndAlone = isOdd && index === sections.length - 1;

                      return (
                        <Card
                          key={`${note.id}-${index}`}
                          className={`gap-3 py-4 transition-shadow hover:shadow-md ${
                            isLastAndAlone ? "sm:col-span-2" : ""
                          }`}
                        >
                          <CardHeader className="px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                              >
                                {style.icon}
                              </div>
                              <CardTitle className="text-sm">{section.heading}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="px-4">
                            <article className="prose prose-slate prose-sm max-w-none prose-p:leading-6 prose-li:leading-6 dark:prose-invert">
                              <ReactMarkdown>
                                {section.body || "_Belirtilmedi._"}
                              </ReactMarkdown>
                            </article>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-2 dark:bg-slate-800/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Model</span>
                    <Badge variant="secondary">{note.model}</Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500 dark:text-slate-400">
                  <Sparkles className="mx-auto mb-3 h-8 w-8" />
                  Henüz yapay zekâ özeti oluşturulmamış.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/15">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Konuşma Metni</CardTitle>
                  <CardDescription className="text-xs">
                    Whisper tarafından oluşturuldu.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {meeting.transcriptSegments.length ? (
                <ScrollArea className="h-[250px] rounded-2xl border bg-slate-50 dark:bg-slate-800/40">
                  <div className="space-y-3 p-4">
                    {meeting.transcriptSegments.map((segment) => (
                      <div key={segment.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500 dark:text-slate-400">
                  <NotebookPen className="mx-auto mb-3 h-8 w-8" />
                  Konuşma metni bulunamadı.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MeetingChat meetingId={meeting.id} />
    </div>
  );
}
