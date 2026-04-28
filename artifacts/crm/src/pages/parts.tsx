import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Search, Package, Tag, ChevronDown, ToggleLeft, ToggleRight, Pencil, X, Check, Loader2, Upload } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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

function fmt(price: string | null) {
  if (!price) return "—";
  return `$${parseFloat(price).toFixed(2)}`;
}

function PriceBadge({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl px-3 py-2 min-w-[80px]", accent ? "bg-accent/10" : "bg-muted/60")}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</span>
      <span className={cn("text-sm font-bold", accent ? "text-accent" : "text-foreground")}>{fmt(value)}</span>
    </div>
  );
}

export default function PartsPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function auth() { return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }; }

  useEffect(() => {
    fetch("/api/categories", { headers: auth() })
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(fetchParts, 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [q, categoryId, includeInactive]);

  async function fetchParts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (includeInactive) params.set("includeInactive", "true");
      params.set("limit", "200");
      const res = await fetch(`/api/parts?${params}`, { headers: auth() });
      const data = await res.json();
      setParts(data.rows ?? data);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(part: Part) {
    await fetch(`/api/parts/${part.id}/toggle-active`, { method: "POST", headers: auth() });
    fetchParts();
  }

  async function saveDesc(part: Part) {
    await fetch(`/api/parts/${part.id}`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ description: editDesc }),
    });
    setEditingId(null);
    fetchParts();
    toast({ title: "Description updated" });
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Price Lookup</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Search the parts catalog — all three price tiers shown</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Link href="/parts/import">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition">
                  <Upload className="w-4 h-4" />
                  Import / Update Prices
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by part number or description…"
              className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              data-testid="parts-search"
            />
          </div>
          <div className="relative">
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="appearance-none bg-card border border-border rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/30"
              data-testid="parts-category-filter"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {isAdmin && (
            <button
              onClick={() => setIncludeInactive(v => !v)}
              className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                includeInactive ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground bg-card")}
            >
              {includeInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Show Inactive
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{q || categoryId ? "No parts match your search" : "No parts in the catalog yet"}</p>
            {isAdmin && !q && !categoryId && (
              <Link href="/parts/import">
                <button className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Import Parts from PDF
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{parts.length} result{parts.length !== 1 ? "s" : ""}{parts.length === 200 ? " (showing first 200)" : ""}</p>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="divide-y divide-border">
                {parts.map(part => (
                  <div key={part.id} className={cn("px-5 py-4 hover:bg-muted/30 transition-colors", !part.isActive && "opacity-50")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-foreground">{part.partNumber}</span>
                          {!part.isActive && (
                            <span className="text-[10px] font-semibold uppercase bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inactive</span>
                          )}
                          {part.categoryName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              <Tag className="w-3 h-3" />{part.categoryName}
                            </span>
                          )}
                        </div>

                        {editingId === part.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                              autoFocus
                            />
                            <button onClick={() => saveDesc(part)} className="p-1.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-muted">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-1 group">
                            <p className="text-sm text-muted-foreground">{part.description || <span className="italic opacity-50">No description</span>}</p>
                            {isAdmin && (
                              <button
                                onClick={() => { setEditingId(part.id); setEditDesc(part.description ?? ""); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                              >
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <PriceBadge label="Retail" value={part.retailPrice} />
                        <PriceBadge label="Xstore" value={part.xstorePrice} />
                        <PriceBadge label="Tier 1" value={part.tier1Price} accent />
                        {isAdmin && (
                          <button
                            onClick={() => toggleActive(part)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title={part.isActive ? "Deactivate" : "Activate"}
                          >
                            {part.isActive ? <ToggleRight className="w-4 h-4 text-accent" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
