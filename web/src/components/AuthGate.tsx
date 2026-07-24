// web/src/components/AuthGate.tsx
// Giriş yapılmadan uygulamanın hiçbir ekranı (kayıt, toplantı geçmişi, hiçbiri)
// görünmesin diye App.tsx bu bileşeni, kullanıcı giriş yapana kadar TEK BAŞINA
// render ediyor. Giriş yapılınca App.tsx normal uygulamaya geçiyor.
import { useState } from "react";
import { Loader2, LogIn, Mic, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../lib/AuthContext";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function AuthGate() {
  const { login, register } = useAuth();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    try {
      setIsLoggingIn(true);
      await login(loginUsername.trim(), loginPassword);
      toast.success("Giriş yapıldı.");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError(null);

    try {
      setIsRegistering(true);
      await register(registerUsername.trim(), registerPassword);
      toast.success("Hesap oluşturuldu, giriş yapıldı.");
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Kayıt oluşturulamadı."
      );
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
            <Mic className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Toplantı Notları AI</CardTitle>
          <CardDescription>
            Devam etmek için giriş yap ya da yeni bir hesap oluştur.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="w-full">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Kullanıcı adı
                  </label>
                  <input
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    disabled={isLoggingIn}
                    autoComplete="username"
                    className={inputClassName}
                    placeholder="kullaniciadi"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Şifre
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoggingIn}
                    autoComplete="current-password"
                    className={inputClassName}
                    placeholder="••••••••"
                  />
                </div>

                {loginError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loginError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={
                    isLoggingIn || !loginUsername.trim() || !loginPassword
                  }
                >
                  {isLoggingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Giriş Yap
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Kullanıcı adı
                  </label>
                  <input
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    disabled={isRegistering}
                    autoComplete="username"
                    className={inputClassName}
                    placeholder="en az 3 karakter"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Şifre
                  </label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isRegistering}
                    autoComplete="new-password"
                    className={inputClassName}
                    placeholder="en az 6 karakter"
                  />
                </div>

                {registerError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {registerError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={
                    isRegistering ||
                    registerUsername.trim().length < 3 ||
                    registerPassword.length < 6
                  }
                >
                  {isRegistering ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Kayıt Ol
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
