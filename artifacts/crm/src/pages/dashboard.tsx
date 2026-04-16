import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetStatusBreakdown,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Users,
  Calendar,
  Building2,
  CheckCircle,
  PlusCircle,
  MapPin,
  ArrowRight,
  Target,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import { STATUS_COLORS, STATUS_BADGE } from "@/lib/lead-status";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-5 border",
        accent
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-card border-card-border"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", accent ? "text-accent-foreground/70" : "text-muted-foreground")}>
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accent ? "bg-accent-foreground/10" : "bg-muted")}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">
        {value ?? "—"}
      </div>
    </div>
  );
}

function WeeklyGoalCard({
  leadsThisWeek,
  weeklyLeadGoal,
}: {
  leadsThisWeek: number | undefined;
  weeklyLeadGoal: number | null | undefined;
}) {
  const count = leadsThisWeek ?? 0;
  const goal = weeklyLeadGoal ?? null;
  const hasGoal = goal !== null && goal > 0;
  const pct = hasGoal ? Math.min(100, Math.round((count / goal!) * 100)) : null;
  const met = hasGoal && count >= goal!;

  return (
    <div className={cn(
      "rounded-xl p-5 border col-span-2 lg:col-span-1",
      met ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : "bg-card border-card-border"
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          met ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
        )}>
          Leads This Week
        </span>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          met ? "bg-emerald-100 dark:bg-emerald-900" : "bg-muted"
        )}>
          <Target className={cn("w-4 h-4", met ? "text-emerald-600 dark:text-emerald-400" : "")} />
        </div>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className={cn(
          "text-3xl font-bold tracking-tight",
          met && "text-emerald-700 dark:text-emerald-400"
        )}>
          {count}
        </span>
        {hasGoal && (
          <span className="text-sm text-muted-foreground mb-1">/ {goal} goal</span>
        )}
      </div>

      {hasGoal && (
        <>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                met ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={cn(
            "text-xs mt-1.5",
            met ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
          )}>
            {met ? "Goal reached!" : `${pct}% — ${goal! - count} more to reach goal`}
          </p>
        </>
      )}

      {!hasGoal && (
        <p className="text-xs text-muted-foreground">No weekly goal set</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { userEmail, userRole } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: breakdown } = useGetStatusBreakdown();

  const chartData = (breakdown ?? []).map((item) => ({
    name: item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] ?? "#888",
  }));

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="dashboard-title">
              {(userRole === "admin" || userRole === "superadmin") ? "Overview" : "My Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Welcome back, {userEmail?.split("@")[0]}
            </p>
          </div>
          <Link
            href="/leads/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
            data-testid="new-lead-button"
          >
            <PlusCircle className="w-4 h-4" />
            New Lead
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="My Leads" value={summary?.myLeads} icon={TrendingUp} />
          <StatCard label="Follow-ups Today" value={summary?.followUpsToday} icon={Calendar} accent />
          <StatCard label="Total Customers" value={summary?.totalCustomers} icon={Building2} />
          <StatCard label="Total Leads" value={summary?.totalLeads} icon={Users} />
          <StatCard label="Close Win" value={summary?.wonLeads} icon={CheckCircle} />
          <WeeklyGoalCard
            leadsThisWeek={summary?.leadsThisWeek}
            weeklyLeadGoal={summary?.weeklyLeadGoal}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Breakdown Chart */}
          {chartData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Pipeline Breakdown
              </h2>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} leads`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {chartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Activity
              </h2>
              <Link href="/leads" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (activity ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No activity yet. Create your first lead.
              </div>
            ) : (
              <div className="space-y-3">
                {(activity ?? []).slice(0, 6).map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition group"
                    data-testid={`activity-lead-${lead.id}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {lead.customer?.companyName}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                            STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-700"
                          )}
                        >
                          {lead.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {lead.notes || "No notes"}
                      </div>
                    </div>
                    {lead.customer?.streetAddress && lead.customer?.city && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${lead.customer.streetAddress} ${lead.customer.city}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-background transition opacity-0 group-hover:opacity-100"
                        title="Navigate"
                        data-testid={`navigate-${lead.id}`}
                      >
                        <MapPin className="w-4 h-4 text-primary" />
                      </a>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
