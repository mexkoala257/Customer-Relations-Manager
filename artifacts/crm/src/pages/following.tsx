import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/lib/api";
import { STATUS_BADGE } from "@/lib/lead-status";
import { Bell, BellOff, Building2, TrendingUp, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: number;
  entityType: "lead" | "customer";
  entityId: string;
  createdAt: string;
  companyName: string;
  contactName: string | null;
  leadStatus: string | null;
}

async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

export default function FollowingPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowing, setUnfollowing] = useState<Set<number>>(new Set());

  const leads = items.filter((i) => i.entityType === "lead");
  const customers = items.filter((i) => i.entityType === "customer");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/watchers/me");
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unfollow(item: Subscription) {
    setUnfollowing((prev) => new Set(prev).add(item.id));
    try {
      const r = await apiFetch(`/api/watchers/${item.entityType}/${item.entityId}/toggle`, { method: "POST" });
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        toast({ title: "Unfollowed", description: `You will no longer receive updates for ${item.companyName}.` });
      }
    } finally {
      setUnfollowing((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Following</h1>
            <p className="text-sm text-muted-foreground">Records you're subscribed to — you get an email when they change.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BellOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Not following anything yet</p>
            <p className="text-sm mt-1">Open a lead or customer and click <strong>Follow</strong> to get update emails.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Leads section */}
            {leads.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Leads ({leads.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {leads.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-card border border-card-border rounded-xl px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.companyName}</span>
                          {item.leadStatus && (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGE[item.leadStatus] ?? "bg-muted text-muted-foreground")}>
                              {item.leadStatus}
                            </span>
                          )}
                        </div>
                        {item.contactName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.contactName}</p>
                        )}
                      </div>
                      <Link
                        href={`/leads/${item.entityId}`}
                        className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground flex-shrink-0"
                        title="Open lead"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => unfollow(item)}
                        disabled={unfollowing.has(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-red-500/10 hover:text-red-500 transition flex-shrink-0"
                        title="Unfollow"
                        data-testid={`unfollow-lead-${item.entityId}`}
                      >
                        {unfollowing.has(item.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Customers section */}
            {customers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Customers ({customers.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {customers.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-card border border-card-border rounded-xl px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.companyName}</p>
                        {item.contactName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.contactName}</p>
                        )}
                      </div>
                      <Link
                        href={`/customers/${item.entityId}`}
                        className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground flex-shrink-0"
                        title="Open customer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => unfollow(item)}
                        disabled={unfollowing.has(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-red-500/10 hover:text-red-500 transition flex-shrink-0"
                        title="Unfollow"
                        data-testid={`unfollow-customer-${item.entityId}`}
                      >
                        {unfollowing.has(item.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
