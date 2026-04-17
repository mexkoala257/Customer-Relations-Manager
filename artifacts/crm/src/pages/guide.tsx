import { useAppSettings } from "@/contexts/app-settings";
import { useAuth } from "@/hooks/use-auth";
import { Printer, TrendingUp } from "lucide-react";
import { Link } from "wouter";

// ── Print styles injected via <style> tag ─────────────────────────────────────
const PRINT_STYLES = `
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; break-before: page; }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    .guide-root { padding: 0 !important; }
    .guide-section { padding: 1.5rem 2rem; }
    .mockup-wrap { max-width: 100% !important; box-shadow: none !important; }
    @page { margin: 0.75in; size: letter portrait; }
    a { color: inherit; text-decoration: none; }
  }
`;

// ── Shared Components ─────────────────────────────────────────────────────────

function SectionHeader({ num, title, sub }: { num: string; title: string; sub: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0 text-accent-foreground font-black text-lg">
        {num}
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 mt-4">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-foreground/80">
          <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: s }} />
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
      <strong>Tip:</strong> {children}
    </div>
  );
}

function AdminOnly() {
  return (
    <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold px-2 py-0.5 rounded-full ml-2">
      Admin only
    </span>
  );
}

// ── Screen Mockups ─────────────────────────────────────────────────────────────

function BrowserChrome({ path }: { path: string }) {
  return (
    <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
      <div className="flex gap-1.5 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 bg-white rounded text-xs text-gray-400 px-3 py-1 text-center border border-gray-200">
        {path}
      </div>
    </div>
  );
}

