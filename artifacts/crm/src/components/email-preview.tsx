import { useState } from "react";
import { Mail, User, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES } from "@/lib/lead-status";

const TODAY = new Date();
const FMT_DATE = (d: Date) => d.toISOString().slice(0, 10);

function daysFromNow(n: number) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return FMT_DATE(d);
}

function daysAgo(n: number) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return FMT_DATE(d);
}

const DEFAULT_FOLLOWUP_DATA = {
  repName: "sarah",
  leads: [
    { companyName: "Acme Corp", contactName: "Jane Smith", followUpDate: daysFromNow(1), status: "Discovery" },
    { companyName: "TechVenture Inc", contactName: "Bob Johnson", followUpDate: daysFromNow(3), status: "Proposal" },
    { companyName: "Global Solutions", contactName: "Carol White", followUpDate: daysFromNow(3), status: "Negotiate" },
  ],
};

const DEFAULT_SUMMARY_DATA = {
  recipientName: "admin",
  periodLabel: "Monday Morning",
  recentLeads: [
    { companyName: "Apex Industries", contactName: "Tom Lee", status: "Close Win", repEmail: "sarah@crm.com", updatedAt: daysAgo(2) },
    { companyName: "Riverside Co", contactName: "Amy Chen", status: "Proposal", repEmail: "mike@crm.com", updatedAt: daysAgo(4) },
    { companyName: "Pinnacle LLC", contactName: "Dan Park", status: "Discovery", repEmail: "sarah@crm.com", updatedAt: daysAgo(6) },
  ],
  upcomingLeads: [
    { companyName: "Acme Corp", contactName: "Jane Smith", followUpDate: daysFromNow(1), status: "Discovery", repEmail: "sarah@crm.com" },
    { companyName: "TechVenture Inc", contactName: "Bob Johnson", followUpDate: daysFromNow(3), status: "Proposal", repEmail: "sarah@crm.com" },
    { companyName: "NextGen Brands", contactName: "Rita Moore", followUpDate: daysFromNow(5), status: "New", repEmail: "mike@crm.com" },
  ],
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 500 }}>
      {status}
    </span>
  );
}

function EmailChrome({ subject, from, to, date, children }: {
  subject: string; from: string; to: string; date: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
      {/* Client toolbar */}
      <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground font-medium truncate">{subject}</div>
      </div>
      {/* Email header */}
      <div className="px-5 py-3 border-b border-border bg-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-bold text-accent-foreground">S</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">SalesCRM Notifications</div>
              <div className="text-xs text-muted-foreground flex-shrink-0">{date}</div>
            </div>
            <div className="text-xs text-muted-foreground">From: <span className="font-mono">{from}</span></div>
            <div className="text-xs text-muted-foreground">To: <span className="font-mono">{to}</span></div>
          </div>
        </div>
        <div className="mt-2 font-medium text-sm text-foreground">{subject}</div>
      </div>
      {/* Body */}
      <div className="p-5 bg-gray-50 overflow-auto max-h-[480px]">{children}</div>
    </div>
  );
}

function FollowUpEmailBody({ repName, leads }: typeof DEFAULT_FOLLOWUP_DATA) {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "560px", margin: "0 auto", color: "#1f2937" }}>
      <div style={{ background: "#0f172a", padding: "20px 24px", borderRadius: "8px 8px 0 0" }}>
        <h2 style={{ color: "#f59e0b", margin: 0, fontSize: "18px" }}>⚡ SalesCRM</h2>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
        <p style={{ margin: "0 0 16px" }}>
          Hi <strong>{repName}</strong>, you have upcoming follow-ups that need attention:
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", fontWeight: 600, color: "#6b7280" }}>Company</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, color: "#6b7280" }}>Contact</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, color: "#6b7280" }}>Follow-up Date</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, color: "#6b7280" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.companyName}</td>
                <td style={{ padding: "10px 12px" }}>{l.contactName}</td>
                <td style={{ padding: "10px 12px" }}>{l.followUpDate}</td>
                <td style={{ padding: "10px 12px" }}><StatusBadge status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderTop: 0, padding: "12px 24px", borderRadius: "0 0 8px 8px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>This is an automated reminder from SalesCRM.</p>
      </div>
    </div>
  );
}

