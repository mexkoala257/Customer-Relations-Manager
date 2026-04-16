import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateCustomer,
  useCreateLead,
  useListCustomers,
  getListLeadsQueryKey,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

import { LEAD_STATUSES } from "@/lib/lead-status";
const STATUS_OPTIONS = LEAD_STATUSES;

type Mode = "new-customer" | "existing-customer";

export default function QuickEntryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("new-customer");
  const [showAddress, setShowAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customer, setCustomer] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const [existingCustomerId, setExistingCustomerId] = useState("");

  const [lead, setLead] = useState({
    status: "New" as typeof STATUS_OPTIONS[number],
    notes: "",
    followUpDate: "",
    currentSupplier: "",
    temperature: "" as "" | "Hot" | "Medium" | "Cold",
    productsDiscussed: "",
  });

  const { data: customers } = useListCustomers();

  const createCustomer = useCreateCustomer();
  const createLead = useCreateLead();

  function setCustomerField(field: keyof typeof customer) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCustomer((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let customerId: string;

      if (mode === "new-customer") {
        const result = await createCustomer.mutateAsync({
          data: {
            companyName: customer.companyName,
            contactName: customer.contactName,
            phone: customer.phone || undefined,
            streetAddress: customer.streetAddress || undefined,
            city: customer.city || undefined,
            state: customer.state || undefined,
            zipCode: customer.zipCode || undefined,
          },
        });
        customerId = result.id;
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      } else {
        customerId = existingCustomerId;
      }

      const newLead = await createLead.mutateAsync({
        data: {
          customerId,
          status: lead.status,
          notes: lead.notes || undefined,
          followUpDate: lead.followUpDate || undefined,
          metadata: {
            ...(lead.currentSupplier ? { currentSupplier: lead.currentSupplier } : {}),
            ...(lead.temperature ? { temperature: lead.temperature } : {}),
            ...(lead.productsDiscussed ? { productsDiscussed: lead.productsDiscussed } : {}),
          },
        },
      });

      queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      toast({ title: "Lead created successfully" });
      navigate(`/leads/${newLead.id}`);
    } catch {
      toast({ title: "Failed to save — please check required fields", variant: "destructive" });
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    !isSubmitting &&
    (mode === "new-customer"
      ? customer.companyName.trim() !== "" && customer.contactName.trim() !== ""
      : existingCustomerId !== "");

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Zap className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="quick-entry-title">Quick Entry</h1>
            <p className="text-xs text-muted-foreground">Create a customer and lead in one step</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Customer Section ── */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </span>
              <div className="flex rounded-lg overflow-hidden border border-input text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode("new-customer")}
                  className={cn(
                    "px-3 py-1.5 transition-colors",
                    mode === "new-customer"
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="mode-new-customer"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setMode("existing-customer")}
                  className={cn(
                    "px-3 py-1.5 transition-colors",
                    mode === "existing-customer"
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="mode-existing-customer"
                >
                  Existing
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {mode === "new-customer" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Company Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={customer.companyName}
                        onChange={setCustomerField("companyName")}
                        required
                        placeholder="Acme Corp"
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="customer-companyName"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Contact Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={customer.contactName}
                        onChange={setCustomerField("contactName")}
                        required
                        placeholder="Jane Smith"
                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="customer-contactName"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={customer.phone}
                        onChange={setCustomerField("phone")}
                        placeholder="555-000-1234"
                        className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="customer-phone"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddress((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="toggle-address"
                  >
                    {showAddress ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showAddress ? "Hide address" : "Add address (optional)"}
                  </button>

                  {showAddress && (
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 pt-1">
                      <div className="sm:col-span-6 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Street Address
                        </label>
                        <input
                          type="text"
                          value={customer.streetAddress}
                          onChange={setCustomerField("streetAddress")}
                          placeholder="123 Main St"
                          className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="customer-streetAddress"
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          City
                        </label>
                        <input
                          type="text"
                          value={customer.city}
                          onChange={setCustomerField("city")}
                          placeholder="Austin"
                          className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="customer-city"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          State
                        </label>
                        <input
                          type="text"
                          value={customer.state}
                          onChange={setCustomerField("state")}
                          placeholder="TX"
                          className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="customer-state"
                        />
                      </div>
                      <div className="sm:col-span-1 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          ZIP
                        </label>
                        <input
                          type="text"
                          value={customer.zipCode}
                          onChange={setCustomerField("zipCode")}
                          placeholder="78701"
                          className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="customer-zipCode"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Customer <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={existingCustomerId}
                    onChange={(e) => setExistingCustomerId(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="existing-customer-select"
                  >
                    <option value="">Choose a customer...</option>
                    {(customers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} — {c.contactName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── Lead Section ── */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border bg-muted/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lead Details
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLead((prev) => ({ ...prev, status: s }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          lead.status === s
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background text-muted-foreground border-input hover:border-accent/50"
                        )}
                        data-testid={`status-btn-${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={lead.followUpDate}
                    onChange={(e) => setLead((prev) => ({ ...prev, followUpDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="lead-followup-date"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Supplier
                </label>
                <input
                  type="text"
                  value={lead.currentSupplier}
                  onChange={(e) => setLead((prev) => ({ ...prev, currentSupplier: e.target.value }))}
                  placeholder="Who are they currently buying from?"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="lead-current-supplier"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Temperature
                </label>
                <select
                  value={lead.temperature}
                  onChange={(e) => setLead((prev) => ({ ...prev, temperature: e.target.value as "" | "Hot" | "Medium" | "Cold" }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="lead-temperature"
                >
                  <option value="">Select temperature...</option>
                  <option value="Hot">🔥 Hot</option>
                  <option value="Medium">🌤 Medium</option>
                  <option value="Cold">❄️ Cold</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Products &amp; Pricing Discussed
                </label>
                <textarea
                  value={lead.productsDiscussed}
                  onChange={(e) => setLead((prev) => ({ ...prev, productsDiscussed: e.target.value }))}
                  rows={3}
                  placeholder="List products and pricing discussed..."
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  data-testid="lead-products-discussed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  value={lead.notes}
                  onChange={(e) => setLead((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Initial contact details, context, next steps..."
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  data-testid="lead-notes"
                />
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="submit-quick-entry"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isSubmitting ? "Saving…" : "Create & Open Lead"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
