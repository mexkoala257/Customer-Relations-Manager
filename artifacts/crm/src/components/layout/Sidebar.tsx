import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/contexts/app-settings";
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Settings,
  ChevronRight,
  TrendingUp,
  Zap,
  Bell,
  BellRing,
  FileText,
  MessageSquare,
  SlidersHorizontal,
  BookOpen,
  Bug,
  Mail,
  BarChart2,
} from "lucide-react";
import { BugReportModal } from "@/components/BugReportModal";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "My Leads", icon: TrendingUp, href: "/leads" },
  { label: "Customers", icon: Building2, href: "/customers" },
  { label: "Following", icon: BellRing, href: "/following" },
  { label: "Messages", icon: MessageSquare, href: "/team" },
  { label: "Reminders", icon: Bell, href: "/reminders" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "User Guide", icon: BookOpen, href: "/guide" },
];

const adminItems = [
  { label: "Manage Users", icon: Users, href: "/admin/users" },
  { label: "Reminders", icon: Bell, href: "/admin/reminders" },
  { label: "Reports", icon: FileText, href: "/admin/reports" },
  { label: "Report Builder", icon: BarChart2, href: "/admin/report-builder" },
  { label: "Bug Reports", icon: Bug, href: "/admin/bug-reports" },
  { label: "Email Log", icon: Mail, href: "/admin/email-logs" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { userEmail, userRole, staffId, logout } = useAuth();
  const { settings } = useAppSettings();
  const [showBugReport, setShowBugReport] = useState(false);

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground w-64">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <TrendingUp className="w-4 h-4 text-accent-foreground" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide">{settings.companyName}</div>
            <div className="text-xs text-sidebar-foreground/50">
              {userRole === "admin" ? "Administrator" : "Sales Portal"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Quick Entry CTA */}
        <Link
          href="/new"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all mb-3",
            isActive("/new")
              ? "bg-accent text-accent-foreground"
              : "bg-accent/20 text-accent hover:bg-accent hover:text-accent-foreground border border-accent/30"
          )}
          data-testid="nav-quick-entry"
        >
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>Quick Entry</span>
        </Link>

        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              data-testid={`nav-admin-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          );
        })}

        {(userRole === "admin" || userRole === "superadmin") && (
          <>
            <div className="pt-3 pb-1 px-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Admin
              </div>
            </div>
            {adminItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  data-testid={`nav-admin-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {userRole === "superadmin" && (
              <Link
                href="/setup"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive("/setup")
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                data-testid="nav-system-config"
              >
                <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
                <span>System Config</span>
              </Link>
            )}
          </>
        )}
      </nav>

      {/* User Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-foreground">
              {userEmail?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {userEmail}
            </div>
            <div className="text-xs text-sidebar-foreground/50">
              Staff #{staffId} · {userRole}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setShowBugReport(true); onClose?.(); }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all mb-1"
          data-testid="report-bug-button"
        >
          <Bug className="w-4 h-4" />
          <span>Report a Bug</span>
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>

      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
    </div>
  );
}
