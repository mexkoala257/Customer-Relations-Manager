import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFeatureFlags, FLAG_DEFINITIONS, ALL_ROLES } from "@/contexts/feature-flags";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Loader2, ChevronDown, ChevronUp, Save, UserPlus, X, Zap,
  ShieldCheck, ShieldOff, Users,
} from "lucide-react";

type FlagConfig = { roles: string[]; userOverrides: Record<string, boolean> };
type User = { id: number; email: string; fullName: string | null; role: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  "data-entry": "Data Entry",
};

function authHeader() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function defaultConfig(flag: typeof FLAG_DEFINITIONS[number]): FlagConfig {
  return { roles: [...flag.defaultRoles], userOverrides: {} };
}

export default function AdminFeatureFlagsPage() {
  const { reload } = useFeatureFlags();
  const { toast } = useToast();

  const [configs, setConfigs] = useState<Record<string, FlagConfig>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/feature-flags/config", { headers: authHeader() }).then((r) => r.json()),
      fetch("/api/users", { headers: authHeader() }).then((r) => r.json()),
    ])
      .then(([cfgData, usersData]: [Record<string, FlagConfig>, User[]]) => {
        const merged: Record<string, FlagConfig> = {};
        for (const flag of FLAG_DEFINITIONS) {
          merged[flag.key] = cfgData[flag.key] ?? defaultConfig(flag);
        }
        setConfigs(merged);
        setUsers(Array.isArray(usersData) ? usersData : []);
      })
      .catch(() => toast({ title: "Failed to load settings", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  function toggleRole(flagKey: string, role: string) {
    setConfigs((prev) => {
      const cfg = prev[flagKey] ?? { roles: [], userOverrides: {} };
      const hasRole = cfg.roles.includes(role);
      return {
        ...prev,
        [flagKey]: {
          ...cfg,
          roles: hasRole ? cfg.roles.filter((r) => r !== role) : [...cfg.roles, role],
        },
      };
    });
  }

  function addUserOverride(flagKey: string, userId: string, value: boolean) {
    if (!userId) return;
    setConfigs((prev) => ({
      ...prev,
      [flagKey]: {
        ...prev[flagKey],
        userOverrides: { ...prev[flagKey].userOverrides, [userId]: value },
      },
    }));
    setAddingUser((prev) => ({ ...prev, [flagKey]: "" }));
  }

  function removeUserOverride(flagKey: string, userId: string) {
    setConfigs((prev) => {
      const overrides = { ...prev[flagKey].userOverrides };
      delete overrides[userId];
      return { ...prev, [flagKey]: { ...prev[flagKey], userOverrides: overrides } };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/feature-flags/config", {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(configs),
      });
      if (r.ok) {
        reload();
        toast({ title: "Feature flags saved" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

  function roleSummary(cfg: FlagConfig): string {
    const roleCount = cfg.roles.length;
    const overrideCount = Object.keys(cfg.userOverrides).length;
    const parts: string[] = [];
    if (roleCount === ALL_ROLES.length) parts.push("All roles");
    else if (roleCount === 0) parts.push("No roles");
    else parts.push(cfg.roles.map((r) => ROLE_LABELS[r] ?? r).join(", "));
    if (overrideCount > 0) parts.push(`${overrideCount} user override${overrideCount > 1 ? "s" : ""}`);
    return parts.join(" · ");
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Feature Flags</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Control which features are visible per role or individual user.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {/* Flag cards */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {FLAG_DEFINITIONS.map((flag) => {
            const cfg = configs[flag.key] ?? defaultConfig(flag);
            const isExpanded = expanded === flag.key;
            const overrideEntries = Object.entries(cfg.userOverrides);
            const overriddenUserIds = new Set(Object.keys(cfg.userOverrides));
            const availableUsers = users.filter((u) => !overriddenUserIds.has(String(u.id)));
            const allEnabled = cfg.roles.length === ALL_ROLES.length && overrideEntries.every(([, v]) => v);
            const allDisabled = cfg.roles.length === 0 && overrideEntries.every(([, v]) => !v);

            return (
              <div key={flag.key}>
                {/* Collapsed row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : flag.key)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    allDisabled ? "bg-muted text-muted-foreground" : "bg-accent/10 text-accent"
                  )}>
                    {allDisabled ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{flag.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{roleSummary(cfg)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {overrideEntries.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        {overrideEntries.length} override{overrideEntries.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10 px-5 py-4 space-y-5">
                    <p className="text-xs text-muted-foreground">{flag.description}</p>

                    {/* Role access */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Role Access
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map((role) => {
                          const active = cfg.roles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => toggleRole(flag.key, role)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition",
                                active
                                  ? "bg-accent/10 border-accent/40 text-accent"
                                  : "bg-background border-input text-muted-foreground hover:border-accent/30"
                              )}
                            >
                              <span className={cn(
                                "w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center text-[10px] flex-shrink-0",
                                active ? "bg-accent border-accent text-accent-foreground" : "border-input"
                              )}>
                                {active && "✓"}
                              </span>
                              {ROLE_LABELS[role]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* User overrides */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        User Overrides
                        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">— overrides the role setting above for specific people</span>
                      </p>

                      {overrideEntries.length > 0 && (
                        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                          {overrideEntries.map(([userId, value]) => {
                            const user = users.find((u) => String(u.id) === userId);
                            return (
                              <div key={userId} className="flex items-center gap-3 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {user?.fullName || user?.email || `User #${userId}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{user?.email} · {ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
                                </div>
                                <span className={cn(
                                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                                  value
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                )}>
                                  {value ? "Always visible" : "Always hidden"}
                                </span>
                                <button
                                  onClick={() => removeUserOverride(flag.key, userId)}
                                  className="text-muted-foreground hover:text-destructive transition flex-shrink-0"
                                  title="Remove override"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add override */}
                      {availableUsers.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={addingUser[flag.key] ?? ""}
                            onChange={(e) => setAddingUser((prev) => ({ ...prev, [flag.key]: e.target.value }))}
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select a user to override...</option>
                            {availableUsers.map((u) => (
                              <option key={u.id} value={String(u.id)}>
                                {u.fullName || u.email} ({ROLE_LABELS[u.role] ?? u.role})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => addUserOverride(flag.key, addingUser[flag.key] ?? "", true)}
                            disabled={!addingUser[flag.key]}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:opacity-80 disabled:opacity-40 transition"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Always Show
                          </button>
                          <button
                            onClick={() => addUserOverride(flag.key, addingUser[flag.key] ?? "", false)}
                            disabled={!addingUser[flag.key]}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:opacity-80 disabled:opacity-40 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                            Always Hide
                          </button>
                        </div>
                      )}

                      {availableUsers.length === 0 && overrideEntries.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No users available to override.</p>
                      )}
                      {availableUsers.length === 0 && overrideEntries.length > 0 && (
                        <p className="text-xs text-muted-foreground italic">All users have an override set.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border">
          <Zap className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Role access</strong> sets the default visibility for everyone in that role.
            <strong> User overrides</strong> take priority — you can force a feature on or off for a specific person regardless of their role.
            Superadmin accounts always see everything and cannot be overridden.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
