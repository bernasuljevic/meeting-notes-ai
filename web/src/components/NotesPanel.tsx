import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Sparkles,
} from "lucide-react";

import type { SummarizeResponse } from "../lib/api";

interface NotesPanelProps {
  summary: SummarizeResponse | null;
  isSummarizing: boolean;
  error: string | null;
}

export function NotesPanel({
  summary,
  isSummarizing,
  error,
}: NotesPanelProps) {
  if (isSummarizing) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />

          <div>
            <h3 className="font-semibold text-slate-800">
              Yapay Zekâ Özeti Oluşturuluyor
            </h3>

            <p className="text-sm text-slate-500">
              Toplantı analiz ediliyor...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

          <div>
            <h3 className="font-semibold text-red-700">
              Özetleme Hatası
            </h3>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">

      {/* Başlık */}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">

              <Sparkles className="h-5 w-5 text-white" />

            </div>

            <div>

              <h2 className="text-xl font-bold text-white">
                Yapay Zekâ Özeti
              </h2>

              <p className="text-sm text-slate-300">
                Toplantının otomatik analizi
              </p>

            </div>

          </div>

        </div>

        <div className="p-6">

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">

            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">

              <Sparkles className="h-5 w-5 text-amber-500" />

              Genel Özet

            </h3>

            <p className="whitespace-pre-wrap leading-8 text-slate-700">
              {summary.generalSummary}
            </p>

          </div>

        </div>

      </div>

      {/* Kararlar */}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">

          <CheckCircle2 className="h-5 w-5 text-emerald-600" />

          Alınan Kararlar

        </h3>

        {summary.decisions.length > 0 ? (

          <ul className="space-y-3">

            {summary.decisions.map((decision, index) => (

              <li
                key={index}
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >

                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />

                <span className="text-slate-700">
                  {decision}
                </span>

              </li>

            ))}

          </ul>

        ) : (

          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
            Karar bulunamadı.
          </div>

        )}

      </div>

      {/* Yapılacaklar */}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">

          <ClipboardCheck className="h-5 w-5 text-blue-600" />

          Yapılacaklar

        </h3>

        {summary.actionItems.length > 0 ? (

          <ul className="space-y-3">

            {summary.actionItems.map((item, index) => (

              <li
                key={index}
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >

                <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-blue-600" />

                <span className="text-slate-700">
                  {item}
                </span>

              </li>

            ))}

          </ul>

        ) : (

          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
            Yapılacak madde bulunamadı.
          </div>

        )}

      </div>

    </div>
  );
}