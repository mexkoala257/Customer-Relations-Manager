import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFeatureFlags, FLAG_DEFINITIONS } from "@/contexts/feature-flags";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ToggleLeft, ToggleRight, Eye, EyeOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminFeatureFlagsPage() {
  const { flags, setFlag, isLoading } = useFeatureFlags();
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(key: string) {
    const current = flags[key] !== false;
    setSaving(key);
    try {
      await setFlag(key, !current);
      toast({
        title: `${current ? "Hidden" : "Shown"}: ${FLAG_DEFINITIONS.find(f => f.key === key)?.label}`,
      });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Feature Flags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hide or show features across the app. Superadmin accounts always see everything regardless of these settings.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {FLAG_DEFINITIONS.map((flag) => {
            const enabled = flags[flag.key] !== false;
            const isSaving = saving === flag.key;
            return (
              <div key={flag.key} className="flex items-center gap-4 px-5 py-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                  )}
                >
                  {enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{flag.label}</p>
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      enabled
                        ? "bg-accent/10 text-accent"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {enabled ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                </div>

                <button
                  onClick={() => toggle(flag.key)}
                  disabled={isSaving || isLoading}
                  className="flex-shrink-0 focus:outline-none disabled:opacity-50"
                  aria-label={enabled ? "Disable" : "Enable"}
                >
                  {isSaving ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : enabled ? (
                    <ToggleRight className="w-8 h-8 text-accent" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border">
          <Zap className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Changes take effect immediately for all users. Superadmin accounts bypass all flags and always have full access. Hidden features are completely removed from the navigation — users won't know they exist.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
