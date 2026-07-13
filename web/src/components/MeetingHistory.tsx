// web/src/components/MeetingHistory.tsx
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  FolderOpen,
  Loader2,
  Mic,
  Search,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteMeeting,
  getMeetings,
  type MeetingListItem,
} from "../lib/api";
import { formatDuration } from "../lib/meetingStats";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingHistorySkeleton } from "./MeetingHistorySkeleton";

interface MeetingHistoryProps {
  refreshKey: number;
  selectedMeetingId: string | null;
  onMeetingSelect: (id: string) => void;
  onMeetingDeleted: (id: string) => void;
  onStartRecording?: () => void;
}

type SortMode = "newest" | "oldest" | "title";
type DateFilter = "today" | "week" | "month" | "all";

interface MeetingGroup {
  label: string | null;
  items: MeetingListItem[];
}

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "all", label: "Tümü" },
];

function matchesDateFilter(iso: string, filter: DateFilter): boolean {
  if (filter === "all") return true;

  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today") {
    return date >= startOfToday;
  }

  if (filter === "week") {
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    return date >= startOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= startOfMonth;
}

// Sadece görünüm amaçlı yardımcılar: veri modeli/API değişmiyor,
// mevcut MeetingListItem alanlarından (startedAt/endedAt/title) türetiliyor.
function formatMeetingDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart}, ${timePart}`;
}

function sortMeetings(items: MeetingListItem[], mode: SortMode): MeetingListItem[] {
  const copy = [...items];

  switch (mode) {
    case "oldest":
      copy.sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      );
      break;
    case "title":
      copy.sort((a, b) => a.title.localeCompare(b.title, "tr"));
      break;
    case "newest":
    default:
      copy.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
  }

  return copy;
}

function getDateBucketLabel(iso: string): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const todayStart = startOfDay(new Date());
  const itemStart = startOfDay(new Date(iso));
  const diffDays = Math.round((todayStart - itemStart) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "Bugün";
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return "Bu Hafta";
  return "Daha Eski";
}

// Liste zaten tarihe göre sıralı geldiğinden (sortMode "newest"/"oldest"),
// aynı etikete sahip ardışık öğeler tek bir grup altında toplanır. İsme göre
// sıralamada tarih artık ardışık olmadığından gruplama anlamsızlaşır; bu
// durumda tek, başlıksız bir grup döner (düz liste).
function groupMeetings(items: MeetingListItem[], mode: SortMode): MeetingGroup[] {
  if (mode === "title") {
    return items.length > 0 ? [{ label: null, items }] : [];
  }

  const groups: MeetingGroup[] = [];

  for (const item of items) {
    const label = getDateBucketLabel(item.startedAt);
    const last = groups[groups.length - 1];

    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}

function highlightMatch(text: string, query: string): ReactNode {
  const trimmed = query.trim();

  if (!trimmed) return text;

  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-400/30 dark:text-amber-100">
        {text.slice(index, index + trimmed.length)}
      </mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}

export function MeetingHistory({
  refreshKey,
  selectedMeetingId,
  onMeetingSelect,
  onMeetingDeleted,
  onStartRecording,
}: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  useEffect(() => {
    async function loadMeetings() {
      try {
        setLoading(true);

        const result = await getMeetings();

        setMeetings(result);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Toplantılar yüklenemedi."
        );
      } finally {
        setLoading(false);
      }
    }

    loadMeetings();
  }, [refreshKey]);

  function requestDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    const id = pendingDeleteId;

    try {
      setDeletingId(id);
      await deleteMeeting(id);
      onMeetingDeleted(id);
      toast.success("Toplantı silindi.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Toplantı silinemedi."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredMeetings = meetings.filter(
    (meeting) =>
      meeting.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
      matchesDateFilter(meeting.startedAt, dateFilter)
  );

  const sortedMeetings = sortMeetings(filteredMeetings, sortMode);
  const meetingGroups = groupMeetings(sortedMeetings, sortMode);

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <FolderOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-white">Toplantılar</CardTitle>
            <CardDescription className="text-slate-300">
              Kaydedilen toplantılar
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-2 border-b bg-white p-3 dark:bg-slate-900">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Toplantı ara"
            className="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          aria-label="Sıralama"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="newest">En yeni</option>
          <option value="oldest">En eski</option>
          <option value="title">İsme göre (A-Z)</option>
        </select>

        <div className="flex gap-1">
          {DATE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="xs"
              variant={dateFilter === filter.value ? "default" : "outline"}
              className="flex-1"
              onClick={() => setDateFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {loading && <MeetingHistorySkeleton />}

      {error && <CardContent className="text-red-600 dark:text-red-400">{error}</CardContent>}

      {!loading && !error && meetings.length === 0 && (
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-500/15">
            <Mic className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Henüz toplantı yok
            </h3>
            <p className="mt-1 max-w-[220px] text-sm text-slate-500 dark:text-slate-400">
              İlk toplantını kaydettiğinde burada görünecek.
            </p>
          </div>
          <Button type="button" size="sm" className="mt-1 gap-1.5" onClick={onStartRecording}>
            <Mic className="h-3.5 w-3.5" />
            Kayıt Başlat
          </Button>
        </CardContent>
      )}

      {!loading && !error && meetings.length > 0 && filteredMeetings.length === 0 && (
        <CardContent className="py-10 text-center text-slate-500 dark:text-slate-400">
          Bu arama/filtreyle eşleşen toplantı yok.
        </CardContent>
      )}

      {!loading && !error && sortedMeetings.length > 0 && (
        <ScrollArea className="h-[70vh]">
          {meetingGroups.map((group, groupIndex) => (
            <div key={group.label ?? `flat-${groupIndex}`}>
              {group.label && (
                <div className="sticky top-0 z-10 bg-slate-50/95 px-3.5 py-1.5 text-xs font-semibold text-slate-500 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                  {group.label}
                </div>
              )}

              {group.items.map((meeting) => {
                const isSelected = selectedMeetingId === meeting.id;
                const isDeleting = deletingId === meeting.id;
                const duration = formatDuration(meeting.startedAt, meeting.endedAt);

                return (
                  <div
                    key={meeting.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onMeetingSelect(meeting.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        onMeetingSelect(meeting.id);
                      }
                    }}
                    className={`group relative flex w-full cursor-pointer items-start gap-3 border-b border-slate-100 p-3.5 text-left transition-all duration-200 dark:border-slate-800 ${
                      isSelected
                        ? "border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                      <FolderOpen className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate pr-8 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {highlightMatch(meeting.title, searchQuery)}
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatMeetingDateTime(meeting.startedAt)}
                        </span>
                        {duration && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5" />
                            {duration}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => requestDelete(e, meeting.id)}
                      disabled={isDeleting}
                      aria-label="Toplantıyı sil"
                      className="absolute top-3 right-3 h-7 w-7 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplantıyı sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu toplantıyı silmek istediğine emin misin? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
