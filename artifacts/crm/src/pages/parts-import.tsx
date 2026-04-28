import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Upload, FileText, Loader2, Check, X, AlertTriangle, ChevronDown, RefreshCw, ArrowRight, Plus, ArrowLeftRight,
} from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface ExtractedPart {
  partNumber: string;
  description: string | null;
  retailPrice: string | null;
  xstorePrice: string | null;
  tier1Price: string | null;
  categoryGuess: string | null;
  categoryId?: number | null;
  _skip?: boolean;
}

interface PriceUpdateRow {
  id: number;
  partNumber: string;
  description: string | null;
  currentRetail: string | null;
  currentXstore: string | null;
  currentTier1: string | null;
  newRetail: string | null;
  newXstore: string | null;
  newTier1: string | null;
  hasChanges: boolean;
  _skip?: boolean;
}

interface NewPart extends ExtractedPart {}

interface DiscontinuedPart {
  id: number;
  partNumber: string;
  description: string | null;
}

type Tab = "full" | "update";

function fmt(price: string | null | undefined) {
  if (!price) return "—";
  return `$${parseFloat(price).toFixed(2)}`;
}

function PriceDiff({ current, next }: { current: string | null; next: string | null }) {
  const changed = current !== next && !((!current || !next) && current === next);
  if (!changed) return <span className="text-sm text-muted-foreground">{fmt(next)}</span>;
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="line-through text-muted-foreground">{fmt(current)}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <span className="font-semibold text-accent">{fmt(next)}</span>
    </span>
  );
}

