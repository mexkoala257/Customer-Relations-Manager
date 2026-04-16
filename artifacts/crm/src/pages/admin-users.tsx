import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Loader2, X } from "lucide-react";

function GoalInput({ userId, currentGoal }: { userId: string; currentGoal: number | null | undefined }) {
  const [value, setValue] = useState<string>(currentGoal != null ? String(currentGoal) : "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setSaving(false);
      },
      onError: () => {
        setSaving(false);
      },
    },
  });

  function save() {
    const num = value.trim() === "" ? null : parseInt(value.trim(), 10);
    if (value.trim() !== "" && (isNaN(num!) || num! < 0)) return;
    setSaving(true);
    updateMutation.mutate({ id: userId, data: { weeklyLeadGoal: num } });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
        placeholder="—"
        className="w-20 px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
        data-testid={`goal-input-${userId}`}
      />
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", staffId: "", role: "sales" });

  const { data: users, isLoading } = useListUsers();

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User created" });
        setShowForm(false);
        setForm({ email: "", password: "", staffId: "", role: "sales" });
      },
      onError: () => {
        toast({ title: "Failed to create user", variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User deleted" });
      },
    },
  });

  function handleDelete(id: string, email: string) {
    if (confirm(`Delete user ${email}?`)) {
      deleteMutation.mutate({ id });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      data: {
        email: form.email,
        password: form.password,
        staffId: parseInt(form.staffId),
        role: form.role as "admin" | "sales",
      },
    });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-users-title">
              Manage Users
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {users?.length ?? 0} registered users
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
            data-testid="create-user-button"
          >
            {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add User"}
          </button>
        </div>

        {/* Create User Form */}
        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold mb-4">New User</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="user@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="new-user-email"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="new-user-password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Staff ID *
                </label>
                <input
                  type="number"
                  value={form.staffId}
                  onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                  required
                  placeholder="1001"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="new-user-staffid"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="new-user-role"
                >
                  <option value="sales">Sales</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  data-testid="submit-new-user"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <table className="w-full text-sm" data-testid="users-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Staff ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Weekly Goal
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(users ?? []).map((user) => (
                  <tr key={user.id} className="hover:bg-muted/40 transition-colors" data-testid={`user-row-${user.id}`}>
                    <td className="px-4 py-3.5 font-medium">{user.email}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{user.staffId}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          user.role === "admin"
                            ? "bg-accent/20 text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <GoalInput userId={user.id} currentGoal={user.weeklyLeadGoal} />
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Set a weekly lead goal per rep by typing a number in the Weekly Goal column and pressing Enter.
        </p>
      </div>
    </AppLayout>
  );
}
