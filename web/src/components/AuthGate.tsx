// web/src/components/AuthGate.tsx
// Giriş yapılmadan uygulamanın hiçbir ekranı (kayıt, toplantı geçmişi, hiçbiri)
// görünmesin diye App.tsx bu bileşeni, kullanıcı giriş yapana kadar TEK BAŞINA
// render ediyor. Giriş yapılınca App.tsx normal uygulamaya geçiyor.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, LogIn, MailCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../lib/AuthContext";
import { EmailNotVerifiedError } from "../lib/api";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inputClassName =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

const RESEND_COOLDOWN_SECONDS = 60;

export function AuthGate() {
  const { login, register, verifyEmail, resendCode } = useAuth();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Dolu olduğunda Tabs yerine doğrulama kodu ekranı gösteriliyor - hem
  // kayıttan sonra hem de "e-posta doğrulanmadı" hatası alan bir login
  // denemesinden sonra buraya düşülüyor (bkz. handleLoginSubmit).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current !== null) {
        window.clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  function startResendCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    if (cooldownIntervalRef.current !== null) {
      window.clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current !== null) {
            window.clearInterval(cooldownIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    try {
      setIsLoggingIn(true);
      await login(loginUsername.trim(), loginPassword);
      toast.success("Giriş yapıldı.");
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        // Şifre doğruydu ama hesap hiç doğrulanmamış - kullanıcıyı doğrudan
        // kod girme ekranına geçiriyoruz, "hatalı giriş" gibi göstermiyoruz.
        setPendingEmail(err.email);
        toast.info("E-posta adresiniz henüz doğrulanmadı, kodu girin.");
      } else {
        setLoginError(err instanceof Error ? err.message : "Giriş yapılamadı.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError(null);

    try {
      setIsRegistering(true);
      const email = await register(
        registerUsername.trim(),
        registerEmail.trim(),
        registerPassword
      );
      setPendingEmail(email);
      startResendCooldown();
      toast.success("Kayıt alındı - e-postanıza gönderilen kodu girin.");
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Kayıt oluşturulamadı."
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);

    if (!pendingEmail) {
      return;
    }

    try {
      setIsVerifying(true);
      await verifyEmail(pendingEmail, verifyCode.trim());
      toast.success("E-posta doğrulandı, giriş yapıldı.");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Kod doğrulanamadı.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail || resendCooldown > 0) {
      return;
    }

    setVerifyError(null);

    try {
      setIsResending(true);
      await resendCode(pendingEmail);
      startResendCooldown();
      toast.success("Yeni kod gönderildi.");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Kod gönderilemedi.");
    } finally {
      setIsResending(false);
    }
  }

  function handleBackFromVerify() {
    setPendingEmail(null);
    setVerifyCode("");
    setVerifyError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo-wordmark.png" alt="MeetBrainz" className="mx-auto mb-2 h-16 w-auto" />
          <CardDescription>
            {pendingEmail
              ? "E-postanıza gönderilen kodu girin."
              : "Devam etmek için giriş yap ya da yeni bir hesap oluştur."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {pendingEmail ? (
            <form onSubmit={handleVerifySubmit} className="space-y-3 pt-2">
              <div className="flex items-start gap-3 rounded-xl border border-accent bg-accent/60 p-4 text-sm text-stone-700 dark:text-stone-300">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  <span className="font-medium text-stone-900 dark:text-stone-50">
                    {pendingEmail}
                  </span>{" "}
                  adresine 6 haneli bir doğrulama kodu gönderildi (10-15 dakika geçerli).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  Doğrulama kodu
                </label>
                <input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  disabled={isVerifying}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={`${inputClassName} text-center text-lg tracking-[0.5em]`}
                  placeholder="------"
                />
              </div>

              {verifyError && (
                <p className="text-sm text-red-600 dark:text-red-400">{verifyError}</p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isVerifying || verifyCode.trim().length !== 6}
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="h-4 w-4" />
                )}
                Doğrula ve Giriş Yap
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBackFromVerify}
                  className="flex items-center gap-1 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Geri dön
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline dark:disabled:text-stone-600"
                >
                  {resendCooldown > 0
                    ? `Kodu tekrar gönder (${resendCooldown}sn)`
                    : "Kodu tekrar gönder"}
                </button>
              </div>
            </form>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login">Giriş Yap</TabsTrigger>
                <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLoginSubmit} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      E-posta
                    </label>
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      disabled={isRegistering}
                      autoComplete="email"
                      className={inputClassName}
                      placeholder="ornek@eposta.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
                      !registerEmail.trim() ||
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
