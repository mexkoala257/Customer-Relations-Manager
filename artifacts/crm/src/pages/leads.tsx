import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListLeads,
  useDeleteLead,
  useSendFollowupEmail,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle,
  MapPin,
  Trash2,
  Edit,
  Mail,
  Search,
  Filter,
  Loader2,
} from "lucide-react";

const STATUS_OPTIONS = ["", "New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

const STATUS_LABELS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Contacted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Qualified: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Proposal: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  Won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function LeadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const { userRole } = useAuth();

  const params = statusFilter ? { status: statusFilter } : {};
  const { data: leads, isLoading } = useListLeads(params, {
    query: { queryKey: getListLeadsQueryKey(params) },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey(params) });
        toast({ title: "Lead deleted" });
      },
    },
  });

  const followupMutation = useSendFollowupEmail({
    mutation: {
      onSuccess: (data) => {
        toast({ title: data.message ?? "Follow-up triggered" });
      },
      onError: () => {
        toast({ title: "Failed to send follow-up", variant: "destructive" });
      },
    },
  });

  function handleDelete(id: string) {
    if (confirm("Delete this lead?")) {
      deleteMutation.mutate({ id });
    }
  }

  function buildMapsUrl(lead: NonNullable<typeof leads>[0]) {
    const addr = lead.customer?.streetAddress;
    const city = lead.customer?.city;
    if (!addr || !city) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addr} ${city}`)}`;
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="leads-title">
              {userRole === "admin" ? "All Leads" : "My Leads"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {leads?.length ?? 0} total records
            </p>
          </div>
          <Link
            href="/leads/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
            data-testid="create-lead-button"
          >
            <PlusCircle className="w-4 h-4" />
            New Lead
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-card-border text-muted-foreground hover:bg-muted"
              )}
              data-testid={`filter-${s || "all"}`}
            >
              {s || "All Status"}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (leads ?? []).length === 0 ? (
          <div className="text-center py-16 bg-card border border-card-border rounded-xl">
            <div className="text-muted-foreground text-sm">No leads found.</div>
            <Link href="/leads/new" className="mt-3 inline-block text-sm text-primary font-medium hover:underline">
              Create your first lead
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="leads-table">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Company
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Follow-up
                    </th>
                    {userRole === "admin" && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Rep
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(leads ?? []).map((lead) => {
                    const mapsUrl = buildMapsUrl(lead);
                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/40 transition-colors"
                        data-testid={`lead-row-${lead.id}`}
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/customers/${lead.customerId}`}
                            className="font-medium text-foreground hover:text-primary transition truncate max-w-[160px] block"
                          >
                            {lead.customer?.companyName}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {lead.customer?.contactName}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-semibold",
                              STATUS_LABELS[lead.status] ?? "bg-gray-100 text-gray-700"
                            )}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                          {formatDate(lead.followUpDate)}
                        </td>
                        {userRole === "admin" && (
                          <td className="px-4 py-3.5 text-muted-foreground text-xs">
                            {lead.user?.email?.split("@")[0]}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-muted-foreground max-w-[200px]">
                          <span className="truncate block">
                            {lead.notes || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            {mapsUrl && (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition"
                                title="Navigate"
                                data-testid={`navigate-${lead.id}`}
                              >
                                <MapPin className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => followupMutation.mutate({ id: lead.id })}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition"
                              title="Send follow-up email"
                              data-testid={`followup-${lead.id}`}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <Link
                              href={`/leads/${lead.id}`}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
                              data-testid={`edit-lead-${lead.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition"
                              data-testid={`delete-lead-${lead.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
