// web/src/components/AiSettingsDialog.tsx
import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../lib/AuthContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AiSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function AiSettingsDialog({ open, onOpenChange }: AiSettingsDialogProps) {
  const { aiProvider, aiModel, updateAiSettings } = useAuth();

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog her açıldığında, mevcut kayıtlı sağlayıcı/model ile önceden doldur.
  // API token'ı GÜVENLİK gereği backend hiç geri döndürmüyor (şifreli saklanıyor);
  // bu yüzden token alanı her zaman boş başlar — "boş bırak = değiştirme" mantığı
  // zaten bunu bekliyor.
  useEffect(() => {
    if (open) {
      setProvider(aiProvider ?? "");
      setModel(aiModel ?? "");
      setApiToken("");
      setError(null);
    }
  }, [open, aiProvider, aiModel]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      setIsSaving(true);
      await updateAiSettings(provider.trim(), model.trim(), apiToken.trim());
      toast.success("AI ayarları kaydedildi.");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI ayarları kaydedilemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI Ayarları
          </DialogTitle>
          <DialogDescription>
            Hangi yapay zekâ sağlayıcısını ve modelini kullanmak istediğini
            kendi API token'ınla birlikte gir. Örn. sağlayıcı: "claude", model:
            "claude-opus-4-20250514" ya da sağlayıcı: "ollama", model: "llama3"
            (Ollama yerel çalıştığı için token gerekmez).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              AI sağlayıcı
            </label>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={isSaving}
              className={inputClassName}
              placeholder="örn. claude, ollama"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Model
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isSaving}
              className={inputClassName}
              placeholder="örn. claude-opus-4-20250514, llama3"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              API Token{" "}
              <span className="font-normal text-slate-400">
                (opsiyonel — boş bırakırsan mevcut token değişmez)
              </span>
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              disabled={isSaving}
              autoComplete="off"
              className={inputClassName}
              placeholder="sk-ant-..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              className="gap-2"
              disabled={isSaving || !provider.trim() || !model.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
