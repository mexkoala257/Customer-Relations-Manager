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
      export { renderSummaryEmail } from "./mailer";
      export { buildRecipientSummaryOptions } from "./summary-recipient";
      export { validateCoworkerSelection } from "./summary-customizations";
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
          export const usersTable = {};
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
          export const like = (_field, value) => value;
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
const {
  getPipelineSummary, formatPipelineSummary, sendSummaryEmail, renderSummaryEmail,
  buildRecipientSummaryOptions, validateCoworkerSelection, snapshots, messages,
} =
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

test("company-wide weekly entry counts and goals appear first for every recipient, including zero entries", async () => {
  const opts = {
    toEmail: "test@example.invalid",
    recipientName: "Test",
    periodLabel: "Friday Morning",
    isAdmin: true,
    sections: [
      { id: "pipeline_summary", enabled: true },
      { id: "recent_activity", enabled: true, daysBack: 30 },
    ],
    recentLeads: [],
    upcomingLeads: [],
    pipelineSummary: { currentTotal: 42, previousTotal: 37 },
    weeklyLeadCounts: [
      { repName: "Example Rep A", repEmail: "rep-a@example.invalid", count: 8, weeklyGoal: 20 },
      { repName: "Example <Rep> & B", repEmail: "rep-b@example.invalid", count: 0, weeklyGoal: 10 },
      { repName: null, repEmail: "rep-c@example.invalid", count: 1, weeklyGoal: null },
      { repName: "Over Goal", repEmail: "over@example.invalid", count: 12, weeklyGoal: 10 },
      { repName: "Zero Goal", repEmail: "zero@example.invalid", count: 3, weeklyGoal: 0 },
    ],
  };
  await sendSummaryEmail(opts);
  const email = messages.at(-1);
  const title = "New Leads Entered — Last 7 Days";
  assert.ok(email.html.indexOf(title) < email.html.indexOf("Pipeline:"));
  assert.ok(email.text.indexOf(title) < email.text.indexOf("Pipeline:"));
  assert.ok(email.html.indexOf(title) < email.html.indexOf("Recent Activity"));
  assert.ok(email.html.includes("Example &lt;Rep&gt; &amp; B"));
  assert.ok(!email.html.includes("Example <Rep> & B"));
  assert.ok(email.text.includes("Example Rep A: 8 leads"));
  assert.ok(email.text.includes("Example <Rep> & B: 0 leads"));
  assert.ok(email.text.includes("rep-c: 1 lead"));
  assert.ok(email.text.includes("Example Rep A: 8 leads | Weekly goal: 20 | Progress: 40%"));
  assert.ok(email.text.includes("Example <Rep> & B: 0 leads | Weekly goal: 10 | Progress: 0%"));
  assert.ok(email.text.includes("rep-c: 1 lead | Weekly goal: Goal not set | Progress: —"));
  assert.ok(email.text.includes("Over Goal: 12 leads | Weekly goal: 10 | Progress: 120%"));
  assert.ok(email.text.includes("Zero Goal: 3 leads | Weekly goal: 0 | Progress: —"));
  assert.ok(email.html.includes("Weekly Goal") && email.html.includes("40%"));
  assert.ok(!/NaN|Infinity/.test(email.html + email.text));
  assert.ok(email.text.includes("Recent Activity (last 30 days)"));

  await sendSummaryEmail({ ...opts, isAdmin: false });
  assert.ok(messages.at(-1).html.includes(title));
  assert.ok(messages.at(-1).text.includes("Example Rep A"));
  assert.ok(!messages.at(-1).html.includes("Pipeline:"));
  await sendSummaryEmail({ ...opts, sections: [] });
  assert.ok(messages.at(-1).html.includes(title));
  await sendSummaryEmail({ ...opts, weeklyLeadCounts: [] });
  assert.ok(messages.at(-1).html.includes("No salespeople configured."));
});

const users = [
  { id: "a", email: "a@example.invalid", name: "Recipient A", role: "sales" },
  { id: "b", email: "b@example.invalid", name: "Zed Coworker", role: "sales" },
  { id: "c", email: "c@example.invalid", name: "Alpha Coworker", role: "sales" },
  { id: "d", email: "d@example.invalid", name: "Unselected Rep", role: "sales" },
  { id: "admin", email: "admin@example.invalid", name: "Admin", role: "admin" },
  { id: "entry", email: "entry@example.invalid", name: "Data Entry", role: "data-entry" },
];
const personalSections = [
  { id: "pipeline_summary", enabled: true },
  { id: "recent_activity", enabled: true, daysBack: 7 },
  { id: "upcoming_followups", enabled: true, daysAhead: 7 },
  { id: "overdue_leads", enabled: true },
  { id: "won_leads", enabled: true },
];
const fixtureData = {
  allUsers: users,
  recentLeads: [users[0], users[1], users[3]].map((user) => ({
    companyName: `${user.id} Company`,
    contactName: "Test Contact",
    status: "New",
    repEmail: user.email,
    updatedAt: "2026-10-19",
    notes: `Note for ${user.id} <script>unsafe</script>`,
  })),
  upcomingLeads: [{
    companyName: "Upcoming Company", contactName: "Contact", followUpDate: "2026-10-20",
    status: "Discovery", repEmail: users[1].email, notes: "Upcoming note",
  }],
  overdueLeads: [],
  wonLeads: [{
    companyName: "Won Company", contactName: "Contact", updatedAt: "2026-10-19",
    status: "Close Win", repEmail: users[1].email, notes: "Won note",
  }],
  pipelineSummary: { currentTotal: 42, previousTotal: 37 },
  weeklyLeadCounts: [
    { repName: "Recipient A", repEmail: users[0].email, count: 2, weeklyGoal: 5 },
    { repName: "Unselected Rep", repEmail: users[3].email, count: 0, weeklyGoal: 10 },
  ],
  topPerformers: [],
};

