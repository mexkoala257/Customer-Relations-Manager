import { useState } from "react";
import { Link } from "wouter";
import {
  useListLeads,
  useDeleteLead,
  useUpdateLead,
  useListUsers,
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
  Loader2,
  ChevronDown,
  CalendarDays,
  List,
  AlertCircle,
  UserCog,
} from "lucide-react";

import { LEAD_STATUSES, STATUS_BADGE } from "@/lib/lead-status";

const STATUS_OPTIONS = ["", ...LEAD_STATUSES];

type ViewMode = "all" | "this-week";

/* ── Inline status selector ────────────────────────────────────────────── */
function InlineStatusSelect({
  leadId,
  currentStatus,
  onUpdated,
}: {
  leadId: string;
  currentStatus: string;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        setSaving(false);
        onUpdated();
        toast({ title: "Status updated" });
      },
      onError: () => {
        setSaving(false);
        toast({ title: "Failed to update status", variant: "destructive" });
      },
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as typeof LEAD_STATUSES[number];
    if (newStatus === currentStatus) return;
    setSaving(true);
    updateMutation.mutate({ id: leadId, data: { status: newStatus } });
  }

  const badgeClass = STATUS_BADGE[currentStatus] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="relative inline-flex items-center">
      <span className={cn("absolute inset-0 rounded-full pointer-events-none", badgeClass)} />
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={saving}
        className={cn(
          "relative appearance-none text-xs font-semibold rounded-full pl-2.5 pr-6 py-1 bg-transparent border-0 outline-none cursor-pointer transition-opacity",
          badgeClass,
          saving && "opacity-50"
        )}
        data-testid={`status-select-${leadId}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {saving ? (
        <Loader2 className="absolute right-1.5 w-3 h-3 animate-spin pointer-events-none" />
      ) : (
        <ChevronDown className="absolute right-1.5 w-3 h-3 pointer-events-none opacity-60" />
      )}
    </div>
  );
}

/* ── Inline rep selector (admin only) ──────────────────────────────────── */
type User = { id: string; email: string; staffId?: string | null; role: string };

function InlineRepSelect({
  leadId,
  currentRepId,
  users,
  onUpdated,
}: {
  leadId: string;
  currentRepId: string;
  users: User[];
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        setSaving(false);
        onUpdated();
        toast({ title: "Rep reassigned" });
      },
      onError: () => {
        setSaving(false);
        toast({ title: "Failed to reassign rep", variant: "destructive" });
      },
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRepId = e.target.value;
    if (newRepId === currentRepId) return;
    setSaving(true);
    updateMutation.mutate({ id: leadId, data: { userId: newRepId } });
  }

  const salesReps = users.filter((u) => u.role === "sales");

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentRepId}
        onChange={handleChange}
        disabled={saving}
        className={cn(
          "appearance-none text-xs rounded-lg pl-2 pr-6 py-1 bg-muted/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer transition-opacity",
          saving && "opacity-50"
        )}
        data-testid={`rep-select-${leadId}`}
      >
        {salesReps.map((u) => (
          <option key={u.id} value={u.id}>
            {u.email.split("@")[0]}{u.staffId ? ` (${u.staffId})` : ""}
          </option>
        ))}
      </select>
      {saving ? (
        <Loader2 className="absolute right-1.5 w-3 h-3 animate-spin pointer-events-none text-muted-foreground" />
      ) : (
        <ChevronDown className="absolute right-1.5 w-3 h-3 pointer-events-none opacity-40" />
      )}
    </div>
  );
}

/* ── Date grouping helpers ──────────────────────────────────────────────── */
function getWeekDayLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function groupByFollowUpDay(
  leads: NonNullable<ReturnType<typeof useListLeads>["data"]>
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = [...leads].sort((a, b) => {
    if (!a.followUpDate) return 1;
    if (!b.followUpDate) return -1;
    return a.followUpDate.localeCompare(b.followUpDate);
  });

  const groups: { label: string; overdue: boolean; leads: typeof sorted }[] = [];
  const seen = new Map<string, number>();

  for (const lead of sorted) {
    const key = lead.followUpDate ?? "__no-date";
    const label = lead.followUpDate ? getWeekDayLabel(lead.followUpDate) : "No Date Set";
    const d = lead.followUpDate ? new Date(lead.followUpDate + "T00:00:00") : null;
    const overdue = d ? d < today : false;

    if (!seen.has(label)) {
      seen.set(label, groups.length);
      groups.push({ label, overdue, leads: [] });
    }
    groups[seen.get(label)!].leads.push(lead);
  }
  return groups;
}

/* ── Shared row actions ─────────────────────────────────────────────────── */
function RowActions({
  lead,
  mapsUrl,
  onFollowup,
  onDelete,
  canDelete = true,
}: {
  lead: { id: string };
  mapsUrl: string | null;
  onFollowup: () => void;
  onDelete: () => void;
  canDelete?: boolean;
}) {
  return (
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
        onClick={onFollowup}
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
      {canDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition"
          data-testid={`delete-lead-${lead.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isDataEntry = userRole === "data-entry";
  const canSeeAll = isAdmin || isDataEntry;

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: allUsers } = useListUsers({ query: { enabled: isAdmin } });

  const allParams = statusFilter ? { status: statusFilter } : {};
  const weekParams = { followUpThisWeek: "true" };

  const params = viewMode === "this-week" ? weekParams : allParams;
  const { data: leads, isLoading } = useListLeads(params as Parameters<typeof useListLeads>[0], {
    query: { queryKey: getListLeadsQueryKey(params as Parameters<typeof useListLeads>[0]) },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey(params as Parameters<typeof useListLeads>[0]) });
        toast({ title: "Lead deleted" });
      },
    },
  });

  const followupMutation = useSendFollowupEmail({
    mutation: {
      onSuccess: (data) => toast({ title: data.message ?? "Follow-up triggered" }),
      onError: () => toast({ title: "Failed to send follow-up", variant: "destructive" }),
    },
  });

  function handleDelete(id: string) {
    if (confirm("Delete this lead?")) deleteMutation.mutate({ id });
  }

  function buildMapsUrl(lead: NonNullable<typeof leads>[0]) {
    const addr = lead.customer?.streetAddress;
    const city = lead.customer?.city;
    if (!addr || !city) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addr} ${city}`)}`;
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  function refreshLeads() {
    queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey(params as Parameters<typeof useListLeads>[0]) });
  }

  const weekGroups = viewMode === "this-week" ? groupByFollowUpDay(leads ?? []) : [];

  /* ── Get current week range label ── */
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="leads-title">
              {canSeeAll ? "All Leads" : "My Leads"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {leads?.length ?? 0} {viewMode === "this-week" ? "follow-ups this week" : "total records"}
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

        {/* View mode toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setViewMode("all")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
              viewMode === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-card-border text-muted-foreground hover:bg-muted"
            )}
          >
            <List className="w-4 h-4" />
            All Leads
          </button>
          <button
            onClick={() => { setViewMode("this-week"); setStatusFilter(""); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
              viewMode === "this-week"
                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                : "bg-card border-card-border text-muted-foreground hover:bg-muted"
            )}
            data-testid="filter-this-week"
          >
            <CalendarDays className="w-4 h-4" />
            This Week
            {viewMode !== "this-week" && (
              <span className="ml-1 text-xs opacity-70">{weekLabel}</span>
            )}
          </button>
          {viewMode === "this-week" && (
            <span className="text-sm text-muted-foreground ml-1">{weekLabel}</span>
          )}
        </div>

        {/* Status filter pills — only shown in "All" mode */}
        {viewMode === "all" && (
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
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === "this-week" ? (
          /* ── THIS WEEK VIEW ── */
          weekGroups.length === 0 ? (
            <div className="text-center py-16 bg-card border border-card-border rounded-xl">
              <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <div className="text-muted-foreground text-sm font-medium">No follow-ups scheduled this week</div>
              <p className="text-xs text-muted-foreground/60 mt-1">Set a follow-up date on any lead to see it here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {weekGroups.map((group) => (
                <div key={group.label}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2">
                    {group.overdue ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <CalendarDays className="w-4 h-4 text-amber-500" />
                    )}
                    <h2 className={cn(
                      "text-sm font-bold",
                      group.overdue ? "text-destructive" : group.label === "Today" ? "text-amber-600" : "text-foreground"
                    )}>
                      {group.label}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {group.leads.length} lead{group.leads.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 h-px bg-border ml-1" />
                  </div>

                  {/* Leads for this group */}
                  <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {group.leads.map((lead) => {
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
                                  <span className="text-xs text-muted-foreground">
                                    {lead.customer?.contactName}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <InlineStatusSelect
                                    leadId={lead.id}
                                    currentStatus={lead.status}
                                    onUpdated={refreshLeads}
                                  />
                                </td>
                                {canSeeAll && (
                                  <td className="px-4 py-3.5">
                                    {isAdmin ? (
                                      <InlineRepSelect
                                        leadId={lead.id}
                                        currentRepId={lead.userId ?? ""}
                                        users={allUsers ?? []}
                                        onUpdated={refreshLeads}
                                      />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {lead.user?.email ?? "—"}
                                      </span>
                                    )}
                                  </td>
                                )}
                                <td className="px-4 py-3.5 text-muted-foreground max-w-[220px]">
                                  <span className="truncate block text-xs">{lead.notes || "—"}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <RowActions
                                    lead={lead}
                                    mapsUrl={mapsUrl}
                                    onFollowup={() => followupMutation.mutate({ id: lead.id })}
                                    onDelete={() => handleDelete(lead.id)}
                                    canDelete={!isDataEntry}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── ALL LEADS VIEW ── */
          (leads ?? []).length === 0 ? (
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-up</th>
                      {canSeeAll && (
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rep</th>
                      )}
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
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
                            <InlineStatusSelect
                              leadId={lead.id}
                              currentStatus={lead.status}
                              onUpdated={refreshLeads}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                            {formatDate(lead.followUpDate)}
                          </td>
                          {canSeeAll && (
                            <td className="px-4 py-3.5">
                              {isAdmin ? (
                                <InlineRepSelect
                                  leadId={lead.id}
                                  currentRepId={lead.userId ?? ""}
                                  users={allUsers ?? []}
                                  onUpdated={refreshLeads}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {lead.user?.email ?? "—"}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-muted-foreground max-w-[200px]">
                            <span className="truncate block">{lead.notes || "—"}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <RowActions
                              lead={lead}
                              mapsUrl={mapsUrl}
                              onFollowup={() => followupMutation.mutate({ id: lead.id })}
                              onDelete={() => handleDelete(lead.id)}
                              canDelete={!isDataEntry}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}
