import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type PipelineSummary = {
  currentTotal: number;
  previousTotal: number | null;
};

// Use the scheduler's local calendar, including across daylight-saving changes.
function snapshotKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `summary_pipeline_total:${year}-${month}-${day}`;
}

export async function getPipelineSummary(
  currentTotal: number,
  { recordSnapshot = false, now = new Date() } = {},
): Promise<PipelineSummary> {
  const previousWeek = new Date(now);
  previousWeek.setDate(previousWeek.getDate() - 7);
  const [snapshot] = await db.select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, snapshotKey(previousWeek)))
    .limit(1);

  let previousTotal: number | null = null;
  if (snapshot) {
    const parsed = Number(snapshot.value);
    if (snapshot.value.trim() === "" || !Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error("Invalid saved pipeline total");
    }
    previousTotal = parsed;
  }

  if (recordSnapshot) {
    // Preserve the first summary total for a date, even if an admin resends it.
    // Previews never write snapshots.
    await db.insert(appSettingsTable).values({
      key: snapshotKey(now),
      value: String(currentTotal),
    }).onConflictDoNothing();
  }

  return { currentTotal, previousTotal };
}

export function formatPipelineSummary({ currentTotal, previousTotal }: PipelineSummary): string {
  const total = `${currentTotal} ${currentTotal === 1 ? "lead" : "leads"}`;
  if (previousTotal === null) {
    return `Pipeline: ${total} — last week's total not yet available.`;
  }
  const difference = currentTotal - previousTotal;
  const comparison = difference === 0
    ? "unchanged from last week"
    : `${difference > 0 ? "up" : "down"} ${Math.abs(difference)} from last week`;
  return `Pipeline: ${total} — ${comparison} (${previousTotal}).`;
}
