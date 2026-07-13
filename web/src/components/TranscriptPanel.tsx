// web/src/components/TranscriptPanel.tsx
import { AlertTriangle, FileText, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptPanelProps {
  transcript: string | null;
  isTranscribing: boolean;
  error: string | null;
}

export function TranscriptPanel({
  transcript,
  isTranscribing,
  error,
}: TranscriptPanelProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
        <CardContent className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="font-semibold text-red-700 dark:text-red-300">Transkripsiyon Hatası</h3>
            <p className="mt-1 text-sm text-red-600 dark:text-red-300/90">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transcript && !isTranscribing) {
    return null;
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white">Transkript</CardTitle>
              <CardDescription className="text-slate-300">
                Whisper tarafından oluşturulan konuşma metni
              </CardDescription>
            </div>
          </div>

          {isTranscribing && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              İşleniyor
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="py-6">
        <ScrollArea className="h-72 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
          {transcript ? (
            <p className="whitespace-pre-wrap leading-8 text-slate-700 dark:text-slate-300">
              {transcript}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Transkript oluşturuluyor...</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}