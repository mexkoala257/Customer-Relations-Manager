import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bug, Trash2, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, StickyNote, Save } from "lucide-react";

type Severity = "low" | "medium" | "high";
type Status = "open" | "in_progress" | "resolved";

type BugReport = {
  id: number;
  title: string;
  description: string;
  severity: Severity;
  pageUrl: string | null;
  status: Status;
  adminNotes: string | null;
  createdAt: string;
  reporterEmail: string | null;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_STYLES: Record<Status, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  resolved: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<Status, React.ElementType> = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

export default function AdminBugReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [updating, setUpdating] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch("/api/bug-reports");
      setReports(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, status: Status) {
    setUpdating(id);
    const r = await apiFetch(`/api/bug-reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setReports((prev) => prev.map((rep) => rep.id === id ? { ...rep, status } : rep));
      toast({ title: "Status updated" });
    } else {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
    setUpdating(null);
  }

  async function saveNotes(id: number) {
    setSavingNotes(id);
    const notes = notesDraft[id] ?? (reports.find(r => r.id === id)?.adminNotes || "");
    const r = await apiFetch(`/api/bug-reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ adminNotes: notes }),
    });
    if (r.ok) {
      setReports((prev) => prev.map((rep) => rep.id === id ? { ...rep, adminNotes: notes } : rep));
      toast({ title: "Notes saved" });
    } else {
      toast({ title: "Failed to save notes", variant: "destructive" });
    }
    setSavingNotes(null);
  }

  async function del(id: number) {
    await apiFetch(`/api/bug-reports/${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
    toast({ title: "Report deleted" });
  }

  const filtered = statusFilter === "all" ? reports : reports.filter((r) => r.status === statusFilter);
  const counts = { open: reports.filter(r => r.status === "open").length, in_progress: reports.filter(r => r.status === "in_progress").length, resolved: reports.filter(r => r.status === "resolved").length };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="w-6 h-6 text-primary" />
            Bug Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and manage issues reported by users</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["open", "in_progress", "resolved"] as Status[]).map((s) => {
            const Icon = STATUS_ICONS[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border text-left transition",
                  statusFilter === s ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-xl font-bold leading-none">{counts[s]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">{s.replace("_", " ")}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reports found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((rep) => {
              const isOpen = expanded === rep.id;
              const StatusIcon = STATUS_ICONS[rep.status];
              return (
                <div key={rep.id} className="bg-background rounded-xl border border-border overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition"
                    onClick={() => setExpanded(isOpen ? null : rep.id)}
                  >
                    <StatusIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">#{rep.id} {rep.title}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex-shrink-0", SEVERITY_STYLES[rep.severity])}>
                          {rep.severity}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", STATUS_STYLES[rep.status])}>
                          {rep.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rep.reporterEmail ?? "Unknown"} · {formatTime(rep.createdAt)}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      {rep.pageUrl && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Page</p>
                          <p className="text-sm font-mono text-muted-foreground">{rep.pageUrl}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{rep.description}</p>
                      </div>
                      {/* Admin Notes */}
                      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                          <StickyNote className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Notes</span>
                          {rep.adminNotes && (
                            <span className="ml-auto text-xs text-accent font-medium">Saved</span>
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          <textarea
                            rows={4}
                            placeholder="Add internal notes about this bug — steps to reproduce, root cause, fix applied, etc."
                            value={notesDraft[rep.id] ?? (rep.adminNotes || "")}
                            onChange={(e) => setNotesDraft((prev) => ({ ...prev, [rep.id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={() => saveNotes(rep.id)}
                              disabled={savingNotes === rep.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 transition"
                            >
                              {savingNotes === rep.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Save className="w-3.5 h-3.5" />}
                              Save Notes
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Status:</span>
                          <select
                            value={rep.status}
                            onChange={(e) => updateStatus(rep.id, e.target.value as Status)}
                            disabled={updating === rep.id}
                            className="text-sm px-2.5 py-1.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          {updating === rep.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        </div>
                        <button
                          onClick={() => del(rep.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
