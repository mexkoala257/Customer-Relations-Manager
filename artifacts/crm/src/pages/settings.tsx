import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { User, Shield, Hash } from "lucide-react";

export default function SettingsPage() {
  const { userEmail, userRole, staffId } = useAuth();

  const fields = [
    { label: "Email", value: userEmail, icon: User },
    { label: "Role", value: userRole, icon: Shield },
    { label: "Staff ID", value: staffId?.toString(), icon: Hash },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="settings-title">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your account information</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-accent-foreground">
                {userEmail?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-semibold">{userEmail}</div>
              <div className="text-sm text-muted-foreground capitalize">{userRole} account</div>
            </div>
          </div>

          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <field.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{field.label}</div>
                  <div className="font-medium text-sm">{field.value ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
