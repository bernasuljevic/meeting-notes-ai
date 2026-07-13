// web/src/components/MeetingDetail.tsx
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  FileDown,
  FileText,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquare,
  NotebookPen,
  Printer,
  Sparkles,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { downloadMeetingExport, type MeetingDetail as MeetingDetailModel } from "../lib/api";
import {
  countWords,
  formatCompactCount,
  formatDuration,
  joinTranscript,
} from "../lib/meetingStats";
import { MeetingChat } from "./MeetingChat";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MeetingDetailProps {
  meeting: MeetingDetailModel | null;
  onBack?: () => void;
}

// AI özetinin markdown içeriği ("## Başlık" bloklarından oluşur, bkz.
// MeetingService.BuildMarkdownSummary) sadece GÖRÜNÜM amaçlı, her başlığı
// ayrı bir accordion bölümüne yerleştirmek için burada bölünür. Veri hâlâ
// tek parça `note.markdownContent` olarak API'den geliyor ve render için
// hâlâ ReactMarkdown kullanılıyor; bu sadece aynı string'i birden çok kez
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

async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Panoya kopyalanamadı.");
  }
}

export function MeetingDetail({ meeting, onBack }: MeetingDetailProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "pdf" | null>(null);
  const [isTranscriptFullscreen, setIsTranscriptFullscreen] = useState(false);

  async function handleDownload(format: "docx" | "pdf") {
    if (!meeting) return;

    try {
      setDownloadingFormat(format);
      await downloadMeetingExport(meeting.id, format, meeting.title);
      toast.info(format === "docx" ? "Word dosyası indirildi." : "PDF indirildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya indirilemedi.");
    } finally {
      setDownloadingFormat(null);
    }
  }

  function handlePrint() {
    window.print();
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

  const transcriptText = joinTranscript(meeting.transcriptSegments);
  const hasTranscript = meeting.transcriptSegments.length > 0;
  const hasSummary = meeting.notes.length > 0;

  const durationLabel = formatDuration(meeting.startedAt, meeting.endedAt) ?? "—";
  const wordCount = countWords(transcriptText);
  const transcriptCharCount = transcriptText.length;

  const statCards = [
    {
      key: "duration",
      icon: <Clock3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      iconBg: "bg-blue-100 dark:bg-blue-500/15",
      label: "Toplantı Süresi",
      value: durationLabel,
    },
    {
      key: "words",
      icon: <Type className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
      iconBg: "bg-violet-100 dark:bg-violet-500/15",
      label: "Toplam Kelime",
      value: hasTranscript ? formatCompactCount(wordCount) : "—",
    },
    {
      key: "length",
      icon: <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
      label: "Transkript Uzunluğu",
      value: hasTranscript ? `${formatCompactCount(transcriptCharCount)} krk` : "—",
    },
    {
      key: "summary",
      icon: <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-100 dark:bg-amber-500/15",
      label: "AI Özeti Durumu",
      value: hasSummary ? "Hazır" : "Bekliyor",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Ekranda görünen, yazdırmada gizlenen etkileşimli görünüm */}
      <div className="space-y-5 print:hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md px-1 py-0.5 font-medium text-slate-600 transition-colors hover:text-blue-600 hover:underline dark:text-slate-300 dark:hover:text-blue-400"
          >
            Toplantılar
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate font-medium text-slate-800 dark:text-slate-100">
            {meeting.title}
          </span>
        </div>

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

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePrint}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Yazdır
                </Button>
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.key} className="gap-0 py-3 shadow-sm">
              <CardContent className="flex items-center gap-2.5 px-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.iconBg}`}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                const sectionValues = sections.map((_, index) => `${note.id}-${index}`);

                return (
                  <div key={note.id} className="space-y-3">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-slate-500 dark:text-slate-400"
                        onClick={() =>
                          copyToClipboard(note.markdownContent, "AI özeti panoya kopyalandı.")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Kopyala
                      </Button>
                    </div>

                    <Accordion
                      type="multiple"
                      defaultValue={sectionValues}
                      className="space-y-3"
                    >
                      {sections.map((section, index) => {
                        const style = getSectionStyle(section.heading);

                        return (
                          <AccordionItem
                            key={`${note.id}-${index}`}
                            value={`${note.id}-${index}`}
                            className="rounded-2xl border bg-card px-4 transition-shadow hover:shadow-md"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                                >
                                  {style.icon}
                                </div>
                                <span className="text-sm font-semibold">{section.heading}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <article className="prose prose-slate prose-sm max-w-none prose-p:leading-6 prose-li:leading-6 dark:prose-invert">
                                <ReactMarkdown>
                                  {section.body || "_Belirtilmedi._"}
                                </ReactMarkdown>
                              </article>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
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

                  {hasTranscript && (
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-slate-500 dark:text-slate-400"
                        onClick={() =>
                          copyToClipboard(transcriptText, "Transkript panoya kopyalandı.")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Kopyala
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-slate-500 dark:text-slate-400"
                        onClick={() => setIsTranscriptFullscreen(true)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Tam Ekran
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {hasTranscript ? (
                  <Accordion type="single" collapsible defaultValue="transcript">
                    <AccordionItem value="transcript" className="border-b-0">
                      <AccordionTrigger className="py-1.5 text-xs font-normal text-slate-500 hover:no-underline dark:text-slate-400">
                        Metni göster/gizle
                      </AccordionTrigger>
                      <AccordionContent>
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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

      {/* Sadece yazdırmada görünen, sade/optimize edilmiş görünüm */}
      <div className="hidden print:block print:text-black">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Başlangıç: {formatDateTime(meeting.startedAt)}
          {meeting.endedAt ? ` · Bitiş: ${formatDateTime(meeting.endedAt)}` : ""}
        </p>

        {meeting.notes.map((note) => (
          <div key={note.id} className="mt-6">
            {splitMarkdownSections(note.markdownContent).map((section, index) => (
              <div key={index} className="mt-4 break-inside-avoid">
                <h2 className="text-base font-semibold">{section.heading}</h2>
                <article className="prose prose-sm max-w-none">
                  <ReactMarkdown>{section.body || "_Belirtilmedi._"}</ReactMarkdown>
                </article>
              </div>
            ))}
          </div>
        ))}

        {hasTranscript && (
          <div className="mt-6 break-before-page">
            <h2 className="text-base font-semibold">Konuşma Metni</h2>
            <p className="mt-2 text-sm whitespace-pre-wrap">{transcriptText}</p>
          </div>
        )}
      </div>

      {/* Transkript tam ekran modalı */}
      <Dialog open={isTranscriptFullscreen} onOpenChange={setIsTranscriptFullscreen}>
        <DialogContent className="max-w-3xl print:hidden">
          <DialogHeader>
            <DialogTitle>Konuşma Metni</DialogTitle>
            <DialogDescription>Whisper tarafından oluşturuldu.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] rounded-2xl border bg-slate-50 dark:bg-slate-800/40">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
