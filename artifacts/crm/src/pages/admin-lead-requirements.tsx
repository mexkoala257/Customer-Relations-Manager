import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { Loader2, Save, ClipboardList, ToggleLeft, ToggleRight } from "lucide-react";

type FieldConfig = { required: boolean; minChars?: number };
type Config = {
  contactDate: FieldConfig;
  followUpDate: FieldConfig;
  currentSupplier: FieldConfig;
  temperature: FieldConfig;
  productsDiscussed: FieldConfig;
  notes: FieldConfig;
};

const FIELD_LABELS: { key: keyof Config; label: string; description: string; hasMinChars?: boolean }[] = [
  { key: "contactDate",       label: "Contact Date",                description: "The date of initial or most recent contact" },
  { key: "followUpDate",      label: "Follow-up Date",              description: "Scheduled date for the next follow-up action" },
  { key: "currentSupplier",   label: "Current Supplier",            description: "Who the customer currently buys from" },
  { key: "temperature",       label: "Temperature",                 description: "Lead heat rating — Hot, Medium, or Cold" },
  { key: "productsDiscussed", label: "Products & Pricing Discussed", description: "Products and pricing covered in the conversation" },
  { key: "notes",             label: "Notes",                       description: "General notes about the interaction", hasMinChars: true },
];

const DEFAULTS: Config = {
  contactDate:       { required: false },
  followUpDate:      { required: true },
  currentSupplier:   { required: false },
  temperature:       { required: false },
  productsDiscussed: { required: false },
  notes:             { required: false, minChars: 0 },
};

function authHeader() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

export default function AdminLeadRequirementsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/lead-requirements", { headers: authHeader() })
      .then((r) => r.json())
      .then((d: Config) => setConfig({ ...DEFAULTS, ...d }))
      .catch(() => toast({ title: "Failed to load settings", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  function toggleRequired(key: keyof Config) {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], required: !prev[key].required },
    }));
  }

  function setMinChars(value: string) {
    const n = Math.max(0, parseInt(value) || 0);
    setConfig((prev) => ({ ...prev, notes: { ...prev.notes, minChars: n } }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/lead-requirements", {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(config),
      });
      if (r.ok) {
        toast({ title: "Requirements saved" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
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
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Lead Form Requirements</h1>
              <p className="text-sm text-muted-foreground">Control which fields are required when creating a new lead</p>
            </div>
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

        {/* Info banner */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <strong>How this works:</strong> Required fields must be filled before a lead can be saved. Notes with a minimum character count will show a warning if too short, but reps can still save the lead.
        </div>

        {/* Fields table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Required</span>
          </div>

          {FIELD_LABELS.map((field, i) => {
            const fieldCfg = config[field.key];
            const isRequired = fieldCfg.required;
            const isLast = i === FIELD_LABELS.length - 1;

            return (
              <div
                key={field.key}
                className={`px-4 py-4 space-y-3 ${!isLast ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {field.label}
                      {isRequired && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{field.description}</div>
                  </div>
                  <button
                    onClick={() => toggleRequired(field.key)}
                    className="flex-shrink-0 transition"
                    title={isRequired ? "Click to make optional" : "Click to make required"}
                  >
                    {isRequired
                      ? <ToggleRight className="w-8 h-8 text-accent" />
                      : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                  </button>
                </div>

                {/* Notes min chars */}
                {field.hasMinChars && (
                  <div className="flex items-center gap-3 pt-1 pl-0.5">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      Minimum characters for notes
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      value={config.notes.minChars ?? 0}
                      onChange={(e) => setMinChars(e.target.value)}
                      className="w-24 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {(config.notes.minChars ?? 0) > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Warning shown if under {config.notes.minChars} chars
                      </span>
                    )}
                    {(config.notes.minChars ?? 0) === 0 && (
                      <span className="text-xs text-muted-foreground">No minimum (set to 0 to disable)</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Always-required notice */}
        <p className="text-xs text-muted-foreground px-1">
          <strong>Customer</strong> and <strong>Status</strong> are always required and cannot be changed.
        </p>
      </div>
    </AppLayout>
  );
}
