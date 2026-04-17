import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { Bell, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface UserReminderPrefs {
  userId: string;
  followUpReminderEnabled: boolean;
  followUpDaysBefore: number[];
  updatedAt: string;
}

const DAY_OPTIONS = [1, 2, 3, 5, 7, 14];

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
      data-testid="reminder-toggle"
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

export default function MyRemindersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<UserReminderPrefs>({
    queryKey: ["user-reminder-prefs"],
    queryFn: async () => {
      const res = await fetch("/api/user/reminder-prefs", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load preferences");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<UserReminderPrefs>) => {
      const res = await fetch("/api/user/reminder-prefs", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json() as Promise<UserReminderPrefs>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user-reminder-prefs"], data);
      toast({ title: "Reminder preferences saved" });
    },
    onError: () => toast({ title: "Failed to save preferences", variant: "destructive" }),
  });

  function toggleDay(day: number, current: number[]) {
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
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

  if (!prefs) return null;

  const isSaving = updateMutation.isPending;

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="my-reminders-title">My Reminder Settings</h1>
            <p className="text-xs text-muted-foreground">Customize when you receive email reminders for your leads</p>
          </div>
        </div>

        {/* Follow-up Reminder Preferences */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-accent" />
              <div>
                <div className="font-semibold text-sm">Follow-up Reminders</div>
                <div className="text-xs text-muted-foreground">Receive email alerts before your follow-up dates</div>
              </div>
            </div>
            <Toggle
              checked={prefs.followUpReminderEnabled}
              onChange={(v) => updateMutation.mutate({ followUpReminderEnabled: v })}
              disabled={isSaving}
            />
          </div>

          <div className={cn("p-5 space-y-5 transition-opacity", !prefs.followUpReminderEnabled && "opacity-40 pointer-events-none")}>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                Remind me this many days before the follow-up date
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const active = (prefs.followUpDaysBefore as number[]).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day, prefs.followUpDaysBefore as number[])}
                      disabled={isSaving}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-muted-foreground border-input hover:border-accent/50"
                      )}
                      data-testid={`day-btn-${day}`}
                    >
                      {day === 1 ? "1 day" : `${day} days`}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Select one or more options. You'll receive an email on each selected day before your follow-up is due.
              </p>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-muted/40 rounded-xl border border-border p-4 text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <div className="font-semibold text-foreground/70 uppercase tracking-wider text-xs mb-2">How reminders work</div>
          <div>• Reminders are sent to your account email address each morning at <span className="font-mono bg-background rounded px-1 py-0.5 border border-border">8:00 AM</span></div>
          <div>• Each reminder lists all leads whose follow-up date falls within your selected window</div>
          <div>• You can opt out at any time by toggling reminders off above</div>
          <div>• Your admin may also send manual reminders from the admin panel</div>
        </div>
      </div>
    </AppLayout>
  );
}
