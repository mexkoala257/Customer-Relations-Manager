import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { Bell, Send, CheckCircle, Clock, Loader2, Calendar, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailPreview } from "@/components/email-preview";

const API = "/api/admin/reminders";

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface ReminderSettings {
  id: number;
  followUpReminderEnabled: boolean;
  followUpDaysBefore: number[];
  summaryEnabled: boolean;
  lastFollowUpRun: string | null;
  lastSummaryRun: string | null;
  updatedAt: string;
}

interface SendResult {
  emailsSent: number;
  logs: string[];
}

const DAY_OPTIONS = [1, 2, 3, 5, 7, 14];

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50",
        checked ? "bg-accent" : "bg-muted"
      )}
      data-testid="toggle-switch"
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function LogPanel({ logs, onClose }: { logs: string[]; onClose: () => void }) {
  return (
    <div className="mt-4 bg-muted/50 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Run Output</span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
      </div>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 text-xs font-mono text-foreground/80">
            <span className={cn("mt-0.5 flex-shrink-0", log.startsWith("✓") ? "text-green-500" : log.startsWith("○") ? "text-amber-500" : "text-muted-foreground")}>
              {log.startsWith("✓") ? "✓" : log.startsWith("○") ? "○" : "·"}
            </span>
            <span>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminRemindersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [followUpLogs, setFollowUpLogs] = useState<string[] | null>(null);
  const [summaryLogs, setSummaryLogs] = useState<string[] | null>(null);

  const { data: settings, isLoading } = useQuery<ReminderSettings>({
    queryKey: ["admin-reminders"],
    queryFn: async () => {
      const res = await fetch(API, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<ReminderSettings>) => {
      const res = await fetch(API, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json() as Promise<ReminderSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-reminders"], data);
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const sendFollowUpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/send-followup`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<SendResult>;
    },
    onSuccess: (data) => {
      setFollowUpLogs(data.logs);
      queryClient.invalidateQueries({ queryKey: ["admin-reminders"] });
      toast({ title: `Follow-up reminders sent (${data.emailsSent} emails)` });
    },
    onError: () => toast({ title: "Failed to send follow-up reminders", variant: "destructive" }),
  });

  const sendSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/send-summary`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<SendResult>;
    },
    onSuccess: (data) => {
      setSummaryLogs(data.logs);
      queryClient.invalidateQueries({ queryKey: ["admin-reminders"] });
      toast({ title: `Summary emails sent (${data.emailsSent} emails)` });
    },
    onError: () => toast({ title: "Failed to send summary emails", variant: "destructive" }),
  });

  function toggleDay(day: number, current: number[]) {
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
    if (next.length === 0) return;
    updateMutation.mutate({ followUpDaysBefore: next });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!settings) return null;

  const isSaving = updateMutation.isPending;

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="reminders-title">Reminder Scheduling</h1>
            <p className="text-xs text-muted-foreground">Automated email notifications for your team</p>
          </div>
        </div>

        {/* Follow-up Reminders */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-accent" />
              <div>
                <div className="font-semibold text-sm">Follow-up Reminders</div>
                <div className="text-xs text-muted-foreground">Email reps before their follow-up dates are due</div>
              </div>
            </div>
            <Toggle
              checked={settings.followUpReminderEnabled}
              onChange={(v) => updateMutation.mutate({ followUpReminderEnabled: v })}
              disabled={isSaving}
            />
          </div>

          <div className={cn("p-5 space-y-5 transition-opacity", !settings.followUpReminderEnabled && "opacity-40 pointer-events-none")}>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                Send reminder this many days before the follow-up date
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const active = settings.followUpDaysBefore.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day, settings.followUpDaysBefore)}
                      disabled={isSaving}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-muted-foreground border-input hover:border-accent/50"
                      )}
                      data-testid={`day-${day}`}
                    >
                      {day === 1 ? "1 day" : `${day} days`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Last run: {formatDate(settings.lastFollowUpRun)}
              </div>
              <button
                type="button"
                onClick={() => { setFollowUpLogs(null); sendFollowUpMutation.mutate(); }}
                disabled={sendFollowUpMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-60"
                data-testid="send-followup-now"
              >
                {sendFollowUpMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Now
              </button>
            </div>

            {followUpLogs && <LogPanel logs={followUpLogs} onClose={() => setFollowUpLogs(null)} />}
          </div>
        </div>

        {/* Weekly Summary Emails */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-accent" />
              <div>
                <div className="font-semibold text-sm">Weekly Summary Emails</div>
                <div className="text-xs text-muted-foreground">Monday & Friday — recent activity + upcoming follow-ups for all users</div>
              </div>
            </div>
            <Toggle
              checked={settings.summaryEnabled}
              onChange={(v) => updateMutation.mutate({ summaryEnabled: v })}
              disabled={isSaving}
            />
          </div>

          <div className={cn("p-5 space-y-4 transition-opacity", !settings.summaryEnabled && "opacity-40 pointer-events-none")}>
            <div className="grid grid-cols-2 gap-3">
              {[{ day: "Monday", desc: "Kick off the week with a recap" }, { day: "Friday", desc: "Close out the week with a preview" }].map(({ day, desc }) => (
                <div key={day} className="flex items-center gap-2.5 p-3 rounded-xl border border-input bg-muted/30">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{day}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
              <strong>Includes:</strong> leads created or updated in the past 7 days, and all follow-ups scheduled in the next 7 days. Sent to every user account.
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Last run: {formatDate(settings.lastSummaryRun)}
              </div>
              <button
                type="button"
                onClick={() => { setSummaryLogs(null); sendSummaryMutation.mutate(); }}
                disabled={sendSummaryMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-60"
                data-testid="send-summary-now"
              >
                {sendSummaryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Now
              </button>
            </div>

            {summaryLogs && <LogPanel logs={summaryLogs} onClose={() => setSummaryLogs(null)} />}
          </div>
        </div>

        {/* Schedule info */}
        <div className="bg-muted/40 rounded-xl border border-border p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Automatic Schedule</div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex gap-2"><span className="font-mono bg-background rounded px-1.5 py-0.5 border border-border">8:00 AM daily</span><span>Follow-up reminders checked and sent</span></div>
            <div className="flex gap-2"><span className="font-mono bg-background rounded px-1.5 py-0.5 border border-border">8:00 AM Mon & Fri</span><span>Weekly summary emails dispatched</span></div>
          </div>
        </div>

        {/* Email Preview */}
        <EmailPreview />

        {/* SMTP notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
          <strong>Email delivery:</strong> Configure <code className="bg-amber-100 dark:bg-amber-900/40 rounded px-1">SMTP_HOST</code>, <code className="bg-amber-100 dark:bg-amber-900/40 rounded px-1">SMTP_USER</code>, and <code className="bg-amber-100 dark:bg-amber-900/40 rounded px-1">SMTP_PASS</code> environment variables to enable real email delivery. Until then, all emails are logged to the server console.
        </div>
      </div>
    </AppLayout>
  );
}
