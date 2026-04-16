import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken } from "@/lib/api";
import { TrendingUp, Loader2 } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { settings } = useAppSettings();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        window.location.href = "/";
      },
      onError: () => {
        setError("Invalid email or password. Please try again.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ data: { email, password } });
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent mb-4 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <TrendingUp className="w-7 h-7 text-accent-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{settings.companyName}</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                data-testid="login-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                data-testid="login-password"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
              data-testid="login-submit"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Demo credentials</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail("admin@crm.com"); setPassword("admin123"); }}
                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition text-center"
              >
                <div className="font-medium text-foreground">Admin</div>
                <div>admin@crm.com</div>
              </button>
              <button
                type="button"
                onClick={() => { setEmail("sarah@crm.com"); setPassword("sales123"); }}
                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition text-center"
              >
                <div className="font-medium text-foreground">Sales Rep</div>
                <div>sarah@crm.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
