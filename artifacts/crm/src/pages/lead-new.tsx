import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useCreateLead,
  useListCustomers,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";
import { getToken } from "@/lib/api";

import { LEAD_STATUSES } from "@/lib/lead-status";
const STATUS_OPTIONS = [...LEAD_STATUSES];

type FieldConfig = { required: boolean; minChars?: number };
type LeadRequirementsConfig = {
  contactDate: FieldConfig;
  followUpDate: FieldConfig;
  currentSupplier: FieldConfig;
  temperature: FieldConfig;
  productsDiscussed: FieldConfig;
  notes: FieldConfig;
};

const CONFIG_DEFAULTS: LeadRequirementsConfig = {
  contactDate:       { required: false },
  followUpDate:      { required: true },
  currentSupplier:   { required: false },
  temperature:       { required: false },
  productsDiscussed: { required: false },
  notes:             { required: false, minChars: 0 },
};

function req(cfg: FieldConfig | undefined) { return cfg?.required ?? false; }

export default function LeadNewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("New");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [contactDate, setContactDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [currentSupplier, setCurrentSupplier] = useState("");
  const [temperature, setTemperature] = useState<"" | "Hot" | "Medium" | "Cold">("");
  const [productsDiscussed, setProductsDiscussed] = useState("");

  const [fieldCfg, setFieldCfg] = useState<LeadRequirementsConfig>(CONFIG_DEFAULTS);
  const [notesTouched, setNotesTouched] = useState(false);

  const { data: customers } = useListCustomers();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/lead-requirements", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: LeadRequirementsConfig) => setFieldCfg({ ...CONFIG_DEFAULTS, ...d }))
      .catch(() => {});
  }, []);

  const createMutation = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast({ title: "Lead created successfully" });
        navigate("/leads");
      },
      onError: () => {
        toast({ title: "Failed to create lead", variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;

    createMutation.mutate({
      data: {
        customerId,
        status: status as typeof LEAD_STATUSES[number],
        notes,
        followUpDate: followUpDate || undefined,
        metadata: {
          ...(contactDate ? { contactDate } : {}),
          ...(currentSupplier ? { currentSupplier } : {}),
          ...(temperature ? { temperature } : {}),
          ...(productsDiscussed ? { productsDiscussed } : {}),
        },
      },
    });
  }

  const minChars = fieldCfg.notes.minChars ?? 0;
  const notesShort = minChars > 0 && notes.length < minChars;
  const showNotesWarning = notesTouched && notesShort;

  function label(text: string, isRequired: boolean) {
    return (
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {text} {isRequired && <span className="text-destructive">*</span>}
      </label>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold" data-testid="new-lead-title">New Lead</h1>
        </div>

        {/* Notes warning banner */}
        {showNotesWarning && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Notes are below the recommended minimum of <strong>{minChars} characters</strong>. More detail helps the team — but your lead has been saved.
            </span>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Customer — always required */}
            <div className="space-y-1.5">
              {label("Customer", true)}
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-customer-select"
              >
                <option value="">Select a customer...</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} — {c.contactName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status — always required */}
            <div className="space-y-1.5">
              {label("Status", true)}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-status-select"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Contact Date */}
            <div className="space-y-1.5">
              {label("Contact Date", req(fieldCfg.contactDate))}
              <input
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
                required={req(fieldCfg.contactDate)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-contact-date"
              />
            </div>

            {/* Follow-up Date */}
            <div className="space-y-1.5">
              {label("Follow-up Date", req(fieldCfg.followUpDate))}
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                required={req(fieldCfg.followUpDate)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-followup-date"
              />
            </div>

            {/* Current Supplier */}
            <div className="space-y-1.5">
              {label("Current Supplier", req(fieldCfg.currentSupplier))}
              <input
                type="text"
                value={currentSupplier}
                onChange={(e) => setCurrentSupplier(e.target.value)}
                required={req(fieldCfg.currentSupplier)}
                placeholder="Who are they currently buying from?"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-current-supplier"
              />
            </div>

            {/* Temperature */}
            <div className="space-y-1.5">
              {label("Temperature", req(fieldCfg.temperature))}
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as "" | "Hot" | "Medium" | "Cold")}
                required={req(fieldCfg.temperature)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-temperature"
              >
                <option value="">Select temperature...</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Medium">🌤 Medium</option>
                <option value="Cold">❄️ Cold</option>
              </select>
            </div>

            {/* Products & Pricing Discussed */}
            <div className="space-y-1.5">
              {label("Products & Pricing Discussed", req(fieldCfg.productsDiscussed))}
              <textarea
                value={productsDiscussed}
                onChange={(e) => setProductsDiscussed(e.target.value)}
                required={req(fieldCfg.productsDiscussed)}
                rows={3}
                placeholder="List products and pricing discussed..."
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                data-testid="lead-products-discussed"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              {label("Notes", req(fieldCfg.notes))}
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesTouched(true); }}
                required={req(fieldCfg.notes)}
                rows={4}
                placeholder="Add notes about this interaction..."
                className={`w-full px-4 py-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none ${
                  notesShort && showNotesWarning ? "border-amber-400 dark:border-amber-600" : "border-input"
                }`}
                data-testid="lead-notes"
              />
              {minChars > 0 && (
                <div className={`flex justify-between text-xs ${notesShort ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  <span>{notesShort ? `${minChars - notes.length} more characters recommended` : "Minimum met"}</span>
                  <span>{notes.length} / {minChars}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || !customerId}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              data-testid="submit-new-lead"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Create Lead
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