test("recipient first, custom order, complete rep blocks, notes and no-activity messages", async () => {
  const opts = buildRecipientSummaryOptions(fixtureData, users[0], personalSections, "Monday Morning", ["b", "c"]);
  assert.deepEqual(opts.salespersonBlocks.map((block) => block.salespersonId), ["a", "b", "c"]);
  const sentCount = messages.length;
  const email = await renderSummaryEmail(opts);
  assert.equal(messages.length, sentCount, "preview must not send an email");
  const own = email.html.indexOf("Recipient A — Your Leads");
  const second = email.html.indexOf("Zed Coworker");
  const third = email.html.indexOf("Alpha Coworker");
  assert.ok(own >= 0 && own < second && second < third);
  assert.ok(email.html.indexOf("Won Company") > second && email.html.indexOf("Won Company") < third);
  assert.ok(email.text.includes("Upcoming note"));
  assert.ok(email.text.includes("Won note"));
  assert.ok(email.html.includes("No activity in the enabled report sections"));
  assert.ok(email.html.includes("Unselected Rep") && !email.text.includes("d Company"));
  assert.ok(!email.html.includes("Pipeline:") && email.text.includes("New Leads Entered"));
  assert.equal(email.html.split("New Leads Entered — Last 7 Days").length - 1, 1);
  assert.ok(email.html.indexOf("New Leads Entered") < email.html.indexOf("Recipient A — Your Leads"));
  assert.ok(email.html.includes("&lt;script&gt;unsafe&lt;/script&gt;"));
  assert.ok(!email.html.includes("<script>"));
});

test("defaults retain own-only for reps and team-wide admin reports; configured admins get ordered blocks", async () => {
  const rep = buildRecipientSummaryOptions(fixtureData, users[0], personalSections, "Friday Morning");
  assert.deepEqual(rep.salespersonBlocks.map((block) => block.salespersonId), ["a"]);
  assert.deepEqual(rep.recentLeads.map((lead) => lead.repEmail), [users[0].email]);
  const admin = buildRecipientSummaryOptions(fixtureData, users[4], personalSections, "Friday Morning");
  assert.equal(admin.salespersonBlocks, undefined);
  assert.equal(admin.recentLeads.length, fixtureData.recentLeads.length);
  const configuredAdmin = buildRecipientSummaryOptions(fixtureData, users[4], personalSections, "Friday Morning", ["b", "a"]);
  const email = await renderSummaryEmail(configuredAdmin);
  assert.equal(email.html.split("Pipeline:").length - 1, 1);
  assert.equal(email.html.split("New Leads Entered — Last 7 Days").length - 1, 1);
  assert.deepEqual(configuredAdmin.salespersonBlocks.map((block) => block.salespersonId), ["admin", "b", "a"]);
});

test("duplicates, deleted reps, own repeats and non-sales coworkers cannot expand visibility", () => {
  const opts = buildRecipientSummaryOptions(
    fixtureData, users[0], personalSections, "Preview", ["b", "a", "missing", "b", "entry", "admin"],
  );
  assert.deepEqual(opts.salespersonBlocks.map((block) => block.salespersonId), ["a", "b"]);
  assert.equal(validateCoworkerSelection("a", ["b", "c"], users), null);
  assert.equal(validateCoworkerSelection("a", [], users), null);
  for (const invalid of [["b", "b"], ["a"], ["missing"], ["entry"], ["admin"]]) {
    assert.ok(validateCoworkerSelection("a", invalid, users));
  }
});

test("disabled sections cannot leak activity into blocks or hide an empty salesperson", async () => {
  const sections = [{ id: "recent_activity", enabled: false }];
  const email = await renderSummaryEmail(
    buildRecipientSummaryOptions(fixtureData, users[0], sections, "Preview", ["b"]),
  );
  assert.ok(email.html.includes("Recipient A — Your Leads"));
  assert.ok(email.html.includes("Zed Coworker"));
  assert.ok(email.html.includes("No activity in the enabled report sections"));
  assert.ok(!email.html.includes("a Company"));
  assert.ok(!email.html.includes("Upcoming Company"));
});
