import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COLOR_THEMES } from "@/contexts/app-settings";
import {
  Shield, Building2, Palette, Mail, CheckCircle2,
  Eye, EyeOff, Plus, Trash2, ChevronRight, Loader2, Send
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

interface ExtraUser {
  email: string;
  password: string;
  role: "admin" | "sales";
}

interface FormState {
  superadmin: { email: string; password: string; confirm: string };
  branding: { companyName: string; accentColor: string };
  smtp: { host: string; port: string; user: string; pass: string; fromName: string; secure: boolean };
  extraUsers: ExtraUser[];
}

const STEPS = [
  { id: 1, label: "Admin Account", icon: Shield },
  { id: 2, label: "Branding", icon: Palette },
  { id: 3, label: "Email", icon: Mail },
  { id: 4, label: "Team", icon: Building2 },
  { id: 5, label: "Done", icon: CheckCircle2 },
];

export default function SetupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  const [form, setForm] = useState<FormState>({
    superadmin: { email: "", password: "", confirm: "" },
    branding: { companyName: "", accentColor: "amber" },
    smtp: { host: "", port: "587", user: "", pass: "", fromName: "", secure: false },
    extraUsers: [],
  });

  function setSuperadmin(patch: Partial<FormState["superadmin"]>) {
    setForm((f) => ({ ...f, superadmin: { ...f.superadmin, ...patch } }));
  }
  function setBranding(patch: Partial<FormState["branding"]>) {
    setForm((f) => ({ ...f, branding: { ...f.branding, ...patch } }));
  }
  function setSmtp(patch: Partial<FormState["smtp"]>) {
    setForm((f) => ({ ...f, smtp: { ...f.smtp, ...patch } }));
  }
  function addUser() {
    setForm((f) => ({ ...f, extraUsers: [...f.extraUsers, { email: "", password: "", role: "sales" }] }));
  }
  function removeUser(i: number) {
    setForm((f) => ({ ...f, extraUsers: f.extraUsers.filter((_, idx) => idx !== i) }));
  }
  function patchUser(i: number, patch: Partial<ExtraUser>) {
    setForm((f) => {
      const users = [...f.extraUsers];
      users[i] = { ...users[i], ...patch };
      return { ...f, extraUsers: users };
    });
  }

  function validateStep1(): string | null {
    if (!form.superadmin.email.includes("@")) return "Enter a valid email address.";
    if (form.superadmin.password.length < 8) return "Password must be at least 8 characters.";
    if (form.superadmin.password !== form.superadmin.confirm) return "Passwords do not match.";
    return null;
  }

  function validateStep2(): string | null {
    if (!form.branding.companyName.trim()) return "Company name is required.";
    return null;
  }

  function next() {
    if (step === 1) {
      const err = validateStep1();
      if (err) { toast({ title: err, variant: "destructive" }); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { toast({ title: err, variant: "destructive" }); return; }
    }
    setStep((s) => Math.min(5, s + 1) as Step);
  }

  async function testEmail() {
    if (!testEmailAddr) { toast({ title: "Enter a test email address.", variant: "destructive" }); return; }
    setTestingEmail(true);
    try {
      const r = await fetch("/api/setup/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.smtp, port: Number(form.smtp.port), toEmail: testEmailAddr }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      toast({ title: "Test email sent!", description: `Check ${testEmailAddr}` });
    } catch (err: any) {
      toast({ title: "Email test failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingEmail(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          superadmin: { email: form.superadmin.email, password: form.superadmin.password },
          branding: form.branding,
          smtp: form.smtp.host ? { ...form.smtp, port: Number(form.smtp.port) } : undefined,
          extraUsers: form.extraUsers.filter((u) => u.email && u.password),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Setup failed");
      setStep(5);
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const activeTheme = COLOR_THEMES.find((t) => t.key === form.branding.accentColor) ?? COLOR_THEMES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SalesCRM Setup</h1>
          <p className="text-slate-400 text-sm mt-1">Configure your CRM before your first login</p>
        </div>

        {/* Step indicators */}
        {step < 5 && (
          <div className="flex items-center justify-center gap-1 mb-8">
            {STEPS.slice(0, 4).map((s, idx) => {
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    active ? "bg-amber-500 text-slate-900" :
                    done ? "bg-slate-700 text-slate-300" :
                    "bg-slate-800 text-slate-500"
                  )}>
                    <s.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {idx < 3 && <ChevronRight className="w-4 h-4 text-slate-600 mx-1" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

          {/* Step 1 — Superadmin account */}
          {step === 1 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Superadmin Account</h2>
                  <p className="text-slate-400 text-sm">This is the master account — keep credentials safe</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={form.superadmin.email}
                    onChange={(e) => setSuperadmin({ email: e.target.value })}
                    placeholder="admin@yourcompany.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    data-testid="setup-sa-email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.superadmin.password}
                      onChange={(e) => setSuperadmin({ password: e.target.value })}
                      placeholder="Min. 8 characters"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                      data-testid="setup-sa-password"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={form.superadmin.confirm}
                      onChange={(e) => setSuperadmin({ confirm: e.target.value })}
                      placeholder="Repeat password"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                      data-testid="setup-sa-confirm"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {form.superadmin.password && form.superadmin.confirm && form.superadmin.password !== form.superadmin.confirm && (
                  <p className="text-red-400 text-xs">Passwords do not match</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Branding */}
          {step === 2 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Branding</h2>
                  <p className="text-slate-400 text-sm">Customize how the app looks for your team</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    value={form.branding.companyName}
                    onChange={(e) => setBranding({ companyName: e.target.value })}
                    placeholder="Your Company Name"
                    maxLength={40}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    data-testid="setup-company-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Accent Color</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.key}
                        onClick={() => setBranding({ accentColor: theme.key })}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition hover:scale-105",
                          form.branding.accentColor === theme.key
                            ? "border-white"
                            : "border-transparent hover:border-slate-600"
                        )}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow"
                          style={{ backgroundColor: theme.preview }}
                        >
                          {form.branding.accentColor === theme.key && (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <div className="bg-slate-900 p-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: activeTheme.preview }} />
                    <div>
                      <div className="text-xs font-bold text-white">{form.branding.companyName || "Your Company"}</div>
                      <div className="text-[10px] text-slate-500">Sales Portal</div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5 bg-slate-800">
                    <div className="text-xs px-2.5 py-1.5 rounded-lg inline-block font-semibold" style={{ backgroundColor: activeTheme.preview, color: "#fff" }}>Quick Entry</div>
                    <div className="text-xs text-slate-500 px-2.5 py-1.5">Dashboard</div>
                    <div className="text-xs text-slate-500 px-2.5 py-1.5">My Leads</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Email (SMTP) */}
          {step === 3 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Email Configuration</h2>
                  <p className="text-slate-400 text-sm">Used for follow-up reminders and summaries</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mb-6">Optional — you can skip this and configure it later via the Customize panel.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SMTP Host</label>
                    <input
                      value={form.smtp.host}
                      onChange={(e) => setSmtp({ host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                    <input
                      value={form.smtp.port}
                      onChange={(e) => setSmtp({ port: e.target.value })}
                      placeholder="587"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email (Sender)</label>
                  <input
                    type="email"
                    value={form.smtp.user}
                    onChange={(e) => setSmtp({ user: e.target.value })}
                    placeholder="notifications@yourcompany.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password / App Password</label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? "text" : "password"}
                      value={form.smtp.pass}
                      onChange={(e) => setSmtp({ pass: e.target.value })}
                      placeholder="SMTP password or app password"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    />
                    <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">From Name (optional)</label>
                  <input
                    value={form.smtp.fromName}
                    onChange={(e) => setSmtp({ fromName: e.target.value })}
                    placeholder={form.branding.companyName || "SalesCRM"}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="smtp-secure"
                    type="checkbox"
                    checked={form.smtp.secure}
                    onChange={(e) => setSmtp({ secure: e.target.checked })}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <label htmlFor="smtp-secure" className="text-sm text-slate-400">Use SSL/TLS (port 465)</label>
                </div>

                {form.smtp.host && form.smtp.user && form.smtp.pass && (
                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Send a test email to verify your settings:</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmailAddr}
                        onChange={(e) => setTestEmailAddr(e.target.value)}
                        placeholder="your@email.com"
                        className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={testEmail}
                        disabled={testingEmail}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition disabled:opacity-50"
                      >
                        {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Test
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4 — Extra users */}
          {step === 4 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Team Accounts</h2>
                  <p className="text-slate-400 text-sm">Add admin and sales rep accounts now, or skip</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mb-6">You can always create more accounts later from Admin → Manage Users.</p>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {form.extraUsers.map((u, i) => (
                  <div key={i} className="grid grid-cols-7 gap-2 items-center">
                    <input
                      type="email"
                      value={u.email}
                      onChange={(e) => patchUser(i, { email: e.target.value })}
                      placeholder="user@company.com"
                      className="col-span-3 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="password"
                      value={u.password}
                      onChange={(e) => patchUser(i, { password: e.target.value })}
                      placeholder="Password"
                      className="col-span-2 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={u.role}
                      onChange={(e) => patchUser(i, { role: e.target.value as "admin" | "sales" })}
                      className="col-span-1 px-2 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="sales">Sales</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => removeUser(i)} className="flex justify-center text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addUser}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 text-sm transition w-full justify-center"
              >
                <Plus className="w-4 h-4" />
                Add team member
              </button>
            </div>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-xl mb-2">Setup Complete!</h2>
              <p className="text-slate-400 text-sm mb-2">
                Your CRM is ready. Log in with your superadmin credentials to get started.
              </p>
              <p className="text-slate-500 text-xs mb-8">
                {form.superadmin.email}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Footer nav */}
          {step < 5 && (
            <div className="px-8 py-5 border-t border-slate-700 flex justify-between items-center">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
                disabled={step === 1}
                className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Back
              </button>

              <div className="flex gap-2">
                {step === 3 && (
                  <button
                    onClick={next}
                    className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition"
                  >
                    Skip
                  </button>
                )}
                {step < 4 && (
                  <button
                    onClick={next}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition"
                    data-testid="setup-next"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 4 && (
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition disabled:opacity-50"
                    data-testid="setup-submit"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Finish Setup
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          This page is only accessible before the first account is created.
        </p>
      </div>
    </div>
  );
}
