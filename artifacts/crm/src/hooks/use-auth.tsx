import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { getToken, clearToken } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  userRole: string | null;
  userEmail: string | null;
  staffId: number | null;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userId: null,
  userRole: null,
  userEmail: null,
  staffId: null,
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());

  const { data: user, isLoading, error } = useGetMe({
    query: { enabled: !!token, retry: false },
  });

  useEffect(() => {
    const handleStorage = () => setTokenState(getToken());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function logout() {
    clearToken();
    setTokenState(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!(token && user && !error),
        userId: user?.id ?? null,
        userRole: user?.role ?? null,
        userEmail: user?.email ?? null,
        staffId: user?.staffId ?? null,
        logout,
        isLoading: !!token && isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
