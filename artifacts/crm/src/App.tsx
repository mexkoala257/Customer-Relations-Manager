import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/api";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import LeadDetailPage from "@/pages/lead-detail";
import LeadNewPage from "@/pages/lead-new";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import CustomerNewPage from "@/pages/customer-new";
import QuickEntryPage from "@/pages/quick-entry";
import AdminUsersPage from "@/pages/admin-users";
import AdminRemindersPage from "@/pages/admin-reminders";
import AdminReportsPage from "@/pages/admin-reports";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false, ...props }: { component: React.ComponentType<any>; adminOnly?: boolean; [key: string]: any }) {
  const { isAuthenticated, isLoading, userRole } = useAuth();
  const token = getToken();

  if (!token) {
    return <Redirect to="/login" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && userRole !== "admin") {
    return <Redirect to="/" />;
  }

  return <Component {...props} />;
}

function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>

      <Route path="/new">
        <ProtectedRoute component={QuickEntryPage} />
      </Route>

      <Route path="/leads/new">
        <ProtectedRoute component={LeadNewPage} />
      </Route>

      <Route path="/leads/:id">
        {(params) => <ProtectedRoute component={LeadDetailPage} id={params.id} />}
      </Route>

      <Route path="/leads">
        <ProtectedRoute component={LeadsPage} />
      </Route>

      <Route path="/customers/new">
        <ProtectedRoute component={CustomerNewPage} />
      </Route>

      <Route path="/customers/:id">
        {(params) => <ProtectedRoute component={CustomerDetailPage} id={params.id} />}
      </Route>

      <Route path="/customers">
        <ProtectedRoute component={CustomersPage} />
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsersPage} adminOnly />
      </Route>

      <Route path="/admin/reminders">
        <ProtectedRoute component={AdminRemindersPage} adminOnly />
      </Route>

      <Route path="/admin/reports">
        <ProtectedRoute component={AdminReportsPage} adminOnly />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
