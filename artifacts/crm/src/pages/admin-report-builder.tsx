import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  Activity,
  Calendar,
  AlertTriangle,
  Trophy,
  Users,
  Send,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Mail,
} from "lucide-react";

type ReportSectionId =
  | "pipeline_summary"
  | "recent_activity"
  | "upcoming_followups"
  | "overdue_leads"
  | "won_leads"
  | "top_performers";

type ReportSection = {
  id: ReportSectionId;
  enabled: boolean;
  daysBack?: number;
  daysAhead?: number;
};

type SectionDef = {
  id: ReportSectionId;
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  configField?: { key: "daysBack" | "daysAhead"; label: string; min: number; max: number; default: number };
};

const SECTION_DEFS: SectionDef[] = [
  {
    id: "pipeline_summary",
    label: "Pipeline Overview",
    description: "A summary table showing lead counts by status across the entire pipeline.",
    icon: BarChart2,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "recent_activity",
    label: "Recent Activity",
    description: "Leads created or updated within the configured look-back window.",
    icon: Activity,
    colorClass: "text-gray-600",
    bgClass: "bg-gray-50 dark:bg-gray-900/30",
    configField: { key: "daysBack", label: "Days to look back", min: 1, max: 30, default: 7 },
  },
  {
    id: "upcoming_followups",
    label: "Upcoming Follow-ups",
    description: "Follow-ups scheduled within the configured look-ahead window.",
    icon: Calendar,
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    configField: { key: "daysAhead", label: "Days to look ahead", min: 1, max: 30, default: 7 },
  },
  {
    id: "overdue_leads",
    label: "Overdue Follow-ups",
    description: "All leads with follow-up dates that have already passed — action required.",
    icon: AlertTriangle,
    colorClass: "text-red-600",
    bgClass: "bg-red-50 dark:bg-red-950/30",
  },
  {
    id: "won_leads",
    label: "Won / Closed Deals",
    description: "Leads marked as 'Close Win' during the report period.",
    icon: Trophy,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "top_performers",
    label: "Top Performers",
    description: "Sales reps ranked by number of active leads assigned to them.",
    icon: Users,
    colorClass: "text-purple-600",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
  },
];

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: "pipeline_summary", enabled: true },
  { id: "recent_activity", enabled: true, daysBack: 7 },
  { id: "upcoming_followups", enabled: true, daysAhead: 7 },
  { id: "overdue_leads", enabled: true },
  { id: "won_leads", enabled: false },
  { id: "top_performers", enabled: false },
];

async function apiFetch(path: string, method = "GET", body?: unknown) {
  const token = getToken();
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminReportBuilderPage() {
  const { userRole, userEmail } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewEmail, setPreviewEmail] = useState(userEmail ?? "");
  const [expandedId, setExpandedId] = useState<ReportSectionId | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/reminders/report-sections")
      .then((data: ReportSection[]) => {
        const merged = DEFAULT_SECTIONS.map((def) => {
          const saved = data.find((s) => s.id === def.id);
          return saved ?? def;
        });
        setSections(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleSection(id: ReportSectionId) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function setConfig(id: ReportSectionId, key: "daysBack" | "daysAhead", value: number) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/reminders", "PUT", { reportSections: sections });
      toast({ title: "Report settings saved", description: "These sections will be used for all future summary emails." });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!previewEmail) {
      toast({ title: "Enter an email address first", variant: "destructive" });
      return;
    }
    setPreviewing(true);
    try {
      const result = await apiFetch("/api/admin/reminders/preview-report", "POST", {
        toEmail: previewEmail,
        sections,
      });
      if (result.sent) {
        toast({ title: "Preview sent!", description: `Check ${previewEmail} for the sample report.` });
      } else {
        toast({ title: "Preview logged (no SMTP configured)", description: "Check the email log for details." });
      }
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  }

  const enabledCount = sections.filter((s) => s.enabled).length;

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground text-sm">Access restricted to admins.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Email Report Builder</h1>
              <p className="text-sm text-muted-foreground">
                Choose which sections appear in automated summary emails
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              Summary emails are sent automatically on Monday and Friday mornings to all staff.
              Toggle sections on or off, adjust time windows, then save and optionally send yourself a preview.
            </span>
          </div>
        </div>

        {/* Section list */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {SECTION_DEFS.map((def) => {
              const sec = sections.find((s) => s.id === def.id)!;
              const isExpanded = expandedId === def.id;
              const hasConfig = !!def.configField;
              const Icon = def.icon;

              return (
                <div
                  key={def.id}
                  className={cn(
                    "rounded-xl border transition-all",
                    sec.enabled
                      ? "border-accent/40 bg-card shadow-sm"
                      : "border-border bg-card opacity-70"
                  )}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Icon */}
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", def.bgClass)}>
                      <Icon className={cn("w-5 h-5", def.colorClass)} />
                    </div>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-semibold text-sm", !sec.enabled && "text-muted-foreground")}>
                          {def.label}
                        </span>
                        {sec.enabled && (
                          <span className="text-[10px] font-semibold bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                            INCLUDED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{def.description}</p>
                    </div>

                    {/* Config toggle + main toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasConfig && sec.enabled && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : def.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground"
                          title="Configure"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Toggle switch */}
                      <button
                        onClick={() => {
                          toggleSection(def.id);
                          if (!sec.enabled === false && expandedId === def.id) setExpandedId(null);
                        }}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          sec.enabled ? "bg-accent" : "bg-muted-foreground/30"
                        )}
                        aria-checked={sec.enabled}
                        role="switch"
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            sec.enabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expandable config */}
                  {isExpanded && hasConfig && sec.enabled && def.configField && (
                    <div className="px-4 pb-4 pt-0 border-t border-border/60">
                      <div className="pt-4 flex items-center gap-4">
                        <label className="text-sm font-medium text-foreground min-w-0 flex-1">
                          {def.configField.label}
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={def.configField.min}
                            max={def.configField.max}
                            value={(sec as any)[def.configField.key] ?? def.configField.default}
                            onChange={(e) => setConfig(def.id, def.configField!.key, Number(e.target.value))}
                            className="w-32 accent-accent"
                          />
                          <span className="text-sm font-bold text-accent w-16 text-right">
                            {(sec as any)[def.configField.key] ?? def.configField.default} days
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary + Actions */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Enabled summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {enabledCount === 0
                ? "No sections selected — report will be empty"
                : `${enabledCount} section${enabledCount !== 1 ? "s" : ""} will appear in reports`}
            </span>
            <span className={cn("font-semibold text-xs px-2.5 py-1 rounded-full", enabledCount > 0 ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive")}>
              {enabledCount} / {SECTION_DEFS.length} enabled
            </span>
          </div>

          {/* Preview email */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Send a preview to
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={previewEmail}
                onChange={(e) => setPreviewEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                onClick={handlePreview}
                disabled={previewing || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition disabled:opacity-50"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {previewing ? "Sending…" : "Send Preview"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Uses the sections currently configured above (unsaved changes are included).
            </p>
          </div>

          {/* Save */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Report Settings"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
