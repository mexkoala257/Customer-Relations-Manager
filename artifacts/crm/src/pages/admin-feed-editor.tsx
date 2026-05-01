import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Loader2, Save, ArrowUp, ArrowDown, Eye, EyeOff,
  ArrowUpDown, RefreshCw, MessageSquare, Zap,
} from "lucide-react";

interface FeedField { key: string; label: string; enabled: boolean }
interface FeedConfig { fields: FeedField[]; sortOrder: "asc" | "desc" }

const FEEDS = [
  { id: "messages", label: "Messages", icon: MessageSquare, endpoint: "/api/team/messages" },
  { id: "updates",  label: "Quick Updates", icon: Zap, endpoint: "/api/team/updates" },
];

function authHeader() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function FeedEditor({ feedId, endpoint }: { feedId: string; endpoint: string }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<FeedConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetch(`/api/feed-config/${feedId}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d: FeedConfig) => setConfig(d))
      .catch(() => toast({ title: "Failed to load config", variant: "destructive" }));
  }, [feedId]);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/feed-config/${feedId}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Feed config saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      await save();
      const res = await fetch(endpoint, { headers: authHeader() });
      const data = await res.json();
      setPreview(JSON.stringify(data.slice(0, 3), null, 2));
    } catch {
      setPreview("Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  function toggleField(key: string) {
    setConfig((prev) => prev ? {
      ...prev,
      fields: prev.fields.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f),
    } : prev);
  }

  function moveField(key: string, dir: -1 | 1) {
    setConfig((prev) => {
      if (!prev) return prev;
      const fields = [...prev.fields];
      const idx = fields.findIndex((f) => f.key === key);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= fields.length) return prev;
      [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
      return { ...prev, fields };
    });
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = config.fields.filter((f) => f.enabled).length;

  return (
    <div className="space-y-5">
      {/* Sort order */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sort Order</p>
        <div className="flex gap-2">
          {(["desc", "asc"] as const).map((order) => (
            <button
              key={order}
              onClick={() => setConfig((p) => p ? { ...p, sortOrder: order } : p)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition",
                config.sortOrder === order
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-background border-border text-muted-foreground hover:border-accent/50"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {order === "desc" ? "Newest first" : "Oldest first"}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fields
          </p>
          <span className="text-xs text-muted-foreground">{enabledCount} of {config.fields.length} visible</span>
        </div>
        <div className="divide-y divide-border">
          {config.fields.map((field, idx) => (
            <div key={field.key} className="flex items-center gap-3 px-4 py-3">
              {/* Up/down */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveField(field.key, -1)}
                  disabled={idx === 0}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveField(field.key, 1)}
                  disabled={idx === config.fields.length - 1}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Order badge */}
              <span className={cn(
                "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0",
                field.enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
              )}>
                {field.enabled ? idx + 1 : "–"}
              </span>

              {/* Label + key */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", !field.enabled && "text-muted-foreground")}>
                  {field.label}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{field.key}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleField(field.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition flex-shrink-0",
                  field.enabled
                    ? "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
                    : "bg-muted text-muted-foreground border-border hover:border-accent/30"
                )}
              >
                {field.enabled
                  ? <><Eye className="w-3 h-3" /> Visible</>
                  : <><EyeOff className="w-3 h-3" /> Hidden</>
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
        <button
          onClick={loadPreview}
          disabled={loadingPreview}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 disabled:opacity-50 transition border border-border"
        >
          {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Save & Preview
        </button>
      </div>

      {/* JSON preview */}
      {preview && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Feed Preview (first 3 records)</p>
          </div>
          <pre className="text-xs leading-relaxed p-4 overflow-x-auto bg-background text-foreground font-mono whitespace-pre-wrap break-all">
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AdminFeedEditorPage() {
  const [activeFeed, setActiveFeed] = useState("messages");
  const active = FEEDS.find((f) => f.id === activeFeed)!;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Feed Editor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control which fields appear in each JSON feed and the order they are returned in.
          </p>
        </div>

        {/* Feed tabs */}
        <div className="flex gap-2 border-b border-border">
          {FEEDS.map((feed) => (
            <button
              key={feed.id}
              onClick={() => setActiveFeed(feed.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
                activeFeed === feed.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <feed.icon className="w-3.5 h-3.5" />
              {feed.label}
            </button>
          ))}
        </div>

        <FeedEditor key={activeFeed} feedId={activeFeed} endpoint={active.endpoint} />
      </div>
    </AppLayout>
  );
}