function DropZone({ onFile, loading }: { onFile: (f: File) => void; loading: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
        dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 bg-muted/30"
      )}
    >
      <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-foreground">Processing PDF with AI…</p>
          <p className="text-xs text-muted-foreground">This may take 30–60 seconds</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Upload className="w-7 h-7 text-accent" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Drop your price sheet PDF here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse — max 20MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartsImportPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("full");
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoaded, setCatLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Full import state
  const [parts, setParts] = useState<ExtractedPart[]>([]);
  const [fullDone, setFullDone] = useState(false);

  // Price update state
  const [matched, setMatched] = useState<PriceUpdateRow[]>([]);
  const [newParts, setNewParts] = useState<NewPart[]>([]);
  const [discontinued, setDiscontinued] = useState<DiscontinuedPart[]>([]);
  const [updateDone, setUpdateDone] = useState(false);

  function auth() { return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }; }
  function authUpload() { return { Authorization: `Bearer ${getToken()}` }; }

  async function loadCategories() {
    if (catLoaded) return;
    const res = await fetch("/api/categories", { headers: auth() });
    setCategories(await res.json());
    setCatLoaded(true);
  }

  async function handleFullImport(file: File) {
    setLoading(true);
    await loadCategories();
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/parts/import/extract", { method: "POST", headers: authUpload(), body: fd });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Extraction failed", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setParts(data.parts.map((p: ExtractedPart) => ({ ...p, _skip: false, categoryId: null })));
    } finally {
      setLoading(false);
    }
  }

  async function handlePriceUpdate(file: File) {
    setLoading(true);
    await loadCategories();
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/parts/import/price-update", { method: "POST", headers: authUpload(), body: fd });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Extraction failed", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setMatched(data.matched.map((r: PriceUpdateRow) => ({ ...r, _skip: !r.hasChanges })));
      setNewParts(data.newParts.map((p: NewPart) => ({ ...p, _skip: false, categoryId: null })));
      setDiscontinued(data.discontinued);
    } finally {
      setLoading(false);
    }
  }

  async function confirmFullImport() {
    const toImport = parts.filter(p => !p._skip && p.partNumber.trim());
    if (toImport.length === 0) return toast({ title: "No parts selected" });
    setConfirming(true);
    try {
      const res = await fetch("/api/parts/bulk", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ parts: toImport }),
      });
      const data = await res.json();
      toast({ title: `Imported ${data.inserted} part${data.inserted !== 1 ? "s" : ""}` });
      setFullDone(true);
    } finally {
      setConfirming(false);
    }
  }

  async function confirmPriceUpdate() {
    const updates = matched
      .filter(r => !r._skip && r.hasChanges)
      .map(r => ({ id: r.id, retailPrice: r.newRetail, xstorePrice: r.newXstore, tier1Price: r.newTier1 }));
    const toAdd = newParts.filter(p => !p._skip && p.partNumber.trim());

    setConfirming(true);
    try {
      let updatedCount = 0;
      let addedCount = 0;
      if (updates.length > 0) {
        const res = await fetch("/api/parts/bulk-update-prices", {
          method: "POST",
          headers: auth(),
          body: JSON.stringify({ updates }),
        });
        const d = await res.json();
        updatedCount = d.updated;
      }
      if (toAdd.length > 0) {
        const res = await fetch("/api/parts/bulk", {
          method: "POST",
          headers: auth(),
          body: JSON.stringify({ parts: toAdd }),
        });
        const d = await res.json();
        addedCount = d.inserted;
      }
      toast({ title: `Updated ${updatedCount} price${updatedCount !== 1 ? "s" : ""}${addedCount > 0 ? `, added ${addedCount} new part${addedCount !== 1 ? "s" : ""}` : ""}` });
      setUpdateDone(true);
    } finally {
      setConfirming(false);
    }
  }

  function updatePart(idx: number, field: keyof ExtractedPart, value: string | number | null | boolean) {
    setParts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }
  function updateMatched(idx: number, field: keyof PriceUpdateRow, value: string | number | null | boolean) {
    setMatched(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function updateNewPart(idx: number, field: keyof NewPart, value: string | number | null | boolean) {
    setNewParts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }
  function swapRetailXstore() {
    setParts(prev => prev.map(p => ({ ...p, retailPrice: p.xstorePrice, xstorePrice: p.retailPrice })));
    toast({ title: "Retail & Xstore prices swapped for all rows" });
  }
  function swapRetailXstoreMatched() {
    setMatched(prev => prev.map(r => ({
      ...r,
      newRetail: r.newXstore,
      newXstore: r.newRetail,
      currentRetail: r.currentXstore,
      currentXstore: r.currentRetail,
    })));
    setNewParts(prev => prev.map(p => ({ ...p, retailPrice: p.xstorePrice, xstorePrice: p.retailPrice })));
    toast({ title: "Retail & Xstore prices swapped for all rows" });
  }

  const changedCount = matched.filter(r => r.hasChanges && !r._skip).length;
  const includedCount = parts.filter(p => !p._skip).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Parts Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload your Interstate Batteries price sheet PDF</p>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-border gap-1">
          {([["full", "Full Import"], ["update", "Price Update"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setParts([]); setMatched([]); setNewParts([]); setDiscontinued([]); setFullDone(false); setUpdateDone(false); }}
              className={cn("px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                tab === id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "full" && (
          <div className="space-y-5">
            {fullDone ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Import complete!</h3>
                <p className="text-sm text-muted-foreground mb-6">Parts have been added to the catalog</p>
                <button onClick={() => { setParts([]); setFullDone(false); }} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Import another
                </button>
              </div>
            ) : parts.length === 0 ? (
              <DropZone onFile={handleFullImport} loading={loading} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{parts.length} parts extracted — review and edit before importing ({includedCount} selected)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All cells are editable. Click any value to change it.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => { setParts([]); setFullDone(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">
                      <RefreshCw className="w-3.5 h-3.5" /> Re-upload
                    </button>
                    <button onClick={swapRetailXstore} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30">
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Swap Retail ↔ Xstore
                    </button>
                    <button
                      onClick={confirmFullImport}
                      disabled={confirming || includedCount === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
                      data-testid="confirm-import-btn"
                    >
                      {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Confirm Import ({includedCount})
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-10">
                            <input type="checkbox" checked={parts.every(p => !p._skip)} onChange={e => setParts(prev => prev.map(p => ({ ...p, _skip: !e.target.checked })))} />
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Category</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Retail</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Xstore</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Tier 1</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parts.map((part, idx) => (
                          <tr key={idx} className={cn("hover:bg-muted/30", part._skip && "opacity-40")}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={!part._skip} onChange={e => updatePart(idx, "_skip", !e.target.checked)} />
                            </td>
                            <td className="px-3 py-2">
                              <input value={part.partNumber} onChange={e => updatePart(idx, "partNumber", e.target.value)} className="font-mono text-xs bg-transparent border-b border-dashed border-border focus:outline-none focus:border-accent w-28" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={part.description ?? ""} onChange={e => updatePart(idx, "description", e.target.value)} className="text-xs bg-transparent border-b border-dashed border-border focus:outline-none focus:border-accent w-48" placeholder="No description" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={part.categoryId ?? ""} onChange={e => updatePart(idx, "categoryId", e.target.value ? Number(e.target.value) : null)} className="text-xs bg-background border border-border rounded px-1.5 py-1 focus:outline-none">
                                <option value="">{part.categoryGuess ?? "—"}</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            {(["retailPrice", "xstorePrice", "tier1Price"] as const).map(field => (
                              <td key={field} className="px-3 py-2">
                                <input value={part[field] ?? ""} onChange={e => updatePart(idx, field, e.target.value || null)} className="font-mono text-xs bg-transparent border-b border-dashed border-border focus:outline-none focus:border-accent w-20" placeholder="—" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "update" && (
          <div className="space-y-5">
            {updateDone ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Price update complete!</h3>
                <p className="text-sm text-muted-foreground mb-6">Prices have been updated in the catalog</p>
                <button onClick={() => { setMatched([]); setNewParts([]); setDiscontinued([]); setUpdateDone(false); }} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Upload another
                </button>
              </div>
            ) : matched.length === 0 && newParts.length === 0 ? (
              <div className="space-y-3">
                <DropZone onFile={handlePriceUpdate} loading={loading} />
                <p className="text-xs text-muted-foreground text-center">
                  Upload the new price sheet. Existing parts will be matched and only prices will be updated — descriptions and categories stay unchanged.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{changedCount}</span> price change{changedCount !== 1 ? "s" : ""} to apply
                    {newParts.filter(p => !p._skip).length > 0 && <>, <span className="font-medium text-foreground">{newParts.filter(p => !p._skip).length}</span> new parts to add</>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => { setMatched([]); setNewParts([]); setDiscontinued([]); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">
                      <RefreshCw className="w-3.5 h-3.5" /> Re-upload
                    </button>
                    <button onClick={swapRetailXstoreMatched} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30">
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Swap Retail ↔ Xstore
                    </button>
                    <button
                      onClick={confirmPriceUpdate}
                      disabled={confirming || (changedCount === 0 && newParts.filter(p => !p._skip).length === 0)}
                      className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
                      data-testid="confirm-update-btn"
                    >
                      {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Apply Updates
                    </button>
                  </div>
                </div>

                {/* Matched rows with changes */}
                {matched.some(r => r.hasChanges) && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-muted/40">
                      <h3 className="text-sm font-semibold">Price Changes ({matched.filter(r => r.hasChanges).length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-10">
                              <input type="checkbox" checked={matched.filter(r => r.hasChanges).every(r => !r._skip)} onChange={e => setMatched(prev => prev.map(r => r.hasChanges ? { ...r, _skip: !e.target.checked } : r))} />
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Retail</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Xstore</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Tier 1</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {matched.filter(r => r.hasChanges).map((row, idx) => {
                            const realIdx = matched.indexOf(row);
                            return (
                              <tr key={idx} className={cn("hover:bg-muted/30", row._skip && "opacity-40")}>
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={!row._skip} onChange={e => updateMatched(realIdx, "_skip", !e.target.checked)} />
                                </td>
                                <td className="px-3 py-2 font-mono text-xs font-medium">{row.partNumber}</td>
                                <td className="px-3 py-2"><PriceDiff current={row.currentRetail} next={row.newRetail} /></td>
                                <td className="px-3 py-2"><PriceDiff current={row.currentXstore} next={row.newXstore} /></td>
                                <td className="px-3 py-2"><PriceDiff current={row.currentTier1} next={row.newTier1} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Unchanged rows */}
                {matched.some(r => !r.hasChanges) && (
                  <details className="bg-card border border-border rounded-2xl overflow-hidden">
                    <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      {matched.filter(r => !r.hasChanges).length} parts unchanged (click to view)
                    </summary>
                    <div className="border-t border-border divide-y divide-border">
                      {matched.filter(r => !r.hasChanges).map((row, idx) => (
                        <div key={idx} className="px-5 py-2.5 flex items-center gap-4 text-sm opacity-60">
                          <span className="font-mono text-xs font-medium w-28">{row.partNumber}</span>
                          <span className="text-muted-foreground">{fmt(row.currentRetail)} / {fmt(row.currentXstore)} / {fmt(row.currentTier1)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* New parts found in PDF */}
                {newParts.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-accent/5">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Plus className="w-4 h-4 text-accent" />
                        New Parts Found ({newParts.length})
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">These part numbers weren't in your catalog — select any to add them</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-10">
                              <input type="checkbox" checked={newParts.every(p => !p._skip)} onChange={e => setNewParts(prev => prev.map(p => ({ ...p, _skip: !e.target.checked })))} />
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Category</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Retail</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Xstore</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Tier 1</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {newParts.map((part, idx) => (
                            <tr key={idx} className={cn("hover:bg-muted/30", part._skip && "opacity-40")}>
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={!part._skip} onChange={e => updateNewPart(idx, "_skip", !e.target.checked)} />
                              </td>
                              <td className="px-3 py-2 font-mono text-xs font-medium">{part.partNumber}</td>
                              <td className="px-3 py-2">
                                <input value={part.description ?? ""} onChange={e => updateNewPart(idx, "description", e.target.value)} className="text-xs bg-transparent border-b border-dashed border-border focus:outline-none focus:border-accent w-40" placeholder="—" />
                              </td>
                              <td className="px-3 py-2">
                                <select value={part.categoryId ?? ""} onChange={e => updateNewPart(idx, "categoryId", e.target.value ? Number(e.target.value) : null)} className="text-xs bg-background border border-border rounded px-1.5 py-1 focus:outline-none">
                                  <option value="">—</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{fmt(part.retailPrice)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{fmt(part.xstorePrice)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{fmt(part.tier1Price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Discontinued */}
                {discontinued.length > 0 && (
                  <div className="bg-card border border-amber-200 dark:border-amber-900 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4" />
                        Possibly Discontinued ({discontinued.length})
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">These parts are active in your catalog but not in this price sheet. No automatic action taken.</p>
                    </div>
                    <div className="divide-y divide-border">
                      {discontinued.map((p, idx) => (
                        <div key={idx} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                          <span className="font-mono text-xs font-medium">{p.partNumber}</span>
                          {p.description && <span className="text-muted-foreground text-xs">{p.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
