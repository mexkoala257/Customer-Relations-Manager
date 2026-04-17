import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetCustomer,
  useUpdateCustomer,
  useSendFollowupEmail,
  useCreateLead,
  getGetCustomerQueryKey,
  getListLeadsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ArrowLeft, MapPin, Mail, Loader2, Phone, Building2, Clock, Pencil, Save, X, StickyNote, Trash2, PlusCircle, UserRound } from "lucide-react";
import { LEAD_STATUSES } from "@/lib/lead-status";

interface AccountNote {
  id: string;
  customerId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string; staffId: number } | null;
}

import { STATUS_BADGE } from "@/lib/lead-status";

export default function CustomerDetailPage({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId, userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const notesQueryKey = ["account-notes", id];
  const { data: notes = [], isLoading: notesLoading } = useQuery<AccountNote[]>({
    queryKey: notesQueryKey,
    queryFn: () => customFetch<AccountNote[]>(`/api/customers/${id}/notes`),
    enabled: !!id,
  });

  const [noteText, setNoteText] = useState("");

  const addNoteMutation = useMutation({
    mutationFn: (body: string) =>
      customFetch<AccountNote>(`/api/customers/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
      setNoteText("");
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      customFetch(`/api/customers/${id}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesQueryKey }),
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({
    status: "New" as typeof LEAD_STATUSES[number],
    contactDate: new Date().toISOString().split("T")[0],
    followUpDate: "",
    currentSupplier: "",
    temperature: "" as "" | "Hot" | "Medium" | "Cold",
    productsDiscussed: "",
    notes: "",
  });

  const createLeadMutation = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        toast({ title: "Lead created successfully" });
        setShowNewLeadModal(false);
        setLeadForm({
          status: "New",
          contactDate: new Date().toISOString().split("T")[0],
          followUpDate: "",
          currentSupplier: "",
          temperature: "",
          productsDiscussed: "",
          notes: "",
        });
      },
      onError: () => toast({ title: "Failed to create lead", variant: "destructive" }),
    },
  });

  function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    createLeadMutation.mutate({
      data: {
        customerId: id,
        status: leadForm.status,
        notes: leadForm.notes,
        followUpDate: leadForm.followUpDate || undefined,
        metadata: {
          ...(leadForm.contactDate ? { contactDate: leadForm.contactDate } : {}),
          ...(leadForm.currentSupplier ? { currentSupplier: leadForm.currentSupplier } : {}),
          ...(leadForm.temperature ? { temperature: leadForm.temperature } : {}),
          ...(leadForm.productsDiscussed ? { productsDiscussed: leadForm.productsDiscussed } : {}),
        },
      },
    });
  }

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) return;
    addNoteMutation.mutate(trimmed);
  }

  function formatNoteDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { queryKey: getGetCustomerQueryKey(id), enabled: !!id },
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

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    contactRole: "",
  });

  useEffect(() => {
    if (customer) {
      setEditForm({
        companyName: customer.companyName,
        contactName: customer.contactName,
        phone: customer.phone ?? "",
        streetAddress: customer.streetAddress ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        zipCode: customer.zipCode ?? "",
        contactRole: (customer as any).contactRole ?? "",
      });
    }
  }, [customer]);

  const updateMutation = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        toast({ title: "Customer updated successfully" });
        setIsEditing(false);
      },
      onError: () => {
        toast({ title: "Failed to update customer", variant: "destructive" });
      },
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      id,
      data: {
        companyName: editForm.companyName,
        contactName: editForm.contactName,
        phone: editForm.phone || undefined,
        streetAddress: editForm.streetAddress || undefined,
        city: editForm.city || undefined,
        state: editForm.state || undefined,
        zipCode: editForm.zipCode || undefined,
        contactRole: editForm.contactRole || undefined,
      },
    });
  }

  function handleCancel() {
    if (customer) {
      setEditForm({
        companyName: customer.companyName,
        contactName: customer.contactName,
        phone: customer.phone ?? "",
        streetAddress: customer.streetAddress ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        zipCode: customer.zipCode ?? "",
        contactRole: (customer as any).contactRole ?? "",
      });
    }
    setIsEditing(false);
  }

  function buildMapsUrl() {
    if (!customer?.streetAddress || !customer?.city) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${customer.streetAddress} ${customer.city}`
    )}`;
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

  if (!customer) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Customer not found.</div>
      </AppLayout>
    );
  }

  const mapsUrl = buildMapsUrl();
  const leads = (customer as any).leads ?? [];

  const activeLeads = leads.filter((l: any) => l.isActive);
  const assignedRep = activeLeads[0]?.user ?? null;

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/customers" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate" data-testid="customer-profile-title">
              {customer.companyName}
            </h1>
            <p className="text-sm text-muted-foreground">{customer.contactName}</p>
          </div>
          {mapsUrl && !isEditing && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition flex-shrink-0"
              data-testid="navigate-customer"
            >
              <MapPin className="w-4 h-4" />
              Navigate
            </a>
          )}
          {!isEditing && (
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex-shrink-0"
              data-testid="new-lead-from-customer"
            >
              <PlusCircle className="w-4 h-4" />
              New Lead
            </button>
          )}
        </div>

        {/* Customer Info Card */}
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition"
                data-testid="edit-customer-button"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition"
                data-testid="cancel-edit-customer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Company Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.companyName}
                    onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-companyName"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Contact Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.contactName}
                    onChange={(e) => setEditForm((p) => ({ ...p, contactName: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-contactName"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="555-000-1234"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Role</label>
                  <select
                    value={editForm.contactRole}
                    onChange={(e) => setEditForm((p) => ({ ...p, contactRole: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-contactRole"
                  >
                    <option value="">Select role...</option>
                    <option value="Owner">Owner</option>
                    <option value="Decision Maker">Decision Maker</option>
                    <option value="Non Decision Maker">Non Decision Maker</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Street Address</label>
                  <input
                    type="text"
                    value={editForm.streetAddress}
                    onChange={(e) => setEditForm((p) => ({ ...p, streetAddress: e.target.value }))}
                    placeholder="123 Main St"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-streetAddress"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Austin"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-city"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="TX"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-state"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ZIP Code</label>
                  <input
                    type="text"
                    value={editForm.zipCode}
                    onChange={(e) => setEditForm((p) => ({ ...p, zipCode: e.target.value }))}
                    placeholder="78701"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="edit-zipCode"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                data-testid="save-customer-button"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </form>
          ) : (
            <>
              {(customer as any).contactRole && (
                <div className="mb-3">
                  <span className="inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-accent/15 text-accent border border-accent/20">
                    {(customer as any).contactRole}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {customer.phone && (
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Phone</div>
                      <div className="font-medium">{customer.phone}</div>
                    </div>
                  </div>
                )}
                {(customer.city || customer.state) && (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="font-medium">
                        {[customer.city, customer.state].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </div>
                )}
                {customer.streetAddress && (
                  <div className="flex items-start gap-2.5 sm:col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Address</div>
                      <div className="font-medium">
                        {[customer.streetAddress, customer.city, customer.state, customer.zipCode]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                )}
                {assignedRep && (
                  <div className="flex items-start gap-2.5" data-testid="assigned-rep">
                    <UserRound className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Assigned Salesman</div>
                      <div className="font-medium">
                        {assignedRep.email?.split("@")[0] ?? "—"}
                        {assignedRep.staffId && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                            #{assignedRep.staffId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!customer.phone && !customer.city && !customer.state && !customer.streetAddress && !assignedRep && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">No contact details on file.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick Notes */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Notes
              </h2>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          <form onSubmit={handleAddNote} className="mb-5">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type a quick note about this account..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              data-testid="note-textarea"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAddNote(e as any);
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Cmd+Enter to post</span>
              <button
                type="submit"
                disabled={!noteText.trim() || addNoteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                data-testid="add-note-button"
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <StickyNote className="w-4 h-4" />
                )}
                Post Note
              </button>
            </div>
          </form>

          {notesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              No notes yet. Add the first one above.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="flex gap-2 group" data-testid={`note-${note.id}`}>
                  <div className="flex-1 bg-muted/40 rounded-xl px-4 py-3 border border-border/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {note.author?.email?.split("@")[0] ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatNoteDate(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {note.body}
                    </p>
                  </div>
                  {(isAdmin || note.userId === userId) && (
                    <button
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      disabled={deleteNoteMutation.isPending}
                      className="p-1.5 self-start opacity-0 group-hover:opacity-100 rounded-lg hover:bg-destructive/10 text-destructive transition-all flex-shrink-0 mt-1"
                      title="Delete note"
                      data-testid={`delete-note-${note.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interaction History */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Interaction History
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {leads.length} records
            </span>
          </div>

          {leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No interactions yet.{" "}
              <Link href="/leads/new" className="text-primary font-medium hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead: any) => {
                const inactive = lead.isActive === false;
                return (
                  <div
                    key={lead.id}
                    className={cn(
                      "relative pl-5 border-l-2 last:border-transparent",
                      inactive ? "border-border/40 opacity-60" : "border-border"
                    )}
                    data-testid={`history-lead-${lead.id}`}
                  >
                    <div className={cn(
                      "absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                      inactive ? "bg-muted-foreground/40" : "bg-accent"
                    )} />
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {(() => {
                          const meta = (lead.metadata ?? {}) as Record<string, string>;
                          const tempColors: Record<string, string> = {
                            Hot: "bg-red-100 text-red-700",
                            Medium: "bg-amber-100 text-amber-700",
                            Cold: "bg-blue-100 text-blue-700",
                          };
                          return (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-semibold",
                                    inactive
                                      ? "bg-muted text-muted-foreground"
                                      : STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700"
                                  )}
                                >
                                  {lead.status}
                                </span>
                                {meta.temperature && (
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", tempColors[meta.temperature] ?? "bg-gray-100 text-gray-700")}>
                                    {meta.temperature === "Hot" ? "🔥" : meta.temperature === "Cold" ? "❄️" : "🌤"} {meta.temperature}
                                  </span>
                                )}
                                {inactive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium tracking-wide uppercase">
                                    Archived
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                {lead.user?.email && (
                                  <span className="text-xs text-muted-foreground">
                                    by {lead.user.email.split("@")[0]}
                                  </span>
                                )}
                              </div>
                              {meta.contactDate && (
                                <p className="text-xs mt-1 text-muted-foreground">
                                  <span className="font-semibold">Contacted:</span>{" "}
                                  {new Date(meta.contactDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              )}
                              {meta.currentSupplier && (
                                <p className="text-xs mt-1.5 text-muted-foreground">
                                  <span className="font-semibold">Current Supplier:</span> {meta.currentSupplier}
                                </p>
                              )}
                              {meta.productsDiscussed && (
                                <p className="text-xs mt-0.5 text-muted-foreground">
                                  <span className="font-semibold">Products &amp; Pricing:</span> {meta.productsDiscussed}
                                </p>
                              )}
                              {lead.notes && (
                                <p className="text-sm mt-1.5 text-foreground/80 leading-relaxed">
                                  {lead.notes}
                                </p>
                              )}
                              {lead.followUpDate && !inactive && (
                                <div className="text-xs text-accent font-medium mt-1">
                                  Follow-up: {new Date(lead.followUpDate + "T00:00:00").toLocaleDateString()}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {!inactive && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => followupMutation.mutate({ id: lead.id })}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition"
                            title="Send follow-up email"
                            data-testid={`followup-${lead.id}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground transition underline-offset-2 hover:underline"
                            data-testid={`view-lead-${lead.id}`}
                          >
                            Edit
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewLeadModal(false); }}
          data-testid="new-lead-modal"
        >
          <div className="bg-card border border-card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h2 className="font-bold text-base" data-testid="new-lead-modal-title">New Lead</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{customer.companyName}</p>
              </div>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground"
                data-testid="close-new-lead-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateLead} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </label>
                <select
                  value={leadForm.status}
                  onChange={(e) => setLeadForm(f => ({ ...f, status: e.target.value as typeof LEAD_STATUSES[number] }))}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="modal-lead-status"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Date
                  </label>
                  <input
                    type="date"
                    value={leadForm.contactDate}
                    onChange={(e) => setLeadForm(f => ({ ...f, contactDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="modal-lead-contact-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Follow-up Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={leadForm.followUpDate}
                    onChange={(e) => setLeadForm(f => ({ ...f, followUpDate: e.target.value }))}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="modal-lead-followup-date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Supplier
                  </label>
                  <input
                    type="text"
                    value={leadForm.currentSupplier}
                    onChange={(e) => setLeadForm(f => ({ ...f, currentSupplier: e.target.value }))}
                    placeholder="Who supplies them now?"
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="modal-lead-supplier"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Temperature
                  </label>
                  <select
                    value={leadForm.temperature}
                    onChange={(e) => setLeadForm(f => ({ ...f, temperature: e.target.value as "" | "Hot" | "Medium" | "Cold" }))}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="modal-lead-temperature"
                  >
                    <option value="">Select...</option>
                    <option value="Hot">🔥 Hot</option>
                    <option value="Medium">🌤 Medium</option>
                    <option value="Cold">❄️ Cold</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Products &amp; Pricing Discussed
                </label>
                <textarea
                  value={leadForm.productsDiscussed}
                  onChange={(e) => setLeadForm(f => ({ ...f, productsDiscussed: e.target.value }))}
                  rows={2}
                  placeholder="List products and pricing discussed..."
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  data-testid="modal-lead-products"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add notes about this interaction..."
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  data-testid="modal-lead-notes"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending || !leadForm.followUpDate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  data-testid="modal-submit-lead"
                >
                  {createLeadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
