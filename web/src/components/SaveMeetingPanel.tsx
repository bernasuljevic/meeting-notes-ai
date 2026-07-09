// web/src/components/SaveMeetingPanel.tsx
import { useState } from "react";
import { Save, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SaveMeetingPanelProps {
  onSave: (title: string) => void;
}

export function SaveMeetingPanel({ onSave }: SaveMeetingPanelProps) {
  const [meetingTitle, setMeetingTitle] = useState("");

  const canSave = meetingTitle.trim().length > 0;

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-600 to-emerald-700 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Save className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-white">Toplantıyı Kaydet</CardTitle>
            <CardDescription className="text-emerald-100">
              Toplantıyı veritabanına kaydedin
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 py-6">
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

        <Button
          type="button"
          onClick={() => onSave(meetingTitle.trim())}
          disabled={!canSave}
          size="lg"
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="h-5 w-5" />
          Toplantıyı Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}