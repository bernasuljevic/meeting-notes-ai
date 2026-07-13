import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Recorder } from "./components/Recorder";
import { MeetingHistory } from "./components/MeetingHistory";
import { MeetingDetail } from "./components/MeetingDetail";
import { MeetingDetailSkeleton } from "./components/MeetingDetailSkeleton";
import { ModeToggle } from "./components/mode-toggle";
import {
  getMeeting,
  type MeetingDetail as MeetingDetailModel,
} from "./lib/api";

const API_BASE_URL = "";

function App() {
  const [apiMessage, setApiMessage] = useState("Bağlanıyor...");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedMeetingId, setSelectedMeetingId] =
    useState<string | null>(null);

  const [selectedMeeting, setSelectedMeeting] =
    useState<MeetingDetailModel | null>(null);

  const [loadingMeeting, setLoadingMeeting] =
    useState(false);

  useEffect(() => {
    async function pingApi() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/ping`
        );

        const data = await response.json();

        setApiMessage(data.message);
      } catch {
        setApiMessage("API bağlantı hatası");
      }
    }

    pingApi();
  }, []);

  useEffect(() => {
    async function loadMeeting() {
      if (!selectedMeetingId) {
        setSelectedMeeting(null);
        return;
      }

      try {
        setLoadingMeeting(true);

        const meeting = await getMeeting(
          selectedMeetingId
        );

        setSelectedMeeting(meeting);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMeeting(false);
      }
    }

    loadMeeting();
  }, [selectedMeetingId]);

  // İnternet bağlantısı kesilir/geri gelirse kullanıcıyı toast ile bilgilendir.
  useEffect(() => {
    function handleOffline() {
      toast.warning("İnternet bağlantısı yok.");
    }

    function handleOnline() {
      toast.success("İnternet bağlantısı geri geldi.");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  function handleMeetingSaved() {
    setRefreshKey((prev) => prev + 1);
  }

  function handleNewMeeting() {
    setSelectedMeetingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">

      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">

          <div>

            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Toplantı Notları AI
            </h1>

            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Yapay zekâ destekli toplantı asistanı
            </p>

          </div>

          <div className="flex items-center gap-3">

            <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
              ✅ {apiMessage}
            </div>

            <ModeToggle />

          </div>

        </div>

      </header>

      {/* CONTENT */}

      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-6 p-6 print:block print:p-0">

        {/* SOL TARAF */}

        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 print:hidden">

          <MeetingHistory
            refreshKey={refreshKey}
            selectedMeetingId={selectedMeetingId}
            onMeetingSelect={setSelectedMeetingId}
            onMeetingDeleted={(deletedId) => {
              setRefreshKey((x) => x + 1);
              setSelectedMeetingId((current) =>
                current === deletedId ? null : current
              );
            }}
            onStartRecording={handleNewMeeting}
          />

        </aside>

        {/* SAĞ TARAF */}

        <section className="col-span-12 lg:col-span-8 xl:col-span-9 print:col-span-12">

          {loadingMeeting ? (

            <MeetingDetailSkeleton />

          ) : selectedMeeting ? (

            <MeetingDetail
              meeting={selectedMeeting}
              onBack={handleNewMeeting}
            />

          ) : (

            <Recorder
              onMeetingSaved={handleMeetingSaved}
            />

          )}

        </section>

      </main>

      {/* FLOATING BUTTON */}

      {selectedMeeting && (

        <button
          onClick={handleNewMeeting}
          className="fixed bottom-6 right-6 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg transition hover:bg-blue-700 print:hidden"
        >
          + Yeni Toplantı
        </button>

      )}

    </div>
  );
}

export default App;
