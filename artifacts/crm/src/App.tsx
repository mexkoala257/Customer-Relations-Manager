import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/api";
import { AppSettingsProvider } from "@/contexts/app-settings";
import { FeatureFlagsProvider, useFeatureFlags } from "@/contexts/feature-flags";
import { BrandingEditor } from "@/components/branding-editor";
import { ForcePasswordModal } from "@/components/force-password-modal";
import { DirectMessageModal } from "@/components/DirectMessageModal";
import { useEffect, useState } from "react";

import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import LeadDetailPage from "@/pages/lead-detail";
import LeadNewPage from "@/pages/lead-new";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import CustomerNewPage from "@/pages/customer-new";
import QuickEntryPage from "@/pages/quick-entry";
import AdminUsersPage from "@/pages/admin-users";
import AdminUserEditPage from "@/pages/admin-user-edit";
import AdminRemindersPage from "@/pages/admin-reminders";
import AdminReportsPage from "@/pages/admin-reports";
import AdminReportBuilderPage from "@/pages/admin-report-builder";
import AdminBugReportsPage from "@/pages/admin-bug-reports";
import AdminEmailLogsPage from "@/pages/admin-email-logs";
import SettingsPage from "@/pages/settings";
import MyRemindersPage from "@/pages/my-reminders";
import GuidePage from "@/pages/guide";
import TeamPage from "@/pages/team";
import FollowingPage from "@/pages/following";
import NotFound from "@/pages/not-found";
import PartsPage from "@/pages/parts";
import PartsImportPage from "@/pages/parts-import";
import AdminCategoriesPage from "@/pages/admin-categories";
import AdminPartsPage from "@/pages/admin-parts";
import AdminFeatureFlagsPage from "@/pages/admin-feature-flags";
import AdminFeedEditorPage from "@/pages/admin-feed-editor";
import AdminLeadRequirementsPage from "@/pages/admin-lead-requirements";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function FlaggedRoute({ flag, component: Component, adminOnly = false, ...props }: { flag: string; component: React.ComponentType<any>; adminOnly?: boolean; [key: string]: any }) {
  const { userRole } = useAuth();
  const { isEnabled } = useFeatureFlags();
  // Superadmins bypass all flags
  if (userRole !== "superadmin" && !isEnabled(flag)) {
    return <Redirect to="/" />;
  }
  return <ProtectedRoute component={Component} adminOnly={adminOnly} {...props} />;
}

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

  if (adminOnly && userRole !== "admin" && userRole !== "superadmin") {
    return <Redirect to="/" />;
  }

  return <Component {...props} />;
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (location === "/setup") {
      setChecking(false);
      return;
    }
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: { needed: boolean }) => {
        if (data.needed) {
          navigate("/setup");
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking && location !== "/setup") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppRouter() {
  const { isAuthenticated, mustChangePassword } = useAuth();

  return (
    <SetupGuard>
      {isAuthenticated && mustChangePassword && <ForcePasswordModal />}
      {isAuthenticated && <DirectMessageModal />}
      <Switch>
        <Route path="/setup" component={SetupPage} />

        <Route path="/login">
          {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
        </Route>

        <Route path="/">
          <ProtectedRoute component={DashboardPage} />
        </Route>

        <Route path="/new">
          <FlaggedRoute flag="quick_entry" component={QuickEntryPage} />
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

        <Route path="/admin/users/:id">
          {(params) => <ProtectedRoute component={AdminUserEditPage} id={params.id} adminOnly />}
        </Route>

        <Route path="/admin/users">
          <ProtectedRoute component={AdminUsersPage} adminOnly />
        </Route>

        <Route path="/admin/reminders">
          <ProtectedRoute component={AdminRemindersPage} adminOnly />
        </Route>

        <Route path="/admin/bug-reports">
          <ProtectedRoute component={AdminBugReportsPage} adminOnly />
        </Route>

        <Route path="/admin/email-logs">
          <ProtectedRoute component={AdminEmailLogsPage} adminOnly />
        </Route>

        <Route path="/admin/feature-flags">
          <ProtectedRoute component={AdminFeatureFlagsPage} adminOnly />
        </Route>

        <Route path="/admin/feed-editor">
          <ProtectedRoute component={AdminFeedEditorPage} adminOnly />
        </Route>

        <Route path="/admin/lead-requirements">
          <ProtectedRoute component={AdminLeadRequirementsPage} adminOnly />
        </Route>

        <Route path="/admin/parts">
          <FlaggedRoute flag="parts_catalog_admin" component={AdminPartsPage} adminOnly />
        </Route>

        <Route path="/admin/categories">
          <FlaggedRoute flag="parts_catalog_admin" component={AdminCategoriesPage} adminOnly />
        </Route>

        <Route path="/admin/reports">
          <FlaggedRoute flag="reports" component={AdminReportsPage} adminOnly />
        </Route>

        <Route path="/admin/report-builder">
          <FlaggedRoute flag="reports" component={AdminReportBuilderPage} adminOnly />
        </Route>

        <Route path="/parts/import">
          <FlaggedRoute flag="parts_import" component={PartsImportPage} adminOnly />
        </Route>

        <Route path="/parts">
          <FlaggedRoute flag="price_lookup" component={PartsPage} />
        </Route>

        <Route path="/following">
          <FlaggedRoute flag="following" component={FollowingPage} />
        </Route>

        <Route path="/settings">
          <ProtectedRoute component={SettingsPage} />
        </Route>

        <Route path="/reminders">
          <FlaggedRoute flag="reminders" component={MyRemindersPage} />
        </Route>

        <Route path="/team">
          <FlaggedRoute flag="team_portal" component={TeamPage} />
        </Route>

        <Route path="/guide">
          <FlaggedRoute flag="user_guide" component={GuidePage} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </SetupGuard>
  );
}

function AppWithFlags() {
  const { isAuthenticated } = useAuth();
  return (
    <FeatureFlagsProvider isAuthenticated={isAuthenticated}>
      <AppRouter />
      <BrandingEditor />
    </FeatureFlagsProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppSettingsProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <AppWithFlags />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </AppSettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
