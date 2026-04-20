import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/api";
import { KeyRound, Eye, EyeOff, ShieldAlert } from "lucide-react";

export function ForcePasswordModal() {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to update password.");
        return;
      }

      setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Password Change Required</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your account was set up with a temporary password. Please create a new password before continuing.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {success ? (
            <div className="text-center py-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-foreground">Password updated!</p>
              <p className="text-sm text-muted-foreground">You can now access the application.</p>
            </div>
          ) : (
            <>
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Current (Temporary) Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    autoFocus
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background pr-10 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNext ? "text" : "password"}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background pr-10 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNext((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Repeat new password"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground font-semibold rounded-xl py-2.5 text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Updating…" : "Set New Password & Continue"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
