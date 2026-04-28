import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

interface Category {
  id: number;
  name: string;
  description: string | null;
}

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function auth() { return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }; }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/categories", { headers: auth() });
      setCategories(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to add", variant: "destructive" });
        return;
      }
      setNewName("");
      setNewDesc("");
      toast({ title: "Category added" });
      load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: number) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
    });
    if (!res.ok) {
      toast({ title: "Failed to update", variant: "destructive" });
      return;
    }
    setEditingId(null);
    toast({ title: "Category updated" });
    load();
  }

  async function deleteCategory(id: number) {
    if (!confirm("Delete this category? Parts assigned to it will be uncategorized.")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE", headers: auth() });
    toast({ title: "Category deleted" });
    load();
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize parts by category for easier lookup and quoting</p>
        </div>

        {/* Add new */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" /> Add Category
          </h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCategory()}
              placeholder="Category name…"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              data-testid="category-name-input"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Short description (optional)"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={addCategory}
              disabled={adding || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              data-testid="category-add-btn"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Tag className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No categories yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {categories.map(cat => (
                <div key={cat.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  {editingId === cat.id ? (
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 w-40"
                        autoFocus
                      />
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description"
                        className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <button onClick={() => saveEdit(cat.id)} className="p-1.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-muted">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-accent" />
                          <span className="font-medium text-sm">{cat.name}</span>
                        </div>
                        {cat.description && <p className="text-xs text-muted-foreground mt-0.5 ml-5">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditDesc(cat.description ?? ""); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
