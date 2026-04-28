import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Loader2, Check, X, Trash2, Pencil, ChevronDown,
  ToggleLeft, ToggleRight, Tag, Upload, Package, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";

interface Part {
  id: number;
  partNumber: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  retailPrice: string | null;
  xstorePrice: string | null;
  tier1Price: string | null;
  isActive: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface EditState {
  partNumber: string;
  description: string;
  categoryId: string;
  retailPrice: string;
  xstorePrice: string;
  tier1Price: string;
}

const EMPTY_EDIT: EditState = {
  partNumber: "", description: "", categoryId: "",
  retailPrice: "", xstorePrice: "", tier1Price: "",
};

function priceDisplay(v: string | null) {
  if (!v) return "—";
  return `$${parseFloat(v).toFixed(2)}`;
}

function PriceInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? "0.00"}
      className="w-24 px-2 py-1 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50"
    />
  );
}

export default function AdminPartsPage() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const isSuperAdmin = userRole === "superadmin";
  const PAGE_SIZE = 100;
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newState, setNewState] = useState<EditState>(EMPTY_EDIT);
  const [creating, setCreating] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function auth() {
    return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
  }

  useEffect(() => {
    fetch("/api/categories", { headers: auth() })
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
    setEditingId(null);
  }, [q, categoryFilter, includeInactive]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(fetchParts, 250);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [q, categoryFilter, includeInactive, page]);

  async function fetchParts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (includeInactive) params.set("includeInactive", "true");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      const res = await fetch(`/api/parts?${params}`, { headers: auth() });
      const data = await res.json();
      setParts(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(part: Part) {
    setEditingId(part.id);
    setEditState({
      partNumber: part.partNumber,
      description: part.description ?? "",
      categoryId: part.categoryId ? String(part.categoryId) : "",
      retailPrice: part.retailPrice ?? "",
      xstorePrice: part.xstorePrice ?? "",
      tier1Price: part.tier1Price ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(EMPTY_EDIT);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        partNumber: editState.partNumber.trim().toUpperCase(),
        description: editState.description.trim() || null,
        categoryId: editState.categoryId ? Number(editState.categoryId) : null,
        retailPrice: editState.retailPrice.trim() || null,
        xstorePrice: editState.xstorePrice.trim() || null,
        tier1Price: editState.tier1Price.trim() || null,
      };
      const res = await fetch(`/api/parts/${id}`, {
        method: "PATCH", headers: auth(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to save", variant: "destructive" });
        return;
      }
      toast({ title: "Part updated" });
      setEditingId(null);
      fetchParts();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(part: Part) {
    await fetch(`/api/parts/${part.id}/toggle-active`, { method: "POST", headers: auth() });
    fetchParts();
    toast({ title: part.isActive ? "Part deactivated" : "Part activated" });
  }

  async function deletePart(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/parts/${id}`, { method: "DELETE", headers: auth() });
      if (!res.ok) {
        toast({ title: "Delete failed", variant: "destructive" });
        return;
      }
      toast({ title: "Part deleted" });
      fetchParts();
    } finally {
      setDeletingId(null);
    }
  }

  async function createPart() {
    if (!newState.partNumber.trim()) {
      toast({ title: "Part number is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const body = {
        partNumber: newState.partNumber.trim().toUpperCase(),
        description: newState.description.trim() || null,
        categoryId: newState.categoryId ? Number(newState.categoryId) : null,
        retailPrice: newState.retailPrice.trim() || null,
        xstorePrice: newState.xstorePrice.trim() || null,
        tier1Price: newState.tier1Price.trim() || null,
      };
      const res = await fetch("/api/parts", {
        method: "POST", headers: auth(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to create", variant: "destructive" });
        return;
      }
      toast({ title: "Part created" });
      setShowNew(false);
      setNewState(EMPTY_EDIT);
      fetchParts();
    } finally {
      setCreating(false);
    }
  }

  async function deleteAllParts() {
    setDeletingAll(true);
    try {
      const res = await fetch("/api/parts", {
        method: "DELETE",
        headers: auth(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Delete failed", variant: "destructive" });
        return;
      }
      toast({ title: `Deleted ${data.deleted} part${data.deleted !== 1 ? "s" : ""}` });
      setShowDeleteAll(false);
      setDeleteAllConfirm("");
      setParts([]);
      setTotal(0);
      setPage(0);
    } finally {
      setDeletingAll(false);
    }
  }

  function setEdit(field: keyof EditState, value: string) {
    setEditState(s => ({ ...s, [field]: value }));
  }
  function setNew(field: keyof EditState, value: string) {
    setNewState(s => ({ ...s, [field]: value }));
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Manage Parts Catalog</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create, edit, and manage all battery catalog entries</p>
          </div>
          <div className="flex gap-2">
            <Link href="/parts/import">
              <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                <Upload className="w-4 h-4" /> Import from PDF
              </button>
            </Link>
            <button
              onClick={() => { setShowNew(true); setNewState(EMPTY_EDIT); }}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> New Part
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search part number or description…"
              className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none bg-card border border-border rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => setIncludeInactive(v => !v)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
              includeInactive ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground bg-card"
            )}
          >
            {includeInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Show Inactive
          </button>
        </div>

        {/* New Part Form */}
        {showNew && (
          <div className="bg-card border border-accent/30 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border bg-accent/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-accent">New Part</h3>
              <button onClick={() => setShowNew(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Part Number *</label>
                <input
                  value={newState.partNumber}
                  onChange={e => setNew("partNumber", e.target.value)}
                  placeholder="e.g. MTP-24"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                  autoFocus
                />
              </div>
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
                <input
                  value={newState.description}
                  onChange={e => setNew("description", e.target.value)}
                  placeholder="e.g. Group 24 Automotive Battery, 650 CCA"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Category</label>
                <select
                  value={newState.categoryId}
                  onChange={e => setNew("categoryId", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">— None —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Retail Price</label>
                <input
                  value={newState.retailPrice}
                  onChange={e => setNew("retailPrice", e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Xstore Price</label>
                <input
                  value={newState.xstorePrice}
                  onChange={e => setNew("xstorePrice", e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Tier 1 Price</label>
                <input
                  value={newState.tier1Price}
                  onChange={e => setNew("tier1Price", e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
              <button
                onClick={createPart}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Create Part
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (parts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{q || categoryFilter ? "No parts match your search" : "No parts in the catalog yet"}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
            {total} part{total !== 1 ? "s" : ""} total
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Retail</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Xstore</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tier 1</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parts.map(part => {
                      const isEditing = editingId === part.id;
                      return (
                        <tr key={part.id} className={cn("hover:bg-muted/20 transition-colors", !part.isActive && "opacity-50")}>
                          {isEditing ? (
                            <>
                              <td className="px-4 py-2">
                                <input
                                  value={editState.partNumber}
                                  onChange={e => setEdit("partNumber", e.target.value)}
                                  className="w-28 px-2 py-1 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/50"
                                  autoFocus
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  value={editState.description}
                                  onChange={e => setEdit("description", e.target.value)}
                                  placeholder="No description"
                                  className="w-56 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={editState.categoryId}
                                  onChange={e => setEdit("categoryId", e.target.value)}
                                  className="px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent/50"
                                >
                                  <option value="">— None —</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2"><PriceInput value={editState.retailPrice} onChange={v => setEdit("retailPrice", v)} /></td>
                              <td className="px-4 py-2"><PriceInput value={editState.xstorePrice} onChange={v => setEdit("xstorePrice", v)} /></td>
                              <td className="px-4 py-2"><PriceInput value={editState.tier1Price} onChange={v => setEdit("tier1Price", v)} /></td>
                              <td className="px-4 py-2">
                                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", part.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                                  {part.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => saveEdit(part.id)}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-accent text-accent-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
                                  >
                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    Save
                                  </button>
                                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted text-muted-foreground">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3">
                                <span className="font-mono font-semibold text-xs text-foreground">{part.partNumber}</span>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <span className="text-xs text-muted-foreground line-clamp-2">{part.description || <span className="italic opacity-50">No description</span>}</span>
                              </td>
                              <td className="px-4 py-3">
                                {part.categoryName ? (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Tag className="w-3 h-3" />{part.categoryName}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50 italic">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{priceDisplay(part.retailPrice)}</td>
                              <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{priceDisplay(part.xstorePrice)}</td>
                              <td className="px-4 py-3 font-mono text-xs font-medium text-accent">{priceDisplay(part.tier1Price)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleActive(part)}
                                  className={cn(
                                    "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                                    part.isActive
                                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  )}
                                  title={part.isActive ? "Click to deactivate" : "Click to activate"}
                                >
                                  {part.isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                                  {part.isActive ? "Active" : "Inactive"}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => startEdit(part)}
                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete ${part.partNumber}? This cannot be undone.`)) deletePart(part.id);
                                    }}
                                    disabled={deletingId === part.id}
                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingId === part.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // Show pages around current
                    let p: number;
                    if (totalPages <= 7) {
                      p = i;
                    } else if (page < 4) {
                      p = i;
                    } else if (page > totalPages - 5) {
                      p = totalPages - 7 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                          p === page
                            ? "border-accent bg-accent text-accent-foreground font-semibold"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {p + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone — superadmin only */}
      {isSuperAdmin && (
        <div className="mt-10 border border-destructive/40 rounded-2xl p-5 bg-destructive/5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Permanently delete every part in the catalog. This cannot be undone. Use only as a last resort before re-importing a clean price sheet.
          </p>
          <button
            onClick={() => { setShowDeleteAll(true); setDeleteAllConfirm(""); }}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
          >
            Delete All Parts…
          </button>
        </div>
      )}

      {/* Delete-all confirmation modal */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h2 className="text-base font-semibold">Delete all {total.toLocaleString()} parts?</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently erase every part, price, and category assignment in the catalog. There is no undo.
            </p>
            <p className="text-sm font-medium mb-2">
              Type <span className="font-mono bg-muted px-1 rounded">DELETE ALL</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteAllConfirm}
              onChange={e => setDeleteAllConfirm(e.target.value)}
              placeholder="DELETE ALL"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-destructive mb-4 font-mono"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteAll(false); setDeleteAllConfirm(""); }}
                disabled={deletingAll}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAllParts}
                disabled={deleteAllConfirm !== "DELETE ALL" || deletingAll}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Yes, delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