function SummaryEmailBody({ recipientName, periodLabel, recentLeads, upcomingLeads }: typeof DEFAULT_SUMMARY_DATA) {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", color: "#1f2937" }}>
      <div style={{ background: "#0f172a", padding: "20px 24px", borderRadius: "8px 8px 0 0" }}>
        <h2 style={{ color: "#f59e0b", margin: 0, fontSize: "18px" }}>⚡ SalesCRM</h2>
        <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: "13px" }}>{periodLabel} Activity Summary</p>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
        <p style={{ margin: "0 0 4px" }}>Hi <strong>{recipientName}</strong>,</p>
        <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: "13px" }}>Here's your sales activity overview.</p>

        <h3 style={{ fontSize: "14px", color: "#374151", margin: "0 0 8px" }}>Recent Activity</h3>
        {recentLeads.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                {["Company", "Contact", "Status", "Rep"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}>{l.companyName}</td>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}>{l.contactName}</td>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}><StatusBadge status={l.status} /></td>
                  <td style={{ padding: "9px 12px", fontSize: "13px", color: "#6b7280" }}>{l.repEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: "13px" }}>No recent activity this period.</p>
        )}

        <h3 style={{ fontSize: "14px", color: "#374151", margin: "20px 0 8px" }}>Upcoming Follow-ups (next 7 days)</h3>
        {upcomingLeads.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                {["Company", "Contact", "Date", "Status", "Rep"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcomingLeads.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}>{l.companyName}</td>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}>{l.contactName}</td>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}>{l.followUpDate}</td>
                  <td style={{ padding: "9px 12px", fontSize: "13px" }}><StatusBadge status={l.status} /></td>
                  <td style={{ padding: "9px 12px", fontSize: "13px", color: "#6b7280" }}>{l.repEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: "13px" }}>No follow-ups scheduled in the next 7 days.</p>
        )}
      </div>
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderTop: 0, padding: "12px 24px", borderRadius: "0 0 8px 8px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>Automated {periodLabel.toLowerCase()} summary from SalesCRM.</p>
      </div>
    </div>
  );
}

type Tab = "followup" | "summary";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function EmailPreview() {
  const [tab, setTab] = useState<Tab>("followup");
  const [open, setOpen] = useState(true);

  const [followUpData, setFollowUpData] = useState(DEFAULT_FOLLOWUP_DATA);
  const [summaryData, setSummaryData] = useState(DEFAULT_SUMMARY_DATA);

  const nowStr = TODAY.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden" data-testid="email-preview-section">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        data-testid="email-preview-toggle"
      >
        <div className="flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-accent" />
          <div className="text-left">
            <div className="font-semibold text-sm">Email Preview</div>
            <div className="text-xs text-muted-foreground">See exactly what your team will receive</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-card-border">
          {/* Tab bar */}
          <div className="flex border-b border-card-border">
            {([
              { id: "followup" as Tab, label: "Follow-up Reminder", icon: Mail },
              { id: "summary" as Tab, label: "Weekly Summary", icon: User },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab === id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`preview-tab-${id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Sample data editor */}
            <div className="p-4 bg-muted/20 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sample Data</div>

              {tab === "followup" ? (
                <>
                  <Field
                    label="Rep name"
                    value={followUpData.repName}
                    onChange={(v) => setFollowUpData((d) => ({ ...d, repName: v }))}
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leads</div>
                    {followUpData.leads.map((lead, i) => (
                      <div key={i} className="p-2.5 rounded-lg border border-border bg-background space-y-1.5 text-xs">
                        <div className="font-medium text-foreground/70">Lead {i + 1}</div>
                        <input
                          value={lead.companyName}
                          onChange={(e) => {
                            const leads = [...followUpData.leads];
                            leads[i] = { ...leads[i], companyName: e.target.value };
                            setFollowUpData((d) => ({ ...d, leads }));
                          }}
                          placeholder="Company"
                          className="w-full px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          value={lead.contactName}
                          onChange={(e) => {
                            const leads = [...followUpData.leads];
                            leads[i] = { ...leads[i], contactName: e.target.value };
                            setFollowUpData((d) => ({ ...d, leads }));
                          }}
                          placeholder="Contact"
                          className="w-full px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="date"
                            value={lead.followUpDate}
                            onChange={(e) => {
                              const leads = [...followUpData.leads];
                              leads[i] = { ...leads[i], followUpDate: e.target.value };
                              setFollowUpData((d) => ({ ...d, leads }));
                            }}
                            className="flex-1 px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <select
                            value={lead.status}
                            onChange={(e) => {
                              const leads = [...followUpData.leads];
                              leads[i] = { ...leads[i], status: e.target.value };
                              setFollowUpData((d) => ({ ...d, leads }));
                            }}
                            className="px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="Recipient name"
                    value={summaryData.recipientName}
                    onChange={(v) => setSummaryData((d) => ({ ...d, recipientName: v }))}
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</label>
                    <select
                      value={summaryData.periodLabel}
                      onChange={(e) => setSummaryData((d) => ({ ...d, periodLabel: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option>Monday Morning</option>
                      <option>Friday Morning</option>
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 leading-relaxed">
                    Shows {summaryData.recentLeads.length} recent leads and {summaryData.upcomingLeads.length} upcoming follow-ups from the sample dataset.
                  </div>
                </>
              )}
            </div>

            {/* Email preview */}
            <div className="p-4 bg-muted/10 overflow-auto">
              {tab === "followup" ? (
                <EmailChrome
                  subject={`SalesCRM — You have ${followUpData.leads.length} follow-up${followUpData.leads.length === 1 ? "" : "s"} coming up`}
                  from="notifications@salescrm.app"
                  to={`${followUpData.repName}@crm.com`}
                  date={nowStr}
                >
                  <FollowUpEmailBody {...followUpData} />
                </EmailChrome>
              ) : (
                <EmailChrome
                  subject={`SalesCRM — ${summaryData.periodLabel} Activity Summary`}
                  from="notifications@salescrm.app"
                  to={`${summaryData.recipientName}@crm.com`}
                  date={nowStr}
                >
                  <SummaryEmailBody {...summaryData} />
                </EmailChrome>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
