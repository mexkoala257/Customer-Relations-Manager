import { Link } from "wouter";
import {
  useGetCustomer,
  useSendFollowupEmail,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeft, MapPin, Mail, Loader2, Phone, Building2, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  Contacted: "bg-purple-100 text-purple-800",
  Qualified: "bg-amber-100 text-amber-800",
  Proposal: "bg-indigo-100 text-indigo-800",
  Won: "bg-green-100 text-green-800",
  Lost: "bg-red-100 text-red-800",
};

export default function CustomerDetailPage({ id }: { id: string }) {
  const { toast } = useToast();

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
          {mapsUrl && (
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
        </div>

        {/* Customer Info Card */}
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Contact Information
          </h2>
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
          </div>
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
              {leads.map((lead: any, idx: number) => (
                <div
                  key={lead.id}
                  className="relative pl-5 border-l-2 border-border last:border-transparent"
                  data-testid={`history-lead-${lead.id}`}
                >
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-semibold",
                            STATUS_LABELS[lead.status] ?? "bg-gray-100 text-gray-700"
                          )}
                        >
                          {lead.status}
                        </span>
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
                      {lead.notes && (
                        <p className="text-sm mt-1.5 text-foreground/80 leading-relaxed">
                          {lead.notes}
                        </p>
                      )}
                      {lead.followUpDate && (
                        <div className="text-xs text-accent font-medium mt-1">
                          Follow-up: {new Date(lead.followUpDate + "T00:00:00").toLocaleDateString()}
                        </div>
                      )}
                    </div>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
