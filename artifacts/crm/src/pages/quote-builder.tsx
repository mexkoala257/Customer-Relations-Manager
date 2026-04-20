import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, Save, Send, Loader2, Package, Search,
  X, DollarSign, Percent, FileText, Building2, ChevronDown,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  unitPrice: string;
  isActive: boolean;
}

interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  phone: string | null;
}

interface LineItem {
  key: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface QuoteFull {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  customerId: string;
  userId: string;
  items: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
    sortOrder: number;
  }>;
}

function calcTotals(items: LineItem[], taxRate: number) {
  const subtotal = items.reduce(
    (sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0),
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

let keyCounter = 0;
function newKey() { return `item-${++keyCounter}`; }

function emptyLine(overrides: Partial<LineItem> = {}): LineItem {
  return {
    key: newKey(),
    productId: null,
    description: "",
    quantity: "1",
    unitPrice: "0.00",
    ...overrides,
  };
}

export default function QuoteBuilderPage({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = !!id;

  const params = new URLSearchParams(window.location.search);
  const prefilledCustomerId = params.get("customerId") ?? "";

  const [title, setTitle] = useState("New Quote");
  const [customerId, setCustomerId] = useState(prefilledCustomerId);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productModalTarget, setProductModalTarget] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [showEmailOptions, setShowEmailOptions] = useState(false);
  const [status, setStatus] = useState("draft");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-list"],
    queryFn: () => customFetch<Customer[]>("/api/customers"),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => customFetch<Product[]>("/api/products"),
  });

  const { data: existingQuote, isLoading: quoteLoading } = useQuery<QuoteFull>({
    queryKey: ["quote", id],
    queryFn: () => customFetch<QuoteFull>(`/api/quotes/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingQuote) {
      setTitle(existingQuote.title);
      setCustomerId(existingQuote.customerId);
      setNotes(existingQuote.notes ?? "");
      setTaxRate(existingQuote.taxRate);
      setStatus(existingQuote.status);
      setItems(existingQuote.items.map((i) => ({
        key: newKey(),
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })));
    }
  }, [existingQuote]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const filteredCustomers = customers.filter(
    (c) =>
      c.companyName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.contactName.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.isActive &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.category ?? "").toLowerCase().includes(productSearch.toLowerCase()))
  );

  const totals = calcTotals(items, parseFloat(taxRate) || 0);

  function addItem() {
    setItems((prev) => [...prev, emptyLine()]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );
  }

  function openProductModal(key: string) {
    setProductModalTarget(key);
    setProductSearch("");
    setShowProductModal(true);
  }

  function selectProduct(key: string, product: Product) {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? {
              ...i,
              productId: product.id,
              description: product.name + (product.description ? ` — ${product.description}` : ""),
              unitPrice: product.unitPrice,
            }
          : i
      )
    );
    setShowProductModal(false);
    setProductModalTarget(null);
  }

  const buildPayload = useCallback(() => ({
    customerId,
    title: title.trim(),
    notes: notes.trim() || undefined,
    taxRate,
    items: items
      .filter((i) => i.description.trim())
      .map((i) => ({
        productId: i.productId,
        description: i.description,
        quantity: i.quantity || "1",
        unitPrice: i.unitPrice || "0",
      })),
  }), [customerId, title, notes, taxRate, items]);

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => {
      if (isEdit) {
        return customFetch<QuoteFull>(`/api/quotes/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return customFetch<QuoteFull>("/api/quotes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      toast({ title: isEdit ? "Quote saved" : "Quote created" });
      if (!isEdit) navigate(`/quotes/${quote.id}`);
    },
    onError: () => toast({ title: "Failed to save quote", variant: "destructive" }),
  });

  const emailMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      let quoteId = id;
      if (!isEdit) {
        const created = await customFetch<QuoteFull>("/api/quotes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        quoteId = created.id;
      } else {
        await customFetch<QuoteFull>(`/api/quotes/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return customFetch<{ sent: boolean; message: string }>(`/api/quotes/${quoteId}/email`, {
        method: "POST",
        body: JSON.stringify({ toEmail: toEmail || undefined }),
      });
    },
    onSuccess: (result, _, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      if (result.sent) {
        toast({ title: "Quote emailed successfully!" });
      } else {
        toast({ title: result.message, variant: "destructive" });
      }
      setShowEmailOptions(false);
    },
    onError: () => toast({ title: "Failed to send quote", variant: "destructive" }),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return toast({ title: "Please select a customer", variant: "destructive" });
    saveMutation.mutate(buildPayload());
  }

  function handleEmail() {
    if (!customerId) return toast({ title: "Please select a customer", variant: "destructive" });
    emailMutation.mutate(buildPayload());
  }

  if (isEdit && quoteLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/quotes" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">{isEdit ? "Edit Quote" : "New Quote"}</h1>
            </div>
            {isEdit && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                status === "draft" && "bg-muted text-muted-foreground",
                status === "sent" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                status === "accepted" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                status === "declined" && "bg-destructive/10 text-destructive",
              )}>
                {status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 border border-input bg-card rounded-xl text-sm font-medium hover:bg-muted transition disabled:opacity-60"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <div className="relative">
              <button
                onClick={() => setShowEmailOptions((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
              >
                <Send className="w-4 h-4" />
                Email Quote
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showEmailOptions && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-xl shadow-lg p-4 z-50 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    The quote PDF will be sent to the address below.
                  </p>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="Leave blank to use rep's email"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEmailOptions(false)}
                      className="flex-1 px-3 py-2 rounded-lg border border-input text-sm hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEmail}
                      disabled={emailMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-60"
                    >
                      {emailMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer + Title */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Quote Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowCustomerDropdown(true); setCustomerSearch(""); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-background text-sm text-left transition",
                    !customerId ? "border-input text-muted-foreground" : "border-primary/50 text-foreground"
                  )}
                >
                  <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  {selectedCustomer ? (
                    <span className="truncate">{selectedCustomer.companyName}</span>
                  ) : (
                    <span className="text-muted-foreground">Select customer…</span>
                  )}
                </button>
                {showCustomerDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          autoFocus
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search customers…"
                          className="bg-transparent text-sm outline-none flex-1"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No customers found</p>
                      ) : filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCustomerId(c.id); setShowCustomerDropdown(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition flex items-center gap-2"
                        >
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="font-medium">{c.companyName}</div>
                            <div className="text-xs text-muted-foreground">{c.contactName}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quote Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Commercial Lighting Proposal"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Line Items
            </h2>
            <button
              type="button"
              onClick={() => openProductModal(newKey())}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Package className="w-3.5 h-3.5" />
              Add from catalog
            </button>
          </div>

          <div className="space-y-2">
            {/* Header row (desktop only) */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_110px_36px] gap-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Qty</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Unit Price</span>
              <span />
            </div>

            {items.map((item) => (
              <div key={item.key} className="grid grid-cols-[1fr_80px_110px_36px] gap-2 items-start">
                <div className="relative">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.key, "description", e.target.value)}
                    placeholder="Item description…"
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8"
                  />
                  <button
                    type="button"
                    title="Pick from catalog"
                    onClick={() => openProductModal(item.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition"
                  >
                    <Package className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
                />
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.key, "unitPrice", e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={items.length === 1}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mt-1 px-1"
            >
              <Plus className="w-4 h-4" />
              Add line item
            </button>
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 mt-2">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono w-24 text-right">${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tax rate</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-16 px-2 py-1 rounded-lg border border-input bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="font-mono w-24 text-right text-sm text-muted-foreground">${totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-8 text-base font-bold">
                <span>Total</span>
                <span className="font-mono w-24 text-right">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any terms, conditions, or notes for the customer…"
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Bottom save bar */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link
            href="/quotes"
            className="px-4 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-muted transition"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Quote
          </button>
        </div>
      </div>

      {/* Product Picker Modal */}
      {showProductModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowProductModal(false)}
        >
          <div
            className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Select Product</h2>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name, SKU, or category…"
                  className="bg-transparent text-sm outline-none flex-1"
                />
                {productSearch && (
                  <button onClick={() => setProductSearch("")}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No products found</p>
                </div>
              ) : filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (productModalTarget) selectProduct(productModalTarget, p);
                    else {
                      setItems((prev) => [...prev, emptyLine({
                        productId: p.id,
                        description: p.name + (p.description ? ` — ${p.description}` : ""),
                        unitPrice: p.unitPrice,
                      })]);
                      setShowProductModal(false);
                      setProductModalTarget(null);
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-muted transition flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.category && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{p.category}</span>
                      )}
                      {p.sku && (
                        <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold text-sm flex-shrink-0">${Number(p.unitPrice).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for dropdowns */}
      {(showCustomerDropdown || showEmailOptions) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowCustomerDropdown(false); setShowEmailOptions(false); }}
        />
      )}
    </AppLayout>
  );
}
