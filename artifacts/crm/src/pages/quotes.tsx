import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  FileText, Plus, Loader2, Building2, User,
} from "lucide-react";

interface QuoteRow {
  id: string;
  title: string;
  status: string;
  total: string;
  sentAt: string | null;
  createdAt: string;
  customerId: string;
  userId: string;
  customerCompanyName: string;
  repEmail: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  declined: "bg-destructive/10 text-destructive",
};

export default function QuotesPage() {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const { data: quotes = [], isLoading } = useQuery<QuoteRow[]>({
    queryKey: ["quotes"],
    queryFn: () => customFetch<QuoteRow[]>("/api/quotes"),
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Quotes</h1>
              <p className="text-sm text-muted-foreground">
                {quotes.length} total quote{quotes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link
            href="/quotes/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </Link>
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No quotes yet.</p>
              <p className="text-xs mt-1">
                <Link href="/quotes/new" className="text-primary underline">
                  Create your first quote
                </Link>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Customer</th>
                    {isAdmin && (
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Rep</th>
                    )}
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotes.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-medium hover:text-primary transition-colors line-clamp-1"
                        >
                          {q.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <Link
                            href={`/customers/${q.customerId}`}
                            className="hover:text-foreground transition-colors line-clamp-1"
                          >
                            {q.customerCompanyName}
                          </Link>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            {q.repEmail}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                          STATUS_STYLE[q.status] ?? "bg-muted text-muted-foreground"
                        )}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ${Number(q.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(q.createdAt).toLocaleDateString()}
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
