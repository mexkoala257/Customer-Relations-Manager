import { useState, useEffect } from "react";
import { getToken } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Watcher = { id: number; userId: string; email: string | null; createdAt: string };

interface WatchButtonProps {
  entityType: "lead" | "customer";
  entityId: string;
}

async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

export function WatchButton({ entityType, entityId }: WatchButtonProps) {
  const { userId } = useAuth();
  const { toast } = useToast();
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const isWatching = watchers.some((w) => w.userId === userId);
  const otherWatchers = watchers.filter((w) => w.userId !== userId);

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  async function load() {
    try {
      const r = await apiFetch(`/api/watchers/${entityType}/${entityId}`);
      if (r.ok) setWatchers(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    setToggling(true);
    try {
      const r = await apiFetch(`/api/watchers/${entityType}/${entityId}/toggle`, { method: "POST" });
      if (r.ok) {
        const { watching } = await r.json();
        await load();
        toast({
          title: watching ? "Now following" : "Unfollowed",
          description: watching
            ? "You'll get an email when status, notes, or follow-up date change."
            : "You will no longer receive updates for this record.",
        });
      }
    } finally {
      setToggling(false);
    }
  }

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Watcher avatars */}
      {watchers.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1.5">
            {watchers.slice(0, 4).map((w) => (
              <div
                key={w.id}
                className={cn(
                  "w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold",
                  w.userId === userId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                title={w.email ?? "Unknown"}
              >
                {(w.email ?? "?").charAt(0).toUpperCase()}
              </div>
            ))}
            {watchers.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{watchers.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {watchers.length === 1
              ? isWatching ? "You" : watchers[0].email?.split("@")[0]
              : isWatching
                ? otherWatchers.length > 0
                  ? `You +${otherWatchers.length}`
                  : "You"
                : `${watchers.length} watching`}
          </span>
        </div>
      )}

      {/* Follow / Unfollow button */}
      <button
        onClick={toggle}
        disabled={toggling}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition",
          isWatching
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
        title={isWatching ? "Unfollow — stop receiving update emails" : "Follow — get email updates when this changes"}
        data-testid="watch-button"
      >
        {toggling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isWatching ? (
          <Bell className="w-3.5 h-3.5" />
        ) : (
          <BellOff className="w-3.5 h-3.5" />
        )}
        {isWatching ? "Following" : "Follow"}
      </button>
    </div>
  );
}
