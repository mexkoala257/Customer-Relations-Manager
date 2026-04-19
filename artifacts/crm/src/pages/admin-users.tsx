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
import { useAuth } from "@/hooks/use-auth";
import { PlusCircle, Trash2, Loader2, X, KeyRound, Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Pencil } from "lucide-react";
import { useLocation } from "wouter";

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


const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "data-entry", label: "Data Entry" },
  { value: "admin", label: "Admin" },
];

function roleBadgeClass(role: string) {
  if (role === "admin") return "bg-accent/20 text-accent-foreground";
  if (role === "data-entry") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-muted text-muted-foreground";
}

function InlineRoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setSaving(false);
      },
      onError: () => {
        setSaving(false);
        toast({ title: "Failed to update role", variant: "destructive" });
      },
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    setSaving(true);
    updateMutation.mutate({ id: userId, data: { role: newRole as "admin" | "sales" | "data-entry" } });
  }

  const label = ROLE_OPTIONS.find((o) => o.value === currentRole)?.label ?? currentRole;

  if (isSelf) {
    return (
      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleBadgeClass(currentRole)}`} title="You cannot change your own role">
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={currentRole}
        onChange={handleChange}
        disabled={saving}
        className={`text-xs px-2.5 py-1 rounded-full font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer pr-6 appearance-none ${roleBadgeClass(currentRole)}`}
        style={{ backgroundImage: "none" }}
        data-testid={`role-select-${userId}`}
        title="Change role"
      >
        {ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

interface ResetPasswordModalProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
}

function ResetPasswordModal({ userId, userEmail, onClose }: ResetPasswordModalProps) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: `Password reset for ${userEmail}` });
        onClose();
      },
      onError: () => {
        setError("Failed to reset password. Please try again.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    updateMutation.mutate({ id: userId, data: { password: newPassword } });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Reset Password</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Setting a new password for <span className="font-medium text-foreground">{userEmail}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                placeholder="Min. 6 characters"
                className="w-full px-4 py-3 pr-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="reset-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="reset-confirm-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              data-testid="reset-password-confirm"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAuth();
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", staffId: "", role: "sales" });
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);

  const lockMutation = useUpdateUser({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setLockingId(null);
        const locked = (variables.data as { isLocked?: boolean }).isLocked;
        toast({
          title: locked ? "User locked" : "User unlocked",
          description: locked
            ? "The user can no longer log in."
            : "The user can log in again.",
          variant: locked ? "destructive" : "default",
        });
      },
      onError: () => {
        setLockingId(null);
        toast({ title: "Failed to update lock status", variant: "destructive" });
      },
    },
  });

  function handleLockToggle(id: string, email: string, currentlyLocked: boolean) {
    if (!currentlyLocked && !confirm(`Lock ${email}? They will immediately lose access to the app.`)) return;
    setLockingId(id);
    lockMutation.mutate({ id, data: { isLocked: !currentlyLocked } });
  }

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
        role: form.role as "admin" | "sales" | "data-entry",
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
                  <option value="data-entry">Data Entry</option>
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
                  <tr
                    key={user.id}
                    className={`hover:bg-muted/40 transition-colors ${user.isLocked ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}
                    data-testid={`user-row-${user.id}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${user.isLocked ? "text-amber-700 dark:text-amber-400" : ""}`}>
                          {user.email}
                        </span>
                        {user.isLocked && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            <LockKeyhole className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{user.staffId}</td>
                    <td className="px-4 py-3.5">
                      <InlineRoleSelect
                        userId={user.id}
                        currentRole={user.role}
                        isSelf={user.id === currentUserId}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <GoalInput userId={user.id} currentGoal={user.weeklyLeadGoal} />
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Edit user"
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {user.id !== currentUserId && (
                          <button
                            onClick={() => handleLockToggle(user.id, user.email, !!user.isLocked)}
                            disabled={lockingId === user.id}
                            className={`p-1.5 rounded-lg transition ${
                              user.isLocked
                                ? "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            title={user.isLocked ? "Unlock user" : "Lock user"}
                            data-testid={`lock-user-${user.id}`}
                          >
                            {lockingId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : user.isLocked ? (
                              <LockKeyholeOpen className="w-4 h-4" />
                            ) : (
                              <LockKeyhole className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setResetTarget({ id: user.id, email: user.email })}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Reset password"
                          data-testid={`reset-password-${user.id}`}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.email)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition"
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Click the pencil icon to open the full edit page for a user. Set a weekly lead goal inline by typing in the Weekly Goal column and pressing Enter.
        </p>
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <ResetPasswordModal
          userId={resetTarget.id}
          userEmail={resetTarget.email}
          onClose={() => setResetTarget(null)}
        />
      )}
    </AppLayout>
  );
}
