// web/src/components/MeetingChat.tsx
import { useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { askMeetingQuestion } from "../lib/api";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MeetingChatProps {
  meetingId: string;
}

interface QaPair {
  question: string;
  answer: string;
}

export function MeetingChat({ meetingId }: MeetingChatProps) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QaPair[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  async function handleAsk() {
    const trimmed = question.trim();

    if (!trimmed || isAsking) {
      return;
    }

    setIsAsking(true);
    setQuestion("");

    try {
      const answer = await askMeetingQuestion(meetingId, trimmed);
      setHistory((prev) => [...prev, { question: trimmed, answer }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Soru cevaplanamadı.");
      setQuestion(trimmed);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-blue-600" />
          <div>
            <CardTitle>Yapay Zekâ Sohbet</CardTitle>
            <CardDescription>
              Toplantı hakkında soru sor, cevap transkriptten üretilir.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {history.length > 0 && (
          <ScrollArea className="h-72 rounded-2xl border bg-slate-50 dark:bg-slate-800/60">
            <div className="space-y-4 p-4">
              {history.map((qa, index) => (
                <div key={index} className="space-y-2">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white">
                    {qa.question}
                  </div>
                  <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border bg-white px-4 py-2 text-sm whitespace-pre-wrap text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {qa.answer}
                  </div>
                </div>
              ))}

              {isAsking && (
                <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm border bg-white px-4 py-2 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Yanıt hazırlanıyor...
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Örn: Bu toplantıda bütçe konuşuldu mu?"
            disabled={isAsking}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button
            type="button"
            className="gap-2"
            disabled={isAsking || !question.trim()}
            onClick={handleAsk}
          >
            {isAsking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Sor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