function MockupSidebar({ active }: { active: string }) {
  const items = ["Dashboard", "My Leads", "Customers", "Messages", "Reminders", "Settings"];
  return (
    <div className="w-28 bg-slate-900 flex flex-col h-full flex-shrink-0">
      <div className="px-3 py-3 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
            <TrendingUp className="w-2.5 h-2.5 text-accent-foreground" />
          </div>
          <span className="text-white text-xs font-bold truncate">SalesCRM</span>
        </div>
      </div>
      <div className="px-2 py-2 space-y-0.5">
        <div className="bg-accent/20 border border-accent/30 rounded text-accent text-[9px] font-semibold px-2 py-1.5 mb-1">⚡ Quick Entry</div>
        {items.map((item) => (
          <div
            key={item}
            className={`px-2 py-1.5 rounded text-[9px] ${item === active ? "bg-accent text-accent-foreground font-semibold" : "text-slate-400"}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupShell({ path, active, children }: { path: string; active: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden shadow-md avoid-break mockup-wrap">
      <BrowserChrome path={path} />
      <div className="flex" style={{ minHeight: 220 }}>
        <MockupSidebar active={active} />
        <div className="flex-1 bg-gray-50 overflow-hidden p-4">{children}</div>
      </div>
    </div>
  );
}

// ── Login Mockup ──────────────────────────────────────────────────────────────

function LoginMockup() {
  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden shadow-md avoid-break mockup-wrap">
      <BrowserChrome path="https://your-crm.com/login" />
      <div className="bg-slate-900 py-10 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-accent-foreground" />
        </div>
        <p className="text-white font-bold text-lg">Sales CRM</p>
        <div className="bg-white rounded-2xl p-5 w-72 space-y-3 shadow-xl">
          <div>
            <div className="text-xs text-gray-500 font-semibold mb-1">EMAIL</div>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">you@company.com</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold mb-1">PASSWORD</div>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">••••••••</div>
          </div>
          <div className="bg-accent rounded-lg py-2 text-center text-accent-foreground text-xs font-bold">Sign In</div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Mockup ──────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <MockupShell path="your-crm.com/" active="Dashboard">
      <div className="space-y-3">
        <div className="text-sm font-bold text-gray-800">Dashboard</div>
        <div className="grid grid-cols-4 gap-2">
          {[["Active Leads", "24"], ["Won This Month", "8"], ["Customers", "61"], ["Overdue", "3"]].map(([label, val], i) => (
            <div key={i} className={`rounded-lg p-2 ${i === 3 ? "bg-red-50 border border-red-200" : "bg-white border border-gray-200"}`}>
              <div className="text-[10px] text-gray-500">{label}</div>
              <div className="text-lg font-black text-gray-800">{val}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="text-[10px] font-semibold text-gray-500 mb-1">Pipeline by Status</div>
            <div className="space-y-1">
              {[["New", "bg-blue-400", "40%"], ["Quoted", "bg-amber-400", "30%"], ["Won", "bg-green-400", "30%"]].map(([l, c, w]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="text-[9px] text-gray-500 w-10">{l}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className={`${c} h-1.5 rounded-full`} style={{ width: w }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-2">
            <div className="text-[10px] font-semibold text-gray-500 mb-1">Recent Activity</div>
            <div className="space-y-1">
              {["ABC Corp — Follow-up", "XYZ Ltd — Quoted", "Acme Inc — Won"].map((t) => (
                <div key={t} className="text-[9px] text-gray-600 border-b border-gray-100 pb-1">{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupShell>
  );
}

// ── Quick Entry Mockup ────────────────────────────────────────────────────────

function QuickEntryMockup() {
  return (
    <MockupShell path="your-crm.com/new" active="Dashboard">
      <div className="space-y-2">
        <div className="text-sm font-bold text-gray-800">Quick Entry — New Lead</div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {["Company Name *", "Contact Name *", "Phone", "Email"].map((f) => (
              <div key={f}>
                <div className="text-[9px] text-gray-500 font-semibold mb-0.5">{f}</div>
                <div className="border border-gray-200 rounded h-5 bg-gray-50" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Status", "Follow-up Date", "Assigned To"].map((f) => (
              <div key={f}>
                <div className="text-[9px] text-gray-500 font-semibold mb-0.5">{f}</div>
                <div className="border border-gray-200 rounded h-5 bg-gray-50" />
              </div>
            ))}
          </div>
          <div>
            <div className="text-[9px] text-gray-500 font-semibold mb-0.5">Notes</div>
            <div className="border border-gray-200 rounded h-8 bg-gray-50" />
          </div>
          <div className="flex justify-end"><div className="bg-accent rounded px-3 py-1 text-accent-foreground text-[9px] font-bold">Save Lead</div></div>
        </div>
      </div>
    </MockupShell>
  );
}

// ── My Leads Mockup ───────────────────────────────────────────────────────────

function LeadsMockup() {
  const rows = [
    ["Acme Corp", "Jane Smith", "Quoted", "Apr 20"],
    ["Beta LLC", "Bob Jones", "New", "Apr 22"],
    ["Gamma Inc", "Maria L.", "Follow-up", "Apr 18"],
  ];
  return (
    <MockupShell path="your-crm.com/leads" active="My Leads">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800">My Leads</div>
          <div className="flex gap-1">
            <div className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-500">All Statuses ▾</div>
            <div className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-500">Search…</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            {["Company", "Contact", "Status", "Follow-up"].map((h) => (
              <div key={h} className="text-[9px] font-semibold text-gray-500">{h}</div>
            ))}
          </div>
          {rows.map(([co, ct, st, fu]) => (
            <div key={co} className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50">
              <div className="text-[9px] font-semibold text-gray-800">{co}</div>
              <div className="text-[9px] text-gray-600">{ct}</div>
              <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium w-fit ${st === "Quoted" ? "bg-amber-100 text-amber-700" : st === "New" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{st}</div>
              <div className="text-[9px] text-gray-600">{fu}</div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}

// ── Lead Detail Mockup ────────────────────────────────────────────────────────

function LeadDetailMockup() {
  return (
    <MockupShell path="your-crm.com/leads/123" active="My Leads">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-gray-800">Acme Corp — Jane Smith</div>
            <div className="text-[9px] text-gray-500">Active lead · Follow-up Apr 20</div>
          </div>
          <div className="flex gap-1">
            <div className="border border-gray-200 rounded px-2 py-0.5 text-[9px]">Send Email</div>
            <div className="bg-accent rounded px-2 py-0.5 text-[9px] text-accent-foreground">Edit</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["Status", "Quoted"], ["Follow-up", "Apr 20"], ["Assigned", "sarah"]].map(([k, v]) => (
            <div key={k} className="bg-white border border-gray-200 rounded p-1.5">
              <div className="text-[8px] text-gray-400">{k}</div>
              <div className="text-[9px] font-semibold text-gray-700">{v}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="text-[9px] font-semibold text-gray-600 mb-1">Notes</div>
          <div className="text-[9px] text-gray-500">Interested in 200Ah AGM batteries for fleet. Needs quote by end of week.</div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="text-[9px] font-semibold text-gray-600 mb-1">Activity Log</div>
          <div className="space-y-0.5">
            {["Apr 15 — Status changed to Quoted", "Apr 12 — Lead created"].map((e) => (
              <div key={e} className="text-[9px] text-gray-500">{e}</div>
            ))}
          </div>
        </div>
      </div>
    </MockupShell>
  );
}

// ── Customers Mockup ──────────────────────────────────────────────────────────

function CustomersMockup() {
  return (
    <MockupShell path="your-crm.com/customers" active="Customers">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800">Customers</div>
          <div className="flex gap-1">
            <div className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px]">Search…</div>
            <div className="bg-accent rounded px-2 py-0.5 text-[9px] text-accent-foreground">+ New</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["Acme Corp", "Jane Smith", "3 leads"], ["Beta LLC", "Bob Jones", "1 lead"], ["Gamma Inc", "Maria L.", "5 leads"]].map(([co, ct, lc]) => (
            <div key={co} className="bg-white border border-gray-200 rounded-lg p-2 hover:border-accent/40">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mb-1">
                <span className="text-[9px] font-bold text-accent">{co[0]}</span>
              </div>
              <div className="text-[9px] font-bold text-gray-800">{co}</div>
              <div className="text-[8px] text-gray-500">{ct}</div>
              <div className="text-[8px] text-accent mt-0.5">{lc}</div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}

// ── Messages Mockup ───────────────────────────────────────────────────────────

function MessagesMockup() {
  return (
    <MockupShell path="your-crm.com/team" active="Messages">
      <div className="space-y-2">
        <div className="text-sm font-bold text-gray-800">Messages</div>
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {["Messages", "Quick Updates", "Photos", "Documents"].map((tab, i) => (
            <div key={tab} className={`text-[9px] pb-1 font-medium ${i === 0 ? "border-b-2 border-accent text-accent" : "text-gray-400"}`}>{tab}</div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
          <div className="text-[9px] text-gray-400 mb-1">Share something with the team…</div>
          <div className="border border-gray-100 rounded h-8 bg-gray-50" />
          <div className="flex justify-end"><div className="bg-accent rounded px-2 py-0.5 text-[9px] text-accent-foreground">Post Message</div></div>
        </div>
        <div className="space-y-1.5">
          {[["sarah", "Apr 17 10:30 AM", "Follow-up calls went well today!"], ["jorge", "Apr 16 3:00 PM", "Reminder: team meeting Friday 9 AM"]].map(([author, time, msg]) => (
            <div key={author} className="bg-white border border-gray-200 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-[7px] font-bold text-accent">{(author as string)[0].toUpperCase()}</span>
                </div>
                <span className="text-[9px] font-semibold">{author}</span>
                <span className="text-[8px] text-gray-400 ml-auto">{time}</span>
              </div>
              <div className="text-[9px] text-gray-600">{msg}</div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}

// ── Reminders Mockup ──────────────────────────────────────────────────────────

function RemindersMockup() {
  return (
    <MockupShell path="your-crm.com/reminders" active="Reminders">
      <div className="space-y-2">
        <div className="text-sm font-bold text-gray-800">My Reminder Settings</div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div>
              <div className="text-[9px] font-semibold text-gray-800">Follow-up Reminders</div>
              <div className="text-[8px] text-gray-500">Receive email alerts before follow-up dates</div>
            </div>
            <div className="w-8 h-4 rounded-full bg-accent flex items-center">
              <div className="w-3 h-3 rounded-full bg-white ml-auto mr-0.5" />
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[8px] text-gray-500 mb-1.5">Remind me this many days before</div>
            <div className="flex gap-1">
              {["1 day", "2 days", "3 days", "5 days", "7 days"].map((d, i) => (
                <div key={d} className={`text-[8px] px-1.5 py-0.5 rounded border ${i < 2 ? "bg-accent text-accent-foreground border-accent" : "border-gray-200 text-gray-500"}`}>{d}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockupShell>
  );
}

// ── Settings Mockup ───────────────────────────────────────────────────────────

function SettingsMockup() {
  return (
    <MockupShell path="your-crm.com/settings" active="Settings">
      <div className="space-y-2">
        <div className="text-sm font-bold text-gray-800">Settings</div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-100">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <div className="text-[9px] font-semibold">sarah@crm.com</div>
              <div className="text-[8px] text-gray-500">Sales account</div>
            </div>
          </div>
          {[["Email", "sarah@crm.com"], ["Role", "sales"], ["Staff ID", "#1002"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 py-1">
              <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded" />
              </div>
              <div>
                <div className="text-[8px] text-gray-400">{k}</div>
                <div className="text-[9px] font-medium text-gray-700">{v}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-[9px] font-semibold text-gray-700 mb-2">Change Password</div>
          {["Current Password", "New Password", "Confirm New Password"].map((f) => (
            <div key={f} className="mb-1.5">
              <div className="text-[8px] text-gray-500 mb-0.5">{f}</div>
              <div className="border border-gray-200 rounded h-5 bg-gray-50 flex items-center px-2">
                <div className="text-gray-400 text-[8px]">••••••••</div>
              </div>
            </div>
          ))}
          <div className="bg-accent rounded px-2 py-1 text-[9px] text-accent-foreground w-fit mt-1">Update Password</div>
        </div>
      </div>
    </MockupShell>
  );
}

// ── Admin Users Mockup ────────────────────────────────────────────────────────

function AdminUsersMockup() {
  return (
    <MockupShell path="your-crm.com/admin/users" active="Dashboard">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800">Manage Users</div>
          <div className="bg-accent rounded px-2 py-0.5 text-[9px] text-accent-foreground">+ Add User</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            {["Email", "Role", "Staff ID", "Actions"].map((h) => (
              <div key={h} className="text-[9px] font-semibold text-gray-500">{h}</div>
            ))}
          </div>
          {[["admin@crm.com", "admin", "#1001"], ["sarah@crm.com", "sales", "#1002"], ["jorge@crm.com", "superadmin", "#1000"]].map(([e, r, id]) => (
            <div key={e} className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-gray-100">
              <div className="text-[9px] text-gray-800">{e}</div>
              <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium w-fit ${r === "admin" ? "bg-purple-100 text-purple-700" : r === "superadmin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{r}</div>
              <div className="text-[9px] text-gray-500">{id}</div>
              <div className="flex gap-1"><div className="text-[9px] border border-gray-200 rounded px-1">Edit</div></div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}

// ── Admin Reminders Mockup ────────────────────────────────────────────────────

function AdminRemindersMockup() {
  return (
    <MockupShell path="your-crm.com/admin/reminders" active="Dashboard">
      <div className="space-y-2">
        <div className="text-sm font-bold text-gray-800">Reminder Scheduling</div>
        {[
          { title: "Follow-up Reminders", desc: "Email reps before follow-up dates", on: true },
          { title: "Daily Past-Due Alerts", desc: "Alert reps about overdue leads", on: false },
          { title: "Weekly Summary Emails", desc: "Mon & Fri activity summaries", on: true },
        ].map(({ title, desc, on }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <div className="text-[9px] font-semibold text-gray-800">{title}</div>
                <div className="text-[8px] text-gray-500">{desc}</div>
              </div>
              <div className={`w-8 h-4 rounded-full flex items-center ${on ? "bg-accent" : "bg-gray-200"}`}>
                <div className={`w-3 h-3 rounded-full bg-white ${on ? "ml-auto mr-0.5" : "ml-0.5"}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </MockupShell>
  );
}

// ── Reports Mockup ────────────────────────────────────────────────────────────

function ReportsMockup() {
  return (
    <MockupShell path="your-crm.com/admin/reports" active="Dashboard">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800">Reports</div>
          <div className="border border-gray-200 rounded px-2 py-0.5 text-[9px]">Export CSV</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["Total Revenue", "$48,200"], ["Leads Won", "34"], ["Conversion", "42%"]].map(([l, v]) => (
            <div key={l} className="bg-white border border-gray-200 rounded-lg p-2">
              <div className="text-[8px] text-gray-500">{l}</div>
              <div className="text-sm font-black text-gray-800">{v}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-2">
          <div className="text-[9px] font-semibold text-gray-600 mb-1.5">Leads by Rep</div>
          {[["Sarah", 12, "bg-blue-400"], ["Jorge", 9, "bg-green-400"], ["Maria", 7, "bg-amber-400"]].map(([name, count, color]) => (
            <div key={name} className="flex items-center gap-2 mb-1">
              <div className="text-[9px] text-gray-600 w-10">{name}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${(count as number) * 8}%` }} />
              </div>
              <div className="text-[9px] text-gray-500">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}

// ── Table of Contents ─────────────────────────────────────────────────────────

function TableOfContents() {
  const entries = [
    ["1", "Getting Started — Logging In"],
    ["2", "The Dashboard"],
    ["3", "Quick Entry — Adding a New Lead"],
    ["4", "My Leads — Managing Your Pipeline"],
    ["5", "Lead Detail — Working a Single Lead"],
    ["6", "Customers"],
    ["7", "Team Messages"],
    ["8", "My Reminders"],
    ["9", "Settings & Password"],
    ["10", "Admin: Managing Users"],
    ["11", "Admin: Email Reminders & Scheduling"],
    ["12", "Admin: Reports"],
  ];
  return (
    <div className="bg-muted/40 border border-border rounded-2xl p-6 avoid-break">
      <h2 className="font-bold text-lg mb-4">Table of Contents</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {entries.map(([num, title]) => (
          <div key={num} className="flex items-center gap-2 text-sm">
            <span className="w-7 h-7 rounded-lg bg-accent/20 text-accent font-bold text-xs flex items-center justify-center flex-shrink-0">{num}</span>
            <span className="text-muted-foreground">{title}{parseInt(num) >= 10 ? <AdminOnly /> : null}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Guide ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const { settings } = useAppSettings();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const company = settings.companyName || "SalesCRM";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Top bar — not printed */}
      <div className="no-print sticky top-0 z-50 bg-background border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-sm">
            ← Back to App
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-semibold text-sm">User Guide</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
          data-testid="print-guide"
        >
          <Printer className="w-4 h-4" />
          Print Guide
        </button>
      </div>

      {/* Guide content */}
      <div className="guide-root max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Cover */}
        <div className="text-center py-8 avoid-break">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-4xl font-black text-foreground">{company}</h1>
          <p className="text-xl text-muted-foreground mt-2">User Guide & Walkthrough</p>
          <p className="text-sm text-muted-foreground mt-4">Generated {today}</p>
          <div className="mt-6 text-xs text-muted-foreground bg-muted/40 rounded-xl px-6 py-3 inline-block">
            This guide covers all features available to your role. Admin-only sections are marked.
          </div>
        </div>

        <TableOfContents />

        {/* ── Section 1: Login ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="1" title="Getting Started — Logging In" sub="How to access your Sales CRM account" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The CRM is accessed through your web browser. Your administrator will provide you with a URL, email address, and temporary password when your account is created.
              </p>
              <Steps items={[
                "Open your browser and navigate to the CRM URL provided by your administrator.",
                "Enter your <strong>email address</strong> in the Email field.",
                "Enter your <strong>password</strong> in the Password field.",
                "Click <strong>Sign In</strong> to access your account.",
                "On your first login, go to <strong>Settings</strong> to change your password.",
              ]} />
              <Tip>Your session stays active until you log out. Always click <strong>Log out</strong> at the bottom of the sidebar when using a shared computer.</Tip>
            </div>
            <LoginMockup />
          </div>
        </div>

        {/* ── Section 2: Dashboard ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="2" title="The Dashboard" sub="Your at-a-glance performance overview" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Dashboard is the first screen you see after logging in. It shows a real-time snapshot of your sales activity and helps you stay on top of your pipeline.
              </p>
              <Steps items={[
                "<strong>Active Leads</strong> — Total number of leads currently in your pipeline.",
                "<strong>Won This Month</strong> — Leads you've marked as Won in the current calendar month.",
                "<strong>Customers</strong> — Total number of customer accounts in the system.",
                "<strong>Overdue Follow-ups</strong> — Leads where the follow-up date has already passed (shown in red).",
                "The <strong>Pipeline chart</strong> breaks down your leads by status so you can see where deals are stalling.",
                "The <strong>Recent Activity</strong> panel shows the latest changes across all your leads.",
              ]} />
              <Tip>Admins see company-wide stats. Sales reps see only their own leads.</Tip>
            </div>
            <DashboardMockup />
          </div>
        </div>

        {/* ── Section 3: Quick Entry ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="3" title="Quick Entry — Adding a New Lead" sub="The fastest way to log a new prospect" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Quick Entry is the primary way to add new leads. Click <strong>⚡ Quick Entry</strong> in the sidebar (highlighted in green at the top) at any time to open the form.
              </p>
              <Steps items={[
                "Click <strong>⚡ Quick Entry</strong> in the left sidebar.",
                "Enter the <strong>Company Name</strong> (required). If the company already exists, a matching customer will be linked automatically.",
                "Enter the <strong>Contact Name</strong> and any available contact details (phone, email).",
                "Set the <strong>Status</strong> of the lead (e.g., New, Quoted, Follow-up).",
                "Set a <strong>Follow-up Date</strong> — the date you plan to contact the prospect next.",
                "Add any relevant <strong>Notes</strong> about the lead.",
                "Click <strong>Save Lead</strong> to add it to your pipeline.",
              ]} />
              <Tip>Admins can assign leads to specific reps using the <strong>Assigned To</strong> dropdown. Sales reps always own their own entries.</Tip>
            </div>
            <QuickEntryMockup />
          </div>
        </div>

        {/* ── Section 4: My Leads ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="4" title="My Leads — Managing Your Pipeline" sub="View, filter, and manage all your active leads" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The <strong>My Leads</strong> page shows all leads assigned to you. Admins can see every rep's leads. Use the filters and search to quickly find what you need.
              </p>
              <Steps items={[
                "Click <strong>My Leads</strong> in the sidebar to open the leads list.",
                "Use the <strong>Search</strong> box to find leads by company name or contact name.",
                "Use the <strong>Status filter</strong> dropdown to show only leads in a certain stage.",
                "Click any row to open the <strong>Lead Detail</strong> page for full information.",
                "Leads with past follow-up dates will appear highlighted — these need attention.",
                "Archived leads are hidden by default; use the filter toggle to show them.",
              ]} />
              <Tip>Leads are sorted by follow-up date by default, putting the most urgent items at the top.</Tip>
            </div>
            <LeadsMockup />
          </div>
        </div>

        {/* ── Section 5: Lead Detail ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="5" title="Lead Detail — Working a Single Lead" sub="Update status, log notes, and send follow-up emails" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Clicking a lead opens its detail page where you can see everything about the opportunity and take action on it.
              </p>
              <Steps items={[
                "Click any lead in the My Leads list to open its detail page.",
                "Click <strong>Edit</strong> to update the status, follow-up date, or notes.",
                "Use <strong>Send Email</strong> to send a follow-up email directly to the customer contact.",
                "The <strong>Activity Log</strong> at the bottom shows a full history of changes made to this lead.",
                "Click <strong>Archive Lead</strong> if the lead is no longer active (lost deals, etc.).",
                "Admins can use the <strong>Assigned To</strong> dropdown to reassign the lead to a different rep.",
              ]} />
              <Tip>All edits are saved immediately. The activity log automatically tracks every status change so you always have an audit trail.</Tip>
            </div>
            <LeadDetailMockup />
          </div>
        </div>

        {/* ── Section 6: Customers ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="6" title="Customers" sub="Company profiles and contact management" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Customers are companies you do business with. Each customer can have multiple leads over time. The Customers page is your company rolodex.
              </p>
              <Steps items={[
                "Click <strong>Customers</strong> in the sidebar to see all companies.",
                "Use the search bar to find a customer by company name or contact.",
                "Click a customer card to open their <strong>Customer Profile</strong>.",
                "The profile shows contact information, all leads associated with this customer, account notes, and the assigned sales rep.",
                "Click <strong>+ New Customer</strong> to manually add a new company.",
                "Use <strong>+ Create Lead</strong> on the profile page to start a new opportunity for this customer.",
                "Admins can add <strong>Account Notes</strong> that are visible to the whole team.",
              ]} />
              <Tip>When you create a lead with a company name, the CRM automatically creates or links to the matching customer record — you don't need to create them separately.</Tip>
            </div>
            <CustomersMockup />
          </div>
        </div>

        {/* ── Section 7: Messages ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="7" title="Team Messages" sub="Internal communication portal for the whole team" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The <strong>Messages</strong> page is a shared communication portal with four tabs: Messages, Quick Updates, Photos, and Documents. Everything posted here is visible to the whole team.
              </p>
              <Steps items={[
                "Click <strong>Messages</strong> in the sidebar to open the team portal.",
                "<strong>Messages tab</strong> — Type in the text box and click Post Message to share a note with the team.",
                "<strong>Quick Updates tab</strong> — Post short status notices. Choose a severity level (Notice, Urgent, or Critical) from the dropdown.",
                "<strong>Photos tab</strong> — Upload and share images with the team. Click a photo to view it full-size.",
                "<strong>Documents tab</strong> — Upload and share PDF files. Team members can download them.",
                "Hover over any message or file and click the trash icon to delete it (admins can delete anyone's posts).",
              ]} />
              <Tip>The JSON feed URLs shown at the bottom of the Messages and Quick Updates tabs can be used to subscribe external systems or dashboards to your team's updates automatically.</Tip>
            </div>
            <MessagesMockup />
          </div>
        </div>

        {/* ── Section 8: Reminders ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="8" title="My Reminders" sub="Personalize when you receive email notifications" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The <strong>Reminders</strong> page lets you set your personal email notification preferences. You can choose how many days in advance you want to be alerted about upcoming follow-up dates.
              </p>
              <Steps items={[
                "Click <strong>Reminders</strong> in the sidebar.",
                "Toggle <strong>Follow-up Reminders</strong> on or off. When on, you'll receive email alerts before your follow-up dates are due.",
                "Select one or more <strong>day options</strong> (1, 2, 3, 5, 7, or 14 days) to set how far in advance you're notified. Multiple options are allowed.",
                "Reminders are sent to your account email address each morning at 8:00 AM.",
                "Changes take effect immediately — no need to save separately.",
              ]} />
              <Tip>Choosing both "1 day" and "3 days" means you'll get an email 3 days before the follow-up AND another email the day before. This is useful for high-value leads.</Tip>
            </div>
            <RemindersMockup />
          </div>
        </div>

        {/* ── Section 9: Settings ── */}
        <div className="page-break guide-section space-y-5">
          <SectionHeader num="9" title="Settings & Password" sub="Manage your account and keep your password secure" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The <strong>Settings</strong> page shows your account information and lets you change your password. We recommend changing your password on your first login.
              </p>
              <Steps items={[
                "Click <strong>Settings</strong> in the sidebar.",
                "Your <strong>Email</strong>, <strong>Role</strong>, and <strong>Staff ID</strong> are displayed at the top — these are set by your administrator.",
                "To change your password, scroll to the <strong>Change Password</strong> section.",
                "Enter your <strong>Current Password</strong> to verify your identity.",
                "Enter your <strong>New Password</strong> (minimum 6 characters).",
                "Re-enter the new password in <strong>Confirm New Password</strong>, then click <strong>Update Password</strong>.",
              ]} />
              <Tip>If you forget your current password, contact your administrator — they can reset it from the Manage Users panel.</Tip>
            </div>
            <SettingsMockup />
          </div>
        </div>

        {/* ── Admin Sections ── */}
        {isAdmin && (
          <>
            <div className="page-break border-t-2 border-accent pt-8">
              <div className="bg-accent/10 border border-accent/30 rounded-2xl p-5 text-center avoid-break">
                <div className="text-lg font-black text-foreground">Administrator Sections</div>
                <p className="text-sm text-muted-foreground mt-1">The following sections cover features available only to Admin and Superadmin roles.</p>
              </div>
            </div>

            {/* ── Section 10: Manage Users ── */}
            <div className="guide-section space-y-5">
              <SectionHeader num="10" title="Admin: Managing Users" sub={<>User account administration<AdminOnly /></>} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Admins can create, edit, and deactivate user accounts from the <strong>Manage Users</strong> panel in the Admin section of the sidebar.
                  </p>
                  <Steps items={[
                    "Navigate to <strong>Admin → Manage Users</strong> in the sidebar.",
                    "Click <strong>+ Add User</strong> to create a new account. Fill in their email, set a temporary password, and choose their role.",
                    "<strong>Roles:</strong> <em>Sales</em> — standard rep access. <em>Data Entry</em> — can add leads but limited visibility. <em>Admin</em> — full access. <em>Superadmin</em> — system configuration access.",
                    "Click the <strong>Edit</strong> button next to a user to change their role, reset their password, or update their weekly lead goal.",
                    "Click <strong>Delete</strong> to permanently remove a user account.",
                    "Each user is assigned a unique <strong>Staff ID</strong> for reporting and identification.",
                  ]} />
                  <Tip>When creating a new user, give them a temporary password and instruct them to change it immediately from their Settings page.</Tip>
                </div>
                <AdminUsersMockup />
              </div>
            </div>

            {/* ── Section 11: Admin Reminders ── */}
            <div className="page-break guide-section space-y-5">
              <SectionHeader num="11" title="Admin: Email Reminders & Scheduling" sub={<>Configure automated email notifications for the team<AdminOnly /></>} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The <strong>Reminders</strong> panel in the Admin section controls three system-wide automated email programs. Each can be independently enabled or disabled.
                  </p>
                  <Steps items={[
                    "Navigate to <strong>Admin → Reminders</strong> in the sidebar.",
                    "<strong>Follow-up Reminders</strong> — When enabled, each rep receives an email listing their leads whose follow-up dates are approaching. Set the advance window (e.g., 1 day, 3 days) using the day buttons. Click <em>Send Now</em> to trigger immediately.",
                    "<strong>Daily Past-Due Alerts</strong> — When enabled, reps with overdue leads get a daily alert showing every lead past its follow-up date. The red <em>Send Now</em> button triggers an immediate run.",
                    "<strong>Weekly Summary Emails</strong> — Sends a comprehensive activity digest every Monday and Friday to all users. Includes recent lead activity and upcoming follow-ups. Click <em>Send Now</em> to send immediately.",
                    "All three run automatically at <strong>8:00 AM daily</strong> (summaries only on Mon & Fri).",
                    "SMTP must be configured for emails to actually deliver. See the note at the bottom of the page for configuration details.",
                  ]} />
                  <Tip>Use <em>Send Now</em> buttons to test your email configuration before enabling automatic scheduling. The output log will tell you how many emails were sent vs. just logged.</Tip>
                </div>
                <AdminRemindersMockup />
              </div>
            </div>

            {/* ── Section 12: Reports ── */}
            <div className="page-break guide-section space-y-5">
              <SectionHeader num="12" title="Admin: Reports" sub={<>Sales performance analytics and data export<AdminOnly /></>} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The <strong>Reports</strong> page gives admins a bird's-eye view of overall sales performance across the whole team.
                  </p>
                  <Steps items={[
                    "Navigate to <strong>Admin → Reports</strong> in the sidebar.",
                    "The top stat cards show overall totals: total revenue (closed deals), leads won, and conversion rate.",
                    "The <strong>Leads by Rep</strong> chart shows which reps have the most active leads in their pipelines.",
                    "The <strong>Status Breakdown</strong> shows how many leads are in each pipeline stage across all reps.",
                    "Use the <strong>date range filter</strong> to narrow the report to a specific time period.",
                    "Click <strong>Export CSV</strong> to download raw data for use in spreadsheets.",
                  ]} />
                  <Tip>Export to CSV regularly to keep backups of your lead data and for analysis in tools like Excel or Google Sheets.</Tip>
                </div>
                <ReportsMockup />
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="guide-section border-t border-border pt-8 text-center text-xs text-muted-foreground space-y-1">
          <div className="font-semibold">{company} · User Guide</div>
          <div>Generated {today} · For internal use only</div>
          <div className="no-print mt-4">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition mx-auto"
            >
              <Printer className="w-4 h-4" />
              Print or Save as PDF
            </button>
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground/50">
            Developed and Implemented by: DoodleWorks LLC
          </div>
        </div>

      </div>
    </>
  );
}
