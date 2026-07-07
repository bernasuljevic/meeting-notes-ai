import { useState } from "react";

interface SaveMeetingPanelProps {
  onSave: (title: string) => void;
}

export function SaveMeetingPanel({
  onSave,
}: SaveMeetingPanelProps) {
  const [meetingTitle, setMeetingTitle] = useState("");

  return (
    <div className="w-full max-w-md rounded border border-gray-300 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">
        Toplantıyı Kaydet
      </h3>

      <label className="block text-sm text-gray-600 mb-1">
        Toplantı Başlığı
      </label>

      <input
        type="text"
        value={meetingTitle}
        onChange={(e) => setMeetingTitle(e.target.value)}
        placeholder="Örn: Haftalık Ekip Toplantısı"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
  type="button"
  onClick={() => onSave(meetingTitle)}
  disabled={meetingTitle.trim().length === 0}
  className="mt-4 w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 transition"
>
  Toplantıyı Kaydet
</button>
    </div>
  );
}