import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({
  stdin: {
    contents: `
      export { ListLeadsQueryParams } from "@workspace/api-zod";
      export { getDaysPastDue } from "../../../crm/src/lib/lead-dates";
    `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { ListLeadsQueryParams, getDaysPastDue } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

test("past-due filter survives API validation, including alongside rep and status filters", () => {
  assert.deepEqual(ListLeadsQueryParams.parse({ pastDue: "true" }), { pastDue: "true" });
  assert.deepEqual(
    ListLeadsQueryParams.parse({ pastDue: "true", userId: "rep-1", status: "Proposal" }),
    { pastDue: "true", userId: "rep-1", status: "Proposal" },
  );
  assert.equal(ListLeadsQueryParams.parse({}).pastDue, undefined);
  assert.equal(ListLeadsQueryParams.parse({ pastDue: "false" }).pastDue, "false");
});

test("rescheduling overdue leads to today or the future never produces negative overdue days", () => {
  const now = new Date("2026-10-28T15:30:00Z");
  assert.equal(getDaysPastDue("2026-10-23", now), 5);
  assert.equal(getDaysPastDue("2026-10-28", now), 0);
  assert.equal(getDaysPastDue("2026-11-04", now), 0);
  assert.equal(getDaysPastDue(null, now), 0);
  assert.equal(getDaysPastDue(undefined, now), 0);
  assert.equal(getDaysPastDue("invalid", now), 0);
});

test("overdue days match the API's calendar date across DST and timezone offsets", () => {
  assert.equal(getDaysPastDue("2026-03-08", new Date("2026-03-09T00:00:00-05:00")), 1);
  assert.equal(getDaysPastDue("2026-11-01", new Date("2026-11-02T00:00:00-06:00")), 1);
  assert.equal(getDaysPastDue("2026-10-27", new Date("2026-10-28T00:05:00Z")), 1);
});
