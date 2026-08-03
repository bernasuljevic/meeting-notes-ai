// web/src/components/MeetingChat.tsx
import { useState } from "react";
import { Loader2, LogIn, MessageCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { askMeetingQuestion } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

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
  // Giriş yapılmamışsa/AI ayarlanmamışsa kullanıcıya ilgili dialogu açma imkânı
  // sunmak için (App.tsx'ten geçilir).
  onOpenLogin?: () => void;
  onOpenAiSettings?: () => void;
}

interface QaPair {
  question: string;
  answer: string;
}

export function MeetingChat({
  meetingId,
  onOpenLogin,
  onOpenAiSettings,
}: MeetingChatProps) {
  const { token, isAuthenticated, hasAiConfigured } = useAuth();

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QaPair[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const canAsk = isAuthenticated && hasAiConfigured && token !== null;

  async function handleAsk() {
    const trimmed = question.trim();

    if (!trimmed || isAsking || !token) {
      return;
    }

    setIsAsking(true);
    setQuestion("");

    try {
      const answer = await askMeetingQuestion(meetingId, trimmed, token);
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
          <MessageCircle className="h-6 w-6 text-amber-600" />
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
          <ScrollArea className="h-72 rounded-2xl border bg-stone-50 dark:bg-stone-800/60">
            <div className="space-y-4 p-4">
              {history.map((qa, index) => (
                <div key={index} className="space-y-2">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-amber-600 px-4 py-2 text-sm text-white">
                    {qa.question}
                  </div>
                  <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border bg-white px-4 py-2 text-sm whitespace-pre-wrap text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                    {qa.answer}
                  </div>
                </div>
              ))}

              {isAsking && (
                <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm border bg-white px-4 py-2 text-sm text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Yanıt hazırlanıyor...
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {canAsk ? (
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
              className="flex-1 rounded-xl border border-stone-200 px-4 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
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
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:border-amber-600/20 dark:bg-amber-600/10 dark:text-amber-300">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Toplantıyla sohbet edebilmek için giriş yapıp AI ayarlarını
                (sağlayıcı/model/token) tamamlaman gerekiyor.
              </p>
            </div>

            {(onOpenLogin || onOpenAiSettings) && (
              <div className="flex shrink-0 gap-2">
                {!isAuthenticated && onOpenLogin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onOpenLogin}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Giriş Yap
                  </Button>
                )}
                {isAuthenticated && !hasAiConfigured && onOpenAiSettings && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onOpenAiSettings}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Ayarları
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
