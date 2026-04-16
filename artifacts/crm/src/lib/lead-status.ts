export const LEAD_STATUSES = [
  "New",
  "Qualify",
  "Discovery",
  "Proposal",
  "Negotiate",
  "Close Loss",
  "Close Win",
  "Maintain",
  "Grow",
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number];

export const STATUS_COLORS: Record<string, string> = {
  New:         "#3b82f6",
  Qualify:     "#7c3aed",
  Discovery:   "#f59e0b",
  Proposal:    "#6366f1",
  Negotiate:   "#f97316",
  "Close Loss":"#ef4444",
  "Close Win": "#10b981",
  Maintain:    "#14b8a6",
  Grow:        "#059669",
};

export const STATUS_BADGE: Record<string, string> = {
  New:          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Qualify:      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  Discovery:    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Proposal:     "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  Negotiate:    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "Close Loss": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "Close Win":  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Maintain:     "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  Grow:         "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};
