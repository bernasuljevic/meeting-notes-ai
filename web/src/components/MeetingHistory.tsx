// web/src/components/MeetingHistory.tsx

import { Trash2 } from "lucide-react";
import { deleteMeeting } from "../lib/api";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FolderOpen,
  Loader2,
} from "lucide-react";

import {
  getMeetings,
  type MeetingListItem,
} from "../lib/api";

interface MeetingHistoryProps {
  refreshKey: number;
  selectedMeetingId: string | null;
  onMeetingSelect: (id: string) => void;
  onMeetingDeleted: () => void;
}

export function MeetingHistory({
  refreshKey,
  selectedMeetingId,
  onMeetingSelect,
  onMeetingDeleted,
}: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(
    e: React.MouseEvent,
    id: string
  ) {
    e.stopPropagation();

    if (
      !window.confirm(
        "Bu toplantıyı silmek istediğine emin misin? Bu işlem geri alınamaz."
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteMeeting(id);
      onMeetingDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Toplantı silinemedi."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-5">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">

            <FolderOpen className="h-5 w-5 text-white" />

          </div>

          <div>

            <h2 className="text-xl font-bold text-white">
              Toplantılar
            </h2>

            <p className="text-sm text-slate-300">
              Kaydedilen toplantılar
            </p>

          </div>

        </div>

      </div>

      {loading && (

        <div className="flex items-center justify-center gap-3 p-10 text-slate-500">

          <Loader2 className="h-5 w-5 animate-spin" />

          Toplantılar yükleniyor...

        </div>

      )}

      {error && (

        <div className="p-6 text-red-600">
          {error}
        </div>

      )}

      {!loading && !error && meetings.length === 0 && (

        <div className="p-10 text-center text-slate-500">

          Henüz kayıtlı toplantı bulunmuyor.

        </div>

      )}

      {!loading && !error && meetings.length > 0 && (

        <div className="max-h-[75vh] overflow-y-auto">

          {meetings.map((meeting) => {

            const isSelected =
              selectedMeetingId === meeting.id;

            const isDeleting = deletingId === meeting.id;

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
                className={`group relative w-full cursor-pointer border-b border-slate-100 p-5 text-left transition-all duration-200

${
  isSelected
    ? "border-l-4 border-l-blue-600 bg-blue-50"
    : "hover:bg-slate-50"
}`}
              >

                <button
                  type="button"
                  onClick={(e) => handleDelete(e, meeting.id)}
                  disabled={isDeleting}
                  aria-label="Toplantıyı sil"
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>

                <h3 className="truncate pr-8 text-base font-semibold text-slate-800">
                  {meeting.title}
                </h3>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">

                  <CalendarDays className="h-4 w-4" />

                  {new Date(
                    meeting.startedAt
                  ).toLocaleDateString("tr-TR")}

                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">

                  <Clock3 className="h-4 w-4" />

                  {new Date(
                    meeting.startedAt
                  ).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}

                </div>

              </div>

            );
          })}

        </div>

      )}

    </div>
  );
}