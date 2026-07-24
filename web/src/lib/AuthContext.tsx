// web/src/lib/AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getMe,
  loginUser,
  registerUser,
  updateAiSettings as updateAiSettingsRequest,
  type MeResponse,
} from "./api";

const TOKEN_STORAGE_KEY = "meetingNotesAi.token";

interface AuthContextValue {
  token: string | null;
  username: string | null;
  hasAiConfigured: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateAiSettings: (
    provider: string,
    model: string,
    apiToken?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Uygulama açılışında (veya token değiştiğinde) kayıtlı token'ın hâlâ geçerli
  // olup olmadığını /api/auth/me ile doğrula; geçersizse (örn. süresi dolmuş)
  // sessizce çıkış yaptır.
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        setMe(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await getMe(token);

        if (!cancelled) {
          setMe(result);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setMe(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMe();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginUser(username, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    setToken(result.token);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const result = await registerUser(username, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    setToken(result.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setMe(null);
  }, []);

  const updateAiSettings = useCallback(
    async (provider: string, model: string, apiToken?: string) => {
      if (!token) {
        throw new Error("Önce giriş yapmalısın.");
      }

      await updateAiSettingsRequest(token, provider, model, apiToken);

      // Backend'den güncel hasAiConfigured/aiProvider/aiModel bilgisini tazele.
      const result = await getMe(token);
      setMe(result);
    },
    [token]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      username: me?.username ?? null,
      hasAiConfigured: me?.hasAiConfigured ?? false,
      aiProvider: me?.aiProvider ?? null,
      aiModel: me?.aiModel ?? null,
      isLoading,
      isAuthenticated: token !== null && me !== null,
      login,
      register,
      logout,
      updateAiSettings,
    }),
    [token, me, isLoading, login, register, logout, updateAiSettings]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth, bir AuthProvider içinde kullanılmalı.");
  }

  return context;
}
