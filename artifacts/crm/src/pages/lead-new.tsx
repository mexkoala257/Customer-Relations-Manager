import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useCreateLead,
  useListCustomers,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { LEAD_STATUSES } from "@/lib/lead-status";
const STATUS_OPTIONS = [...LEAD_STATUSES];

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

  const { data: customers } = useListCustomers();

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

  return (
    <AppLayout>
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold" data-testid="new-lead-title">New Lead</h1>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Customer *
              </label>
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </label>
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Contact Date
              </label>
              <input
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-contact-date"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Follow-up Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-followup-date"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Supplier
              </label>
              <input
                type="text"
                value={currentSupplier}
                onChange={(e) => setCurrentSupplier(e.target.value)}
                placeholder="Who are they currently buying from?"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-current-supplier"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Temperature
              </label>
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as "" | "Hot" | "Medium" | "Cold")}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                value={productsDiscussed}
                onChange={(e) => setProductsDiscussed(e.target.value)}
                rows={3}
                placeholder="List products and pricing discussed..."
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                data-testid="lead-products-discussed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes about this interaction..."
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                data-testid="lead-notes"
              />
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
