import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useCreateCustomer,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";

export default function CustomerNewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const createMutation = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: "Customer created successfully" });
        navigate("/customers");
      },
      onError: () => {
        toast({ title: "Failed to create customer", variant: "destructive" });
      },
    },
  });

  function handleChange(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ data: form });
  }

  const fields = [
    { key: "companyName", label: "Company Name", required: true, placeholder: "Acme Corp" },
    { key: "contactName", label: "Contact Name", required: true, placeholder: "Jane Smith" },
    { key: "phone", label: "Phone", placeholder: "555-000-1234" },
    { key: "streetAddress", label: "Street Address", placeholder: "123 Main St" },
    { key: "city", label: "City", placeholder: "Austin" },
    { key: "state", label: "State", placeholder: "TX" },
    { key: "zipCode", label: "ZIP Code", placeholder: "78701" },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/customers" className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold" data-testid="new-customer-title">New Customer</h1>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.key === "streetAddress" ? "sm:col-span-2" : ""}
                >
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    value={form[field.key as keyof typeof form]}
                    onChange={handleChange(field.key)}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid={`customer-${field.key}`}
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              data-testid="submit-new-customer"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Create Customer
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
