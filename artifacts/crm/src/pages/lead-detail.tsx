import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetLead,
  useUpdateLead,
  useListUsers,
  getGetLeadQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeft, MapPin, Loader2, Save, UserCog } from "lucide-react";

import { LEAD_STATUSES } from "@/lib/lead-status";
const STATUS_OPTIONS = [...LEAD_STATUSES];

export default function LeadDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";

  const { data: lead, isLoading } = useGetLead(id, {
    query: { queryKey: getGetLeadQueryKey(id), enabled: !!id },
  });

  const { data: users } = useListUsers({
    query: { enabled: isAdmin },
  });

  const salesReps = (users ?? []).filter((u) => u.role === "sales");

  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [repId, setRepId] = useState("");

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNotes(lead.notes ?? "");
      setFollowUpDate(lead.followUpDate ?? "");
      setRepId(lead.userId ?? "");
    }
  }, [lead]);

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
        toast({ title: "Lead updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update lead", variant: "destructive" });
      },
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const data: Parameters<typeof updateMutation.mutate>[0]["data"] = {
      status: status as typeof LEAD_STATUSES[number],
      notes,
      followUpDate: followUpDate || null,
    };
    if (isAdmin && repId) data.userId = repId;
    updateMutation.mutate({ id, data });
  }

  function buildMapsUrl() {
    const addr = lead?.customer?.streetAddress;
    const city = lead?.customer?.city;
    if (!addr || !city) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addr} ${city}`)}`;
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

  if (!lead) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Lead not found.</div>
      </AppLayout>
    );
  }

  const mapsUrl = buildMapsUrl();

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="lead-detail-title">
              {lead.customer?.companyName}
            </h1>
            <p className="text-sm text-muted-foreground">{lead.customer?.contactName}</p>
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition"
              data-testid="navigate-lead"
            >
              <MapPin className="w-4 h-4" />
              Navigate
            </a>
          )}
        </div>

        {/* Customer Info */}
        <div className="bg-card border border-card-border rounded-xl p-5 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Customer Details
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Phone</span>
              <div className="font-medium mt-0.5">{lead.customer?.phone || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Location</span>
              <div className="font-medium mt-0.5">
                {[lead.customer?.city, lead.customer?.state].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Address</span>
              <div className="font-medium mt-0.5">
                {[lead.customer?.streetAddress, lead.customer?.city, lead.customer?.state, lead.customer?.zipCode]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Rep</span>
              <div className="font-medium mt-0.5">{lead.user?.email}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <div className="font-medium mt-0.5">
                {new Date(lead.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Lead Details
          </h2>
          <form onSubmit={handleSave} className="space-y-4">

            {/* Admin-only: Assign Rep */}
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <UserCog className="w-3.5 h-3.5" />
                  Assigned Rep
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold ml-1">
                    Admin
                  </span>
                </label>
                <select
                  value={repId}
                  onChange={(e) => setRepId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="lead-rep-select"
                >
                  {salesReps.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} {u.staffId ? `(${u.staffId})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
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
              <label className="text-xs font-semibold text-muted-foreground">Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="lead-followup-date"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Notes</label>
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
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              data-testid="save-lead-button"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
