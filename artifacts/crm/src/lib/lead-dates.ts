/** Match the API's UTC date-only overdue boundary, without DST rounding errors. */
export function getDaysPastDue(followUpDate: string | null | undefined, now = new Date()): number {
  if (!followUpDate) return 0;
  const due = Date.parse(followUpDate);
  if (!Number.isFinite(due)) return 0;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - due) / 86_400_000));
}
