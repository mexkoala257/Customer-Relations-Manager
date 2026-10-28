import { db, appSettingsTable, usersTable } from "@workspace/db";
import type { SummaryCustomizationInput } from "@workspace/api-zod";
import { eq, like } from "drizzle-orm";

const PREFIX = "weekly_summary_recipients:";
type SummaryCustomization = SummaryCustomizationInput & { recipientId: string };

export async function listSummaryRecipients() {
  return db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.fullName,
    role: usersTable.role,
  }).from(usersTable).orderBy(usersTable.fullName, usersTable.email);
}

export async function loadSummaryCustomizations(): Promise<SummaryCustomization[]> {
  const rows = await db.select().from(appSettingsTable)
    .where(like(appSettingsTable.key, `${PREFIX}%`));
  return rows.map((row) => {
    const parsed: unknown = JSON.parse(row.value);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      throw new Error("Invalid saved summary customization");
    }
    return { recipientId: row.key.slice(PREFIX.length), coworkerIds: [...new Set(parsed)] };
  });
}

export function validateCoworkerSelection(
  recipientId: string,
  coworkerIds: string[],
  users: Awaited<ReturnType<typeof listSummaryRecipients>>,
): string | null {
  if (new Set(coworkerIds).size !== coworkerIds.length) return "A salesperson may only appear once.";
  if (coworkerIds.includes(recipientId)) return "The recipient is already included first.";
  const validSalespeople = new Set(users.filter((user) => user.role === "sales").map((user) => user.id));
  if (coworkerIds.some((id) => !validSalespeople.has(id))) return "Select only existing salespeople.";
  return null;
}

export async function saveSummaryCoworkers(recipientId: string, coworkerIds: string[]) {
  const value = JSON.stringify(coworkerIds);
  await db.insert(appSettingsTable).values({ key: `${PREFIX}${recipientId}`, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  return { recipientId, coworkerIds };
}

export async function resetSummaryCoworkers(recipientId: string) {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, `${PREFIX}${recipientId}`));
}
