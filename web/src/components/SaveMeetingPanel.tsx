import { useState } from "react";
import { Save, Type } from "lucide-react";

interface SaveMeetingPanelProps {
  onSave: (title: string) => void;
}

export function SaveMeetingPanel({
  onSave,
}: SaveMeetingPanelProps) {
  const [meetingTitle, setMeetingTitle] = useState("");

  const canSave = meetingTitle.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Save className="h-5 w-5 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">
              Toplantıyı Kaydet
            </h2>

            <p className="text-sm text-emerald-100">
              Toplantıyı veritabanına kaydedin
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-6">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Type className="h-4 w-4 text-slate-500" />
            Toplantı Başlığı
          </label>

          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Örn: Haftalık Ekip Toplantısı"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <button
          type="button"
          onClick={() => onSave(meetingTitle.trim())}
          disabled={!canSave}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          Toplantıyı Kaydet
        </button>
      </div>
    </div>
  );
}