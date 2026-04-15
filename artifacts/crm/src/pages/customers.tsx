import { useState } from "react";
import { Link } from "wouter";
import {
  useListCustomers,
  useDeleteCustomer,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Search, Trash2, Eye, Loader2, MapPin, Phone } from "lucide-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const params = search ? { search } : {};
  const { data: customers, isLoading } = useListCustomers(params, {
    query: { queryKey: getListCustomersQueryKey(params) },
  });

  const deleteMutation = useDeleteCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey(params) });
        toast({ title: "Customer deleted" });
      },
    },
  });

  function handleDelete(id: string, name: string) {
    if (confirm(`Delete ${name}? All associated leads will also be removed.`)) {
      deleteMutation.mutate({ id });
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="customers-title">
              Customers
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customers?.length ?? 0} total customers
            </p>
          </div>
          <Link
            href="/customers/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
            data-testid="create-customer-button"
          >
            <PlusCircle className="w-4 h-4" />
            Add Customer
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, or city..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="customer-search"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (customers ?? []).length === 0 ? (
          <div className="text-center py-16 bg-card border border-card-border rounded-xl">
            <div className="text-muted-foreground text-sm">
              {search ? "No customers match your search." : "No customers yet."}
            </div>
            {!search && (
              <Link href="/customers/new" className="mt-3 inline-block text-sm text-primary font-medium hover:underline">
                Add your first customer
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(customers ?? []).map((customer) => {
              const mapsUrl =
                customer.streetAddress && customer.city
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${customer.streetAddress} ${customer.city}`
                    )}`
                  : null;
              return (
                <div
                  key={customer.id}
                  className="bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow"
                  data-testid={`customer-card-${customer.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{customer.companyName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{customer.contactName}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {(customer.city || customer.state) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{[customer.city, customer.state].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground text-sm font-medium transition"
                      data-testid={`view-customer-${customer.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Profile
                    </Link>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-primary/10 text-primary transition"
                        title="Navigate"
                        data-testid={`navigate-customer-${customer.id}`}
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(customer.id, customer.companyName)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition"
                      data-testid={`delete-customer-${customer.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
