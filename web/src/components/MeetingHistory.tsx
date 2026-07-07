import { useEffect, useState } from "react";
import {
  getMeetings,
  getMeeting,
  type MeetingListItem,
  type MeetingDetail,
} from "../lib/api";

import { MeetingDetail as MeetingDetailComponent } from "./MeetingDetail";

interface MeetingHistoryProps {
  refreshKey: number;
}

export function MeetingHistory({
  refreshKey,
}: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [selectedMeeting, setSelectedMeeting] =
    useState<MeetingDetail | null>(null);

  const [loadingMeeting, setLoadingMeeting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeetings() {
      try {
        const result = await getMeetings();
        setMeetings(result);
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

  async function handleMeetingClick(id: string) {
    try {
      setLoadingMeeting(true);

      const meeting = await getMeeting(id);

      console.log("Meeting:", meeting);
      console.log("Transcript:", meeting.transcriptSegments);
      console.log("Notes:", meeting.notes);

      setSelectedMeeting(meeting);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Toplantı yüklenemedi."
      );
    } finally {
      setLoadingMeeting(false);
    }
  }

  if (loading) {
    return <p>Toplantılar yükleniyor...</p>;
  }

  if (error) {
    return (
      <p className="text-red-500">
        {error}
      </p>
    );
  }

  return (
    <div className="w-full max-w-3xl rounded border border-gray-300 p-4">
      <h2 className="text-xl font-semibold mb-4">
        Toplantı Geçmişi
      </h2>

      {meetings.length === 0 ? (
        <p>Henüz toplantı bulunmuyor.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const isSelected = selectedMeeting?.id === meeting.id;

            return (
              <div
                key={meeting.id}
                onClick={() => handleMeetingClick(meeting.id)}
                className={`rounded border p-4 cursor-pointer transition-all shadow-sm ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-300 hover:bg-gray-50 hover:shadow-md"
                }`}
              >
                <h3 className="text-lg font-semibold">
                  {meeting.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  <span className="font-medium">Başlangıç:</span>{" "}
                  {new Date(meeting.startedAt).toLocaleString()}
                </p>

                {meeting.endedAt && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Bitiş:</span>{" "}
                    {new Date(meeting.endedAt).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loadingMeeting && (
        <p className="mt-4">
          Toplantı yükleniyor...
        </p>
      )}

      <MeetingDetailComponent meeting={selectedMeeting} />
    </div>
  );
}