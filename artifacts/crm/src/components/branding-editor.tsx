import { useState, useEffect } from "react";
import { Paintbrush, X, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings, COLOR_THEMES } from "@/contexts/app-settings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function BrandingEditor() {
  const { userRole } = useAuth();
  const { settings, updateSettings } = useAppSettings();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(settings.companyName);
  const [color, setColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(settings.companyName);
    setColor(settings.accentColor);
  }, [settings]);

  if (userRole !== "admin") return null;

  async function save() {
    setSaving(true);
    try {
      await updateSettings({ companyName: name, accentColor: color });
      toast({ title: "Branding saved" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setName(settings.companyName);
    setColor(settings.accentColor);
    setOpen(false);
  }

  const activeTheme = COLOR_THEMES.find((t) => t.key === color) ?? COLOR_THEMES[0];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-accent-foreground shadow-lg hover:opacity-90 transition text-sm font-semibold print:hidden"
        title="Customize branding"
        data-testid="branding-editor-btn"
      >
        <Paintbrush className="w-4 h-4" />
        Customize
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 print:hidden"
          onClick={cancel}
        />
      )}

      {/* Drawer — only in DOM when open */}
      {open && (
        <div className="fixed top-0 right-0 h-full w-80 z-50 bg-background border-l border-border shadow-2xl flex flex-col print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="font-bold text-sm">Customize App</h2>
              <p className="text-xs text-muted-foreground">Changes apply instantly for everyone</p>
            </div>
            <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-muted transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Company Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your company name"
                maxLength={40}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="branding-company-name"
              />
              <p className="text-xs text-muted-foreground">Shown in the sidebar, login screen, and headers</p>
            </div>

            {/* Color Theme */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Color Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.key}
                    onClick={() => setColor(theme.key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition hover:scale-105",
                      color === theme.key
                        ? "border-foreground"
                        : "border-transparent hover:border-border"
                    )}
                    data-testid={`color-theme-${theme.key}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow"
                      style={{ backgroundColor: theme.preview }}
                    >
                      {color === theme.key && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-xs font-medium">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Preview
              </label>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-sidebar p-3 flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: activeTheme.preview }}
                  />
                  <div>
                    <div className="text-xs font-bold text-white leading-none">{name || "Company"}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Sales Portal</div>
                  </div>
                </div>
                <div className="bg-background p-3 space-y-1.5">
                  <div
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-block"
                    style={{ backgroundColor: activeTheme.preview, color: activeTheme.accentFg === "0 0% 100%" ? "#fff" : "#1e293b" }}
                  >
                    Quick Entry
                  </div>
                  <div className="text-xs text-muted-foreground px-2.5 py-1.5">Dashboard</div>
                  <div className="text-xs text-muted-foreground px-2.5 py-1.5">My Leads</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
            <button
              onClick={cancel}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              data-testid="branding-save"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
