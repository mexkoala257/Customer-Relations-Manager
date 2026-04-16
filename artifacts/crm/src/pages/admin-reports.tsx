import { useRef } from "react";
import {
  useListLeads,
  useListUsers,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { STATUS_BADGE } from "@/lib/lead-status";
import {
  Printer,
  AlertTriangle,
  Sparkles,
  Users,
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
  return new Date(followUpDate + "T00:00:00") < today;
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

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-3 text-center text-sm text-gray-400 italic">
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
  if (unassigned.length > 0) leadsByRep["__unassigned__"] = unassigned;

  const repIds = [
    ...users.map((u) => u.id).filter((id) => leadsByRep[id]),
    ...(unassigned.length > 0 ? ["__unassigned__"] : []),
  ];

  const isLoading = leadsLoading || usersLoading;
  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <AppLayout>
      {/* ── Screen-only controls ─────────────────────────────────────────── */}
      <div className="print:hidden max-w-5xl mx-auto px-4 py-6">
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

        {/* Screen preview of tables */}
        {!isLoading && (
          <div className="text-xs text-muted-foreground border border-border/40 rounded-xl px-4 py-3 bg-muted/20">
            Click <strong>Print / Save as PDF</strong> to generate a compact, report-formatted PDF. The printed version uses 9pt text, dense tables, and removes all UI chrome.
          </div>
        )}
      </div>

      {/* ── Printable report ─────────────────────────────────────────────── */}
      <div
        ref={reportRef}
        id="printable-report"
        className="max-w-5xl mx-auto px-4 pb-12 print:px-0 print:py-0 print:max-w-full"
      >
        {isLoading ? null : (
          <>
            {/* Print header — hidden on screen */}
            <div className="hidden print:block print-report-header">
              <div>
                <h1>Sales CRM — Lead Report</h1>
                <div className="sub">Prepared by {userEmail}</div>
              </div>
              <div className="meta">
                <div>{printDate}</div>
                <div style={{ marginTop: "2pt" }}>
                  {leads.length} active leads &middot; {users.length} reps &middot; {overdue.length} overdue
                </div>
              </div>
            </div>

            {/* Print summary bar — hidden on screen */}
            <div className="hidden print:flex print-summary">
              <div className="print-summary-item">
                <span className="num">{leads.length}</span>
                <span className="label">Total Active Leads</span>
              </div>
              <div className="print-summary-item" style={{ marginLeft: "auto" }}>
                <span className="num" style={{ color: "#c00" }}>{overdue.length}</span>
                <span className="label">Overdue</span>
              </div>
              <div className="print-summary-item">
                <span className="num" style={{ color: "#166534" }}>{newActivity.length}</span>
                <span className="label">New / Recent</span>
              </div>
              <div className="print-summary-item">
                <span className="num">{users.length}</span>
                <span className="label">Sales Reps</span>
              </div>
            </div>

            {/* ── SECTION 1: By Sales Rep ───────────────────────────────── */}
            <div className="mb-10 print:mb-0">
              {/* Screen header */}
              <div className="print:hidden flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Leads by Sales Rep</h2>
                  <p className="text-xs text-gray-500">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Print header */}
              <div className="hidden print:block print-section-title">
                Leads by Sales Representative
              </div>

              {repIds.map((repId) => {
                const rep = repId === "__unassigned__" ? null : repMap[repId];
                const repLeads = leadsByRep[repId] ?? [];
                const repName = rep ? (rep.name || rep.email) : "Unassigned";
                return (
                  <div key={repId} className="mb-6 print:mb-0 print:break-inside-avoid">
                    {/* Screen rep header */}
                    <div className="print:hidden flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-accent">
                          {rep ? rep.email.charAt(0).toUpperCase() : "?"}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{repName}</span>
                      <span className="text-xs text-gray-400">· {repLeads.length} lead{repLeads.length !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Print rep header */}
                    <div className="hidden print:block print-rep-header">
                      {repName}
                      <span className="print-rep-count">{repLeads.length} lead{repLeads.length !== 1 ? "s" : ""}</span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-none print:overflow-visible">
                      <table className="w-full text-left">
                        <colgroup>
                          <col style={{ width: "22%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "37%" }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
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
                            : repLeads.map((lead) => {
                              const over = isOverdue(lead.followUpDate);
                              return (
                                <tr key={lead.id} className="text-sm">
                                  <td className="py-2 px-3 font-medium text-gray-900">{lead.customer?.companyName ?? "—"}</td>
                                  <td className="py-2 px-3 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn("print-badge text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                      {lead.status}
                                    </span>
                                  </td>
                                  <td className={cn("py-2 px-3 text-xs", over ? "overdue-cell text-red-600 font-semibold" : "text-gray-500")}>
                                    {lead.followUpDate ? (over ? "⚠ " : "") + formatDate(lead.followUpDate) : "—"}
                                  </td>
                                  <td className="notes-cell py-2 px-3 text-xs text-gray-500">{lead.notes || "—"}</td>
                                </tr>
                              );
                            })
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── SECTION 2: Overdue Activity ───────────────────────────── */}
            <div className="mb-10 print:break-before-page">
              {/* Screen header */}
              <div className="print:hidden flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Overdue Activity</h2>
                  <p className="text-xs text-gray-500">{overdue.length} lead{overdue.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Print header */}
              <div className="hidden print:block print-section-title" style={{ color: "#900" }}>
                Overdue Follow-ups — Action Required
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-none">
                <table className="w-full text-left">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "28%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-red-50 text-xs text-gray-500 uppercase tracking-wide">
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
                          <tr key={lead.id} className="text-sm">
                            <td className="py-2 px-3 font-medium text-gray-900">{lead.customer?.companyName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{lead.customer?.contactName ?? "—"}</td>
                            <td className="py-2 px-3 text-gray-600">{rep ? (rep.name || rep.email.split("@")[0]) : "Unassigned"}</td>
                            <td className="py-2 px-3">
                              <span className={cn("print-badge text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="overdue-cell py-2 px-3 text-xs text-red-600 font-semibold">
                              {formatDate(lead.followUpDate)}{days !== null ? ` (${days}d)` : ""}
                            </td>
                            <td className="notes-cell py-2 px-3 text-xs text-gray-400">{lead.notes || "—"}</td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SECTION 3: New Activity ───────────────────────────────── */}
            <div className="mb-10 print:mb-0 print:break-inside-avoid">
              {/* Screen header */}
              <div className="print:hidden flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">New Activity</h2>
                  <p className="text-xs text-gray-500">Last 7 days or status = New · {newActivity.length} lead{newActivity.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Print header */}
              <div className="hidden print:block print-section-title" style={{ color: "#145214" }}>
                New Activity — Last 7 Days &amp; New Status
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:rounded-none print:border-none">
                <table className="w-full text-left">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "28%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-emerald-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="py-2 px-3">Company</th>
                      <th className="py-2 px-3">Contact</th>
                      <th className="py-2 px-3">Rep</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Created</th>
                      <th className="py-2 px-3">Notes</th>
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
                              <span className={cn("print-badge text-xs px-2 py-0.5 rounded-full font-semibold", STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700")}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500">{formatDateTime(lead.createdAt)}</td>
                            <td className="notes-cell py-2 px-3 text-xs text-gray-400">{lead.notes || "—"}</td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:flex print-footer">
              <span>SalesCRM &middot; Confidential</span>
              <span>Generated {new Date().toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
