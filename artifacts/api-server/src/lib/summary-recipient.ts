import type { ReportSection } from "@workspace/db";
import type { SummaryEmailOptions, SalespersonSummaryBlock } from "./mailer";

type Recipient = { id: string; email: string; name: string | null; role: string };
type ReportData = Pick<SummaryEmailOptions,
  "recentLeads" | "upcomingLeads" | "overdueLeads" | "wonLeads" |
  "pipelineSummary" | "weeklyLeadCounts" | "topPerformers"> & {
  allUsers: Recipient[];
};

// The same recipient scoping is used by scheduled sends, manual sends, and previews.
export function buildRecipientSummaryOptions(
  data: ReportData,
  recipient: Recipient,
  sections: ReportSection[],
  periodLabel: string,
  coworkerIds?: string[],
): SummaryEmailOptions {
  const isAdmin = recipient.role === "admin" || recipient.role === "superadmin";
  const useBlocks = !isAdmin || coworkerIds !== undefined;
  const orderedIds = [...new Set([recipient.id, ...(coworkerIds ?? [])])];
  const orderedUsers = orderedIds.flatMap((id) => {
    const user = data.allUsers.find((candidate) => candidate.id === id);
    // Deleted users and former salespeople cannot silently gain shared visibility.
    return user && (id === recipient.id || user.role === "sales") ? [user] : [];
  });
  const visibleEmails = new Set(orderedUsers.map((user) => user.email));
  const filterVisible = <T extends { repEmail: string }>(items: T[]): T[] =>
    useBlocks ? items.filter((item) => visibleEmails.has(item.repEmail)) : items;

  const salespersonBlocks: SalespersonSummaryBlock[] | undefined = useBlocks
    ? orderedUsers.map((user) => ({
        salespersonId: user.id,
        name: user.name?.trim() || user.email.split("@")[0],
        isRecipient: user.id === recipient.id,
        recentLeads: data.recentLeads.filter((lead) => lead.repEmail === user.email),
        upcomingLeads: data.upcomingLeads.filter((lead) => lead.repEmail === user.email),
        overdueLeads: (data.overdueLeads ?? []).filter((lead) => lead.repEmail === user.email),
        wonLeads: (data.wonLeads ?? []).filter((lead) => lead.repEmail === user.email),
      }))
    : undefined;

  return {
    toEmail: recipient.email,
    recipientName: recipient.name?.trim() || recipient.email.split("@")[0],
    periodLabel,
    isAdmin,
    sections,
    salespersonBlocks,
    recentLeads: filterVisible(data.recentLeads),
    upcomingLeads: filterVisible(data.upcomingLeads),
    overdueLeads: filterVisible(data.overdueLeads ?? []),
    wonLeads: filterVisible(data.wonLeads ?? []),
    pipelineSummary: isAdmin ? data.pipelineSummary : undefined,
    // Aggregate entry counts/goals are company-wide; detailed lead blocks stay scoped.
    weeklyLeadCounts: data.weeklyLeadCounts,
    topPerformers: isAdmin ? data.topPerformers : undefined,
  };
}
