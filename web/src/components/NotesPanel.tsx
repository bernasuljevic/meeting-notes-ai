// web/src/components/NotesPanel.tsx
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import type { SummarizeResponse } from "../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface NotesPanelProps {
  summary: SummarizeResponse | null;
  isSummarizing: boolean;
  error: string | null;
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
      {text}
    </div>
  );
}

export function NotesPanel({
  summary,
  isSummarizing,
  error,
}: NotesPanelProps) {
  if (isSummarizing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>Yapay Zekâ Özeti Oluşturuluyor</CardTitle>
              <CardDescription>Toplantı analiz ediliyor...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-700">Özetleme Hatası</h3>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Genel Özet */}
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white">Yapay Zekâ Özeti</CardTitle>
              <CardDescription className="text-slate-300">
                Toplantının otomatik analizi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Genel Özet
            </h3>
            <p className="whitespace-pre-wrap leading-8 text-slate-700">
              {summary.generalSummary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Kararlar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Alınan Kararlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.decisions.length > 0 ? (
            <ul className="space-y-3">
              {summary.decisions.map((decision, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="text-slate-700">{decision}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection text="Karar bulunamadı." />
          )}
        </CardContent>
      </Card>

      {/* Yapılacaklar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Yapılacaklar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.actionItems.length > 0 ? (
            <ul className="space-y-3">
              {summary.actionItems.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection text="Yapılacak madde bulunamadı." />
          )}
        </CardContent>
      </Card>

      {/* Açık Konular ve Riskler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Açık Konular ve Riskler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.openIssuesAndRisks.length > 0 ? (
            <ul className="space-y-3">
              {summary.openIssuesAndRisks.map((issue, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-600" />
                  <span className="text-slate-700">{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection text="Açık konu veya risk bulunamadı." />
          )}
        </CardContent>
      </Card>

      {/* Önemli Tartışma Noktaları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Önemli Tartışma Noktaları
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.keyDiscussionPoints.length > 0 ? (
            <ul className="space-y-3">
              {summary.keyDiscussionPoints.map((point, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <MessageSquare className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                  <span className="text-slate-700">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection text="Önemli tartışma noktası bulunamadı." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}