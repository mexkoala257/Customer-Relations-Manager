import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/api";
import { MessageSquare, X, Clock } from "lucide-react";

interface DM {
  id: number;
  body: string;
  createdAt: string;
  fromName: string | null;
  fromEmail: string;
}

function senderLabel(dm: DM) {
  if (dm.fromName?.trim()) return dm.fromName.trim().split(/\s+/)[0];
  return dm.fromEmail.split("@")[0];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const SESSION_KEY = "dm_modal_shown";

export function DirectMessageModal() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const token = getToken();
    if (!token) return;

    fetch("/api/dm/inbox", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: DM[]) => {
        const unread = data.filter((m) => !m.firstViewedAt);
        if (unread.length > 0) {
          setMessages(unread);
          setOpen(true);
        }
        sessionStorage.setItem(SESSION_KEY, "1");
      })
      .catch(() => {
        sessionStorage.setItem(SESSION_KEY, "1");
      });
  }, [isAuthenticated]);

  function dismiss() {
    setOpen(false);
    const token = getToken();
    if (token) {
      fetch("/api/dm/mark-viewed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
  }

  if (!open || messages.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                {messages.length === 1 ? "1 new message" : `${messages.length} new messages`}
              </h2>
              <p className="text-xs text-muted-foreground">From your teammates</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="dm-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{senderLabel(msg)}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {timeAgo(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{msg.body}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Messages are kept for 5 days</span>
          <button
            onClick={dismiss}
            className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            data-testid="dm-modal-dismiss"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
