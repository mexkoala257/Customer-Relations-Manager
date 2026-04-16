import { useRef } from "react";
import {
  useListLeads,
  useListUsers,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { STATUS_BADGE, LEAD_STATUSES } from "@/lib/lead-status";
import {
  Printer,
  AlertTriangle,
  Sparkles,
  Users,
  CalendarDays,
  FileText,
} from "lucide-react";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(followUpDate?: string | null) {
  if (!followUpDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(followUpDate + "T00:00:00");
  return d < today;
}

type Lead = {
  id: string;
  status: string;
  notes?: string | null;
  followUpDate?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  customer?: {
    companyName?: string | null;
    contactName?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
};

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

function LeadRow({ lead, showRep, repName }: { lead: Lead; showRep?: boolean; repName?: string }) {
  const overdue = isOverdue(lead.followUpDate);
  return (
    <tr className="border-b border-gray-100 last:border-0 text-sm">
      <td className="py-2 pr-4 font-medium text-gray-900">
        {lead.customer?.companyName ?? "—"}
      </td>
      <td className="py-2 pr-4 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
      {showRep && <td className="py-2 pr-4 text-gray-600">{repName ?? "Unassigned"}</td>}
      <td className="py-2 pr-4">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-semibold",
            STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700"
          )}
        >
          {lead.status}
        </span>
      </td>
      <td className={cn("py-2 pr-4 text-xs", overdue ? "text-red-600 font-semibold" : "text-gray-500")}>
        {lead.followUpDate ? (overdue ? "⚠ " : "") + formatDate(lead.followUpDate) : "—"}
      </td>
      <td className="py-2 text-xs text-gray-400 max-w-[200px] truncate">{lead.notes ?? "—"}</td>
    </tr>
  );
}

function SectionHeader({ icon: Icon, title, count, className }: {
  icon: React.ElementType;
  title: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 mb-4 print:mb-3", className)}>
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 print:bg-transparent print:border print:border-gray-300">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{count} lead{count !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-4 text-center text-sm text-gray-400 italic">
        No leads in this section
      </td>
    </tr>
  );
}

export default function AdminReportsPage() {
  const { userEmail } = useAuth();
  const { data: leadsRaw, isLoading: leadsLoading } = useListLeads({});
  const { data: usersRaw, isLoading: usersLoading } = useListUsers();
  const reportRef = useRef<HTMLDivElement>(null);

  const leads: Lead[] = (leadsRaw as any) ?? [];
  const users: User[] = ((usersRaw as any) ?? []).filter((u: User) => u.role !== "admin");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const overdue = leads.filter(
    (l) => l.followUpDate && new Date(l.followUpDate + "T00:00:00") < today
  );

  const newActivity = leads.filter(
    (l) => l.status === "New" || (l.createdAt && new Date(l.createdAt) >= sevenDaysAgo)
  );

  const repMap: Record<string, User> = {};
  users.forEach((u) => { repMap[u.id] = u; });

  const leadsByRep: Record<string, Lead[]> = {};
  const unassigned: Lead[] = [];
  leads.forEach((lead) => {
    if (lead.userId && repMap[lead.userId]) {
      if (!leadsByRep[lead.userId]) leadsByRep[lead.userId] = [];
      leadsByRep[lead.userId].push(lead);
    } else {
      unassigned.push(lead);
    }
  });
  if (unassigned.length > 0) {
    leadsByRep["__unassigned__"] = unassigned;
  }

  const repIds = [
    ...users.map((u) => u.id).filter((id) => leadsByRep[id]),
    ...(unassigned.length > 0 ? ["__unassigned__"] : []),
  ];

  const handlePrint = () => window.print();

  const isLoading = leadsLoading || usersLoading;

  return (
    <AppLayout title="Reports">
      <div className="max-w-5xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-accent" />
              Sales Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Print-ready view of all leads by rep, overdue activity, and new entries
            </p>
          </div>
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition disabled:opacity-50"
            data-testid="print-report-btn"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading report data…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold text-foreground">{leads.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Active Leads</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold text-red-500">{overdue.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Overdue Follow-ups</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-500">{newActivity.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">New / Recent Activity</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Printable Report ─────────────────────────────────────────────── */}
      <div
        ref={reportRef}
        id="printable-report"
        className="max-w-5xl mx-auto px-4 pb-12 print:px-6 print:py-0 print:max-w-full"
      >
        {/* Print-only header */}
        <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales CRM — Lead Report</h1>
              <p className="text-sm text-gray-500 mt-0.5">Generated by {userEmail}</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-700">
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {leads.length} active leads · {users.length} sales reps
              </div>
            </div>
          </div>
        </div>

        {isLoading ? null : (
          <>
            {/* ── By Sales Rep ─────────────────────────────────────────── */}
            <div className="mb-10 print:mb-8 print:break-before-avoid">
              <SectionHeader icon={Users} title="Leads by Sales Rep" count={leads.length} />
              {repIds.map((repId, repIdx) => {
                const rep = repId === "__unassigned__" ? null : repMap[repId];
                const repLeads = leadsByRep[repId] ?? [];
                return (
                  <div
                    key={repId}
                    className={cn(
                      "mb-6 print:mb-6",
                      repIdx > 0 && "print:break-inside-avoid"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-accent">
                          {rep ? rep.email.charAt(0).toUpperCase() : "?"}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800 print:text-gray-900">
                        {rep ? (rep.name || rep.email) : "Unassigned"}
                      </span>
                      <span className="text-xs text-gray-400">· {repLeads.length} lead{repLeads.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-gray-300">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 print:bg-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="py-2 px-3">Company</th>
                            <th className="py-2 px-3">Contact</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Follow-up</th>
                            <th className="py-2 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {repLeads.length === 0
                            ? <EmptyRow cols={5} />
                            : repLeads.map((lead) => (
                              <tr key={lead.id} className="text-sm">
                                <td className="py-2 px-3 font-medium text-gray-900">{lead.customer?.companyName ?? "—"}</td>
                                <td className="py-2 px-3 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
                                <td className="py-2 px-3">
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className={cn("py-2 px-3 text-xs", isOverdue(lead.followUpDate) ? "text-red-600 font-semibold" : "text-gray-500")}>
                                  {lead.followUpDate ? (isOverdue(lead.followUpDate) ? "⚠ " : "") + formatDate(lead.followUpDate) : "—"}
                                </td>
                                <td className="py-2 px-3 text-xs text-gray-400 max-w-[200px] truncate">{lead.notes ?? "—"}</td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Overdue Activity ─────────────────────────────────────── */}
            <div className="mb-10 print:mb-8 print:break-before-page">
              <SectionHeader
                icon={AlertTriangle}
                title="Overdue Activity"
                count={overdue.length}
                className="text-red-600 [&>div:first-child]:bg-red-50 [&>div:first-child]:print:border-red-200"
              />
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-gray-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-red-50 print:bg-red-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="py-2 px-3">Company</th>
                      <th className="py-2 px-3">Contact</th>
                      <th className="py-2 px-3">Rep</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Overdue Since</th>
                      <th className="py-2 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overdue.length === 0
                      ? <EmptyRow cols={6} />
                      : overdue.map((lead) => {
                        const rep = lead.userId ? repMap[lead.userId] : null;
                        const days = lead.followUpDate
                          ? Math.floor((today.getTime() - new Date(lead.followUpDate + "T00:00:00").getTime()) / 86400000)
                          : null;
                        return (
                          <tr key={lead.id} className="text-sm bg-red-50/30 print:bg-transparent">
                            <td className="py-2 px-3 font-medium text-gray-900">{lead.customer?.companyName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{rep ? (rep.name || rep.email.split("@")[0]) : "Unassigned"}</td>
                            <td className="py-2 px-3">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-red-600 font-semibold">
                              {formatDate(lead.followUpDate)}{days !== null ? ` (${days}d ago)` : ""}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-400 max-w-[200px] truncate">{lead.notes ?? "—"}</td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── New Activity ─────────────────────────────────────────── */}
            <div className="mb-10 print:mb-8 print:break-inside-avoid">
              <SectionHeader
                icon={Sparkles}
                title="New Activity (last 7 days + New status)"
                count={newActivity.length}
                className="[&>div:first-child]:bg-emerald-50 [&>div:first-child]:print:border-emerald-200"
              />
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-gray-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-emerald-50 print:bg-emerald-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="py-2 px-3">Company</th>
                      <th className="py-2 px-3">Contact</th>
                      <th className="py-2 px-3">Rep</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Created</th>
                      <th className="py-2 px-3">Follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {newActivity.length === 0
                      ? <EmptyRow cols={6} />
                      : newActivity.map((lead) => {
                        const rep = lead.userId ? repMap[lead.userId] : null;
                        return (
                          <tr key={lead.id} className="text-sm">
                            <td className="py-2 px-3 font-medium text-gray-900">{lead.customer?.companyName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{rep ? (rep.name || rep.email.split("@")[0]) : "Unassigned"}</td>
                            <td className="py-2 px-3">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500">{formatDateTime(lead.createdAt)}</td>
                            <td className={cn("py-2 px-3 text-xs", isOverdue(lead.followUpDate) ? "text-red-600 font-semibold" : "text-gray-500")}>
                              {lead.followUpDate ? (isOverdue(lead.followUpDate) ? "⚠ " : "") + formatDate(lead.followUpDate) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
              <span>SalesCRM · Confidential</span>
              <span>Printed {new Date().toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
