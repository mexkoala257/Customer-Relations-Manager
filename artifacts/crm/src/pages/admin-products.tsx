import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Package, Plus, Pencil, X, Save, Loader2, Tag, DollarSign, Hash,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  unitPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  sku: "",
  category: "",
  unitPrice: "",
  isActive: true,
};

export default function AdminProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => customFetch<Product[]>("/api/products"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (editingId) {
        return customFetch<Product>(`/api/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      }
      return customFetch<Product>("/api/products", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: editingId ? "Product updated" : "Product created" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to save product", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch<{ message: string }>(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deactivated" });
    },
    onError: () => toast({ title: "Failed to deactivate product", variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch<Product>(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product reactivated" });
    },
    onError: () => toast({ title: "Failed to reactivate", variant: "destructive" }),
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      sku: p.sku ?? "",
      category: p.category ?? "",
      unitPrice: p.unitPrice,
      isActive: p.isActive,
    });
    setEditingId(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.unitPrice) return;
    saveMutation.mutate(form);
  }

  const filtered = products.filter((p) => {
    if (filterActive === "active") return p.isActive;
    if (filterActive === "inactive") return !p.isActive;
    return true;
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Product Catalog</h1>
              <p className="text-sm text-muted-foreground">
                {products.filter((p) => p.isActive).length} active products
              </p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">
                {editingId ? "Edit Product" : "New Product"}
              </h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Product Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="e.g. Commercial LED Panel"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Unit Price *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.unitPrice}
                      onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      required
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    SKU / Part Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                      placeholder="e.g. LED-COM-48"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Lighting, Solar, HVAC"
                      list="category-suggestions"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <datalist id="category-suggestions">
                      {categories.map((c) => <option key={c!} value={c!} />)}
                    </datalist>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief product description (used in quotes)..."
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingId ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {(["active", "all", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                filterActive === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No products found.</p>
              <p className="text-xs mt-1">Click "New Product" to add your first product.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">SKU</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {p.category ? (
                          <span className="px-2 py-0.5 bg-muted rounded-full text-xs">{p.category}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono hidden sm:table-cell">
                        {p.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ${Number(p.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          p.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(p)}
                            title="Edit"
                            className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {p.isActive ? (
                            <button
                              onClick={() => deactivateMutation.mutate(p.id)}
                              disabled={deactivateMutation.isPending}
                              title="Deactivate"
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => reactivateMutation.mutate(p.id)}
                              disabled={reactivateMutation.isPending}
                              title="Reactivate"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 transition text-muted-foreground hover:text-emerald-600"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
