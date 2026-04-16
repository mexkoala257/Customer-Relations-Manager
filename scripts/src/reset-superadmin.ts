/**
 * Superadmin Password Reset — Emergency Recovery Script
 *
 * Run from the project root when you cannot log in as superadmin:
 *
 *   pnpm --filter @workspace/scripts run reset-superadmin
 *
 * Requires SSH / terminal access to the server. Never exposed over the web.
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Load .env if present (Node.js 20.12+). Silently skips if file doesn't exist.
try {
  process.loadEnvFile(".env");
} catch {
  // Environment variables are already set by the system (production norm)
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Sales CRM — Superadmin Password Reset  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Find the superadmin account
  const [superadmin] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.role, "superadmin"));

  if (!superadmin) {
    console.error("✗  No superadmin account found in the database.");
    console.error("   Run the Setup Wizard to create one first.");
    process.exit(1);
  }

  console.log(`  Account : ${superadmin.email}`);
  console.log(`  ID      : ${superadmin.id}\n`);

  const rl = readline.createInterface({ input, output });

  let newPassword: string;
  let confirm: string;

  try {
    // Get new password (won't echo — uses terminal raw mode)
    newPassword = await rl.question("  New password      : ");
    if (newPassword.length < 8) {
      console.error("\n✗  Password must be at least 8 characters.");
      rl.close();
      process.exit(1);
    }

    confirm = await rl.question("  Confirm password  : ");
    if (newPassword !== confirm) {
      console.error("\n✗  Passwords do not match.");
      rl.close();
      process.exit(1);
    }
  } finally {
    rl.close();
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, superadmin.id));

  console.log(`\n✓  Password updated for ${superadmin.email}`);
  console.log("   You can now log in with the new password.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗  Unexpected error:", err.message ?? err);
  process.exit(1);
});
