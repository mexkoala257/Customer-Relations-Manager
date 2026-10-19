import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Exercise the actual helpers and email template without a database or SMTP.
const result = await build({
  stdin: {
    contents: `
      export * from "./pipeline-summary";
      export { sendSummaryEmail } from "./mailer";
      export { snapshots, messages } from "@workspace/db";
    `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  plugins: [{
    name: "in-memory-email-services",
    setup(builder) {
      builder.onResolve({ filter: /^(@workspace\/db|drizzle-orm|nodemailer|\.\/logger)$/ },
        ({ path }) => ({ path, namespace: "test-service" }));
      builder.onLoad({ filter: /.*/, namespace: "test-service" }, ({ path }) => ({
        contents: path === "@workspace/db" ? `
          export const snapshots = new Map();
          export const messages = [];
          export const appSettingsTable = { key: "key", value: "value" };
          export const emailLogsTable = {};
          export const db = {
            select() {
              return { from() {
                return {
                  then(resolve) {
                    resolve([...snapshots].map(([key, value]) => ({ key, value })));
                  },
                  where(key) {
                    return { limit: async () => snapshots.has(key)
                      ? [{ value: snapshots.get(key) }] : [] };
                  }
                };
              }};
            },
            insert() {
              return { values(row) {
                return { onConflictDoNothing: async () => {
                  if (!snapshots.has(row.key)) snapshots.set(row.key, row.value);
                }};
              }};
            }
          };
        ` : path === "drizzle-orm" ? `
          export const eq = (_field, value) => value;
        ` : path === "nodemailer" ? `
          import { messages } from "@workspace/db";
          export default { createTransport: () => ({
            sendMail: async (message) => messages.push(message)
          }) };
        ` : `
          export const logger = { info() {}, warn() {}, error() {} };
        `,
      }));
    },
  }],
});
const { getPipelineSummary, formatPipelineSummary, sendSummaryEmail, snapshots, messages } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("single-line totals handle increases, decreases, no change, zero, and missing history", () => {
  for (const [currentTotal, previousTotal, expected] of [
    [42, 37, "Pipeline: 42 leads — up 5 from last week (37)."],
    [32, 37, "Pipeline: 32 leads — down 5 from last week (37)."],
    [37, 37, "Pipeline: 37 leads — unchanged from last week (37)."],
    [1, 0, "Pipeline: 1 lead — up 1 from last week (0)."],
    [0, 1, "Pipeline: 0 leads — down 1 from last week (1)."],
    [0, null, "Pipeline: 0 leads — last week's total not yet available."],
  ]) {
    assert.equal(formatPipelineSummary({ currentTotal, previousTotal }), expected);
  }
});

test("Monday and Friday use their own previous-week totals; previews and resends preserve history", async () => {
  snapshots.clear();
  const monday = new Date(2026, 9, 12, 8);
  const friday = new Date(2026, 9, 16, 8);
  await getPipelineSummary(37, { now: monday, recordSnapshot: true });
  await getPipelineSummary(40, { now: friday, recordSnapshot: true });
  await getPipelineSummary(999, { now: monday, recordSnapshot: true });
  assert.equal(snapshots.get("summary_pipeline_total:2026-10-12"), "37");
  assert.deepEqual(await getPipelineSummary(42, { now: new Date(2026, 9, 19, 8) }),
    { currentTotal: 42, previousTotal: 37 });
  assert.deepEqual(await getPipelineSummary(45, { now: new Date(2026, 9, 23, 8) }),
    { currentTotal: 45, previousTotal: 40 });
  assert.equal(snapshots.size, 2, "previews must not create snapshots");
  assert.equal((await getPipelineSummary(42, { now: new Date(2026, 9, 26, 8) })).previousTotal, null);
});

test("zero is valid history, invalid stored totals fail explicitly, and DST keeps the same weekday", async () => {
  snapshots.clear();
  snapshots.set("summary_pipeline_total:2026-10-26", "0");
  const opts = { now: new Date(2026, 10, 2, 8) };
  assert.equal((await getPipelineSummary(1, opts)).previousTotal, 0);
  snapshots.set("summary_pipeline_total:2026-10-26", "invalid");
  await assert.rejects(getPipelineSummary(1, opts), /Invalid saved pipeline total/);
});

test("HTML and plain-text summary emails use the compact line and preserve admin visibility", async () => {
  snapshots.clear();
  snapshots.set("smtp_host", "smtp.example.invalid");
  snapshots.set("smtp_user", "test@example.invalid");
  snapshots.set("smtp_pass", "not-a-real-password");
  const opts = {
    toEmail: "test@example.invalid",
    recipientName: "Test",
    periodLabel: "Monday Morning",
    isAdmin: true,
    sections: [{ id: "pipeline_summary", enabled: true }],
    recentLeads: [],
    upcomingLeads: [],
    pipelineSummary: { currentTotal: 42, previousTotal: 37 },
  };
  assert.equal((await sendSummaryEmail(opts)).sent, true);
  const email = messages.at(-1);
  assert.ok(email.html.includes("Pipeline: 42 leads — up 5 from last week (37)."));
  assert.ok(email.text.includes("Pipeline: 42 leads — up 5 from last week (37)."));
  assert.ok(!email.html.includes("Pipeline Overview"));
  assert.ok(!email.html.includes("<table"), "no status breakdown table");

  await sendSummaryEmail({ ...opts, isAdmin: false });
  assert.ok(!messages.at(-1).html.includes("Pipeline:"));
  await sendSummaryEmail({ ...opts, sections: [] });
  assert.ok(!messages.at(-1).html.includes("Pipeline:"));
  await sendSummaryEmail({ ...opts, pipelineSummary: { currentTotal: 0, previousTotal: 1 } });
  assert.ok(messages.at(-1).html.includes("Pipeline: 0 leads — down 1"));
});
