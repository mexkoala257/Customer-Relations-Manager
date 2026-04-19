import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetUser, useUpdateUser } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, CheckCircle2 } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "data-entry", label: "Data Entry" },
  { value: "admin", label: "Admin" },
];

interface Props {
  id: string;
}

export default function AdminUserEditPage({ id }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading, isError } = useGetUser(id);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    staffId: "",
    role: "sales",
    weeklyLeadGoal: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        staffId: user.staffId != null ? String(user.staffId) : "",
        role: user.role ?? "sales",
        weeklyLeadGoal: user.weeklyLeadGoal != null ? String(user.weeklyLeadGoal) : "",
      });
    }
  }, [user]);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({
          title: (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              User updated
            </span>
          ),
          description: "Changes have been saved.",
          variant: "success",
          duration: 2000,
        });
        navigate("/admin/users");
      },
      onError: () => {
        toast({ title: "Failed to save changes", variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const goalRaw = form.weeklyLeadGoal.trim();
    const weeklyLeadGoal = goalRaw === "" ? null : parseInt(goalRaw, 10);

    updateMutation.mutate({
      id,
      data: {
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim(),
        staffId: parseInt(form.staffId, 10),
        role: form.role as "admin" | "sales" | "data-entry",
        weeklyLeadGoal,
      },
    });
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

  if (isError || !user) {
    return (
      <AppLayout>
        <div className="p-6 max-w-xl mx-auto">
          <p className="text-destructive">User not found.</p>
          <button onClick={() => navigate("/admin/users")} className="mt-4 text-sm text-primary hover:underline">
            ← Back to Users
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-xl mx-auto">
        <button
          onClick={() => navigate("/admin/users")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-fullname"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(555) 000-0000"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-phone"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Staff ID
              </label>
              <input
                type="number"
                value={form.staffId}
                onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-staffid"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-role"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Weekly Lead Goal
              </label>
              <input
                type="number"
                min="0"
                value={form.weeklyLeadGoal}
                onChange={(e) => setForm((p) => ({ ...p, weeklyLeadGoal: e.target.value }))}
                placeholder="—"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="edit-weeklyleadgoal"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              data-testid="save-user-edit"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
