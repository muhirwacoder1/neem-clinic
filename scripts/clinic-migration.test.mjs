import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema.ts";
import { api } from "../convex/_generated/api.ts";

const modules = Object.fromEntries(
  ["appointments", "billing", "catalog", "emailDelivery", "staff", "_generated/api"].map((name) => [
    `./convex/${name}.ts`,
    () => import(`../convex/${name}.ts`),
  ]),
);
const secret = "local-test-secret";
const stamp = "2026-11-16T09:00:00.000Z";
const service = (id, bookable) => ({
  id,
  name: id,
  bookable,
  active: true,
  description: "",
  sort: 1,
  show_on_home: false,
  details: "",
  image_url: "",
  created_at: stamp,
  updated_at: stamp,
});
const staffIdentity = (subject, verified = true) => ({
  subject,
  email: `${subject}@example.test`,
  emailVerified: verified,
});
const seeded = async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const slug of ["reception", "physiotherapy", "orthotics"])
      await ctx.db.insert("services", service(slug, slug !== "reception"));
    for (const [id, role, assigned] of [
      ["admin", "super_admin", null],
      ["desk", "checkin", null],
      ["physio", "provider", "physiotherapy"],
      ["ortho", "provider", "orthotics"],
    ]) {
      await ctx.db.insert("profiles", {
        id,
        email: `${id}@example.test`,
        full_name: id,
        service: assigned,
        created_at: stamp,
        clerkSubject: id,
      });
      await ctx.db.insert("user_roles", { id, user_id: id, role });
    }
    await ctx.db.insert("products", {
      id: "product",
      name: "Brace",
      category: "orthotics",
      price: 500,
      stock: 1,
      low_stock_level: 2,
      image_url: "",
      description: "",
      show_on_site: true,
      active: true,
      created_at: stamp,
      updated_at: stamp,
    });
  });
  return t;
};

const patient = {
  full_name: "Test Patient",
  email: "patient@example.test",
  phone: "",
  location: "",
  date_of_birth: null,
  sex: "",
  insurance: "",
  emergency_contact: "",
  national_id: "",
};

function futureSlot() {
  const date = new Date(Date.now() + 2 * 24 * 3_600_000);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(7, 0, 0, 0);
  return date.toISOString();
}

test("booking capacity survives concurrent submissions and public payloads contain only availability or token-scoped fields", async () => {
  process.env.CLINIC_SERVER_SECRET = secret;
  const t = await seeded();
  const startAt = futureSlot();
  const create = (n, overrides) =>
    t.mutation(api.appointments.createFromServer, {
      secret,
      reference: String(n).padStart(8, "0"),
      token: String(n).padStart(48, "0"),
      name: "Test Patient",
      email: "patient@example.test",
      phone: "",
      service: "physiotherapy",
      startAt,
      remind1d: true,
      remind3d: true,
      ...overrides,
    });
  await assert.rejects(create(9, { secret: "wrong" }), /Unauthorized/);
  const result = await Promise.allSettled([create(1), create(2), create(3)]);
  const accepted = result.filter((item) => item.status === "fulfilled").map((item) => item.value);
  assert.equal(accepted.length, 2);
  assert.deepEqual(await create(Number(accepted[0].reference)), accepted[0]);
  const summary = await t.query(api.appointments.availability, {
    service: "physiotherapy",
    day: startAt.slice(0, 10),
  });
  assert.deepEqual(
    summary.find((slot) => slot.start_at === startAt),
    { start_at: startAt, booked: 2, blocked: false },
  );
  await assert.rejects(t.query(api.appointments.list, {}), /Staff access/);
  assert.equal(
    (await t.withIdentity(staffIdentity("ortho")).query(api.appointments.list, {})).length,
    0,
  );
  const booking = await t.query(api.appointments.lookup, { token: accepted[0].token });
  assert.deepEqual(Object.keys(booking).sort(), [
    "reference",
    "service",
    "service_name",
    "start_at",
    "status",
  ]);
  assert.equal(
    await t.mutation(api.appointments.cancelFromServer, { secret, token: accepted[0].token }),
    true,
  );
  assert.equal(
    (
      await t.query(api.appointments.availability, {
        service: "physiotherapy",
        day: startAt.slice(0, 10),
      })
    ).find((slot) => slot.start_at === startAt).booked,
    1,
  );
});

test("staff claims require a verified approved email and removal ends database access", async () => {
  process.env.BOOTSTRAP_ADMIN_EMAIL = "approved@example.test";
  const t = convexTest(schema, modules);
  assert.equal(
    await t.withIdentity(staffIdentity("stranger")).mutation(api.staff.claim, {}),
    false,
  );
  assert.equal(
    await t.withIdentity(staffIdentity("approved", false)).mutation(api.staff.claim, {}),
    false,
  );
  const approved = t.withIdentity(staffIdentity("approved"));
  assert.equal(await approved.mutation(api.staff.claim, {}), true);
  assert.equal((await approved.query(api.staff.me, {})).role, "super_admin");
  await approved.mutation(makeFunctionReference("staff:authorizeInvite"), {
    fullName: "New Staff",
    email: "new@example.test",
    role: "checkin",
    service: null,
  });
  const invited = t.withIdentity(staffIdentity("new"));
  assert.equal(await invited.mutation(api.staff.claim, {}), true);
  const member = await invited.query(api.staff.me, {});
  await approved.mutation(api.staff.remove, { userId: member.id });
  assert.equal(await invited.query(api.staff.me, {}), null);
  await assert.rejects(invited.query(api.billing.patients, {}), /Staff access/);
});

test("bootstrap admin requires signed email claims even when the Clerk account is verified", async () => {
  const t = convexTest(schema, modules);
  process.env.BOOTSTRAP_ADMIN_EMAIL = "admin.alex@neem.health";
  const subject = "synthetic-bootstrap-admin";
  assert.equal(await t.mutation(api.staff.claim, {}), false);
  const incomplete = t.withIdentity({ subject });
  assert.equal(await incomplete.mutation(api.staff.claim, {}), false);
  const noVerification = t.withIdentity({ subject, email: "admin.alex@neem.health" });
  assert.equal(await noVerification.mutation(api.staff.claim, {}), false);
  const unverified = t.withIdentity({
    subject,
    email: "admin.alex@neem.health",
    emailVerified: false,
  });
  assert.equal(await unverified.mutation(api.staff.claim, {}), false);
  const verified = t.withIdentity({
    subject,
    email: "admin.alex@neem.health",
    emailVerified: true,
  });
  assert.equal(await verified.mutation(api.staff.claim, {}), true);
  assert.equal((await verified.query(api.staff.me, {})).role, "super_admin");
  assert.equal(await verified.mutation(api.staff.claim, {}), true);
  const other = t.withIdentity({
    subject: "other",
    email: "other@example.test",
    emailVerified: true,
  });
  assert.equal(await other.mutation(api.staff.claim, {}), false);
  const rows = await t.run(async (ctx) => ({
    profiles: await ctx.db.query("profiles").take(10),
    roles: await ctx.db.query("user_roles").take(10),
  }));
  assert.equal(rows.profiles.length, 1);
  assert.equal(rows.roles.length, 1);
  assert.equal(rows.profiles[0].email, "admin.alex@neem.health");
});

test("department handoff, last-unit sale, stock restoration and final receipts stay consistent", async () => {
  const t = await seeded();
  const admin = t.withIdentity(staffIdentity("admin"));
  const desk = t.withIdentity(staffIdentity("desk"));
  const physio = t.withIdentity(staffIdentity("physio"));
  const ortho = t.withIdentity(staffIdentity("ortho"));
  const visitor = await desk.mutation(api.billing.savePatient, { patient });
  const bill = await desk.action(api.billing.open, {
    patientId: visitor.id,
    appointmentId: null,
    department: "reception",
  });
  const second = await desk.action(api.billing.open, {
    patientId: visitor.id,
    appointmentId: null,
    department: "reception",
  });
  assert.equal(second.number, bill.number + 1);
  await assert.rejects(
    physio.mutation(api.billing.addItem, {
      billId: bill.id,
      itemId: "product",
      product: true,
      quantity: 1,
    }),
    /another department/,
  );
  await desk.mutation(api.billing.handoff, { billId: bill.id, department: "physiotherapy" });
  await assert.rejects(
    ortho.mutation(api.billing.finalize, { billId: bill.id }),
    /another department/,
  );
  const sale = await Promise.allSettled([
    physio.mutation(api.billing.addItem, {
      billId: bill.id,
      itemId: "product",
      product: true,
      quantity: 1,
    }),
    desk.mutation(api.billing.addItem, {
      billId: second.id,
      itemId: "product",
      product: true,
      quantity: 1,
    }),
  ]);
  assert.equal(sale.filter((entry) => entry.status === "fulfilled").length, 1);
  const firstWon = sale[0].status === "fulfilled";
  const fulfilled = firstWon ? bill.id : second.id;
  const winner = firstWon ? physio : desk;
  let current = await winner.query(api.billing.receipt, { billId: fulfilled });
  assert.equal(current.total, 500);
  assert.equal((await admin.query(api.catalog.products, {}))[0].stock, 0);
  await winner.mutation(api.billing.removeItem, {
    billId: fulfilled,
    itemId: current.bill_items[0].id,
  });
  assert.equal((await admin.query(api.catalog.products, {}))[0].stock, 1);
  await winner.mutation(api.billing.addItem, {
    billId: fulfilled,
    itemId: "product",
    product: true,
    quantity: 1,
  });
  assert.equal(await winner.mutation(api.billing.finalize, { billId: fulfilled }), true);
  await assert.rejects(
    winner.mutation(api.billing.cancel, { billId: fulfilled }),
    /bill has changed/,
  );
  assert.equal(
    await winner.mutation(api.billing.markPaid, {
      billId: fulfilled,
      method: "cash",
      reference: "test",
    }),
    true,
  );
  current = await winner.query(api.billing.receipt, { billId: fulfilled });
  assert.equal(current.status, "paid");
  assert.equal(current.total, 500);
  const token = await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("bills")
          .withIndex("by_legacy_id", (q) => q.eq("id", fulfilled))
          .unique()
      ).receipt_token,
  );
  const publicReceipt = await t.query(api.billing.receiptByToken, { token });
  assert.deepEqual(publicReceipt.patients, { full_name: "Test Patient" });
  assert.equal((await t.query(api.catalog.publicProducts, {}))[0].stock, undefined);
  const jobs = await t.mutation(makeFunctionReference("emailDelivery:claim"), {});
  assert.equal(jobs.length, 2);
  assert.equal((await t.mutation(makeFunctionReference("emailDelivery:claim"), {})).length, 0);
});

test("reminders are deduplicated and suppressed if the visit is cancelled before delivery", async () => {
  process.env.CLINIC_SERVER_SECRET = secret;
  const t = await seeded();
  const admin = t.withIdentity(staffIdentity("admin"));
  const startAt = futureSlot();
  const token = "a".repeat(48);
  await t.mutation(api.appointments.createFromServer, {
    secret,
    token,
    reference: "REMINDER",
    name: "Test Patient",
    email: "patient@example.test",
    phone: "",
    service: "physiotherapy",
    startAt,
    remind1d: true,
    remind3d: false,
  });
  const [appt] = await admin.query(api.appointments.list, {});
  await admin.mutation(api.appointments.update, { id: appt.id, status: "accepted", details: "" });
  const range = { from: startAt, to: new Date(Date.parse(startAt) + 1000).toISOString() };
  const reminder = makeFunctionReference("appointments:queueReminders");
  for (const days of [1, 1, 3]) await t.mutation(reminder, { ...range, days });
  await t.mutation(api.appointments.cancelFromServer, { secret, token });
  const jobs = await t.mutation(makeFunctionReference("emailDelivery:claim"), {});
  assert.equal(
    jobs.some((job) => job.payload.template === "booking-reminder"),
    false,
  );
  const reminders = await t.run(async (ctx) =>
    (await ctx.db.query("email_outbox").take(10)).filter(
      (job) => job.payload.template === "booking-reminder",
    ),
  );
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].status, "skipped");
});

test("legacy import preserves data and rejects broken relationships", async () => {
  const parent = await mkdtemp(join(tmpdir(), "neem-import-test-"));
  try {
    const names = [
      "services",
      "profiles",
      "user_roles",
      "appointments",
      "blocked_slots",
      "activity_log",
      "patients",
      "service_items",
      "products",
      "bills",
      "bill_items",
      "bill_handoffs",
      "stock_movements",
    ];
    const dataset = Object.fromEntries(names.map((name) => [name, []]));
    dataset.services.push(service("physiotherapy", true));
    dataset.profiles.push({
      id: "staff-old",
      full_name: "Test Staff",
      email: "STAFF@EXAMPLE.TEST",
      service: null,
      created_at: "2026-11-16T11:00:00+02:00",
    });
    dataset.user_roles.push({ id: "role-old", user_id: "staff-old", role: "super_admin" });
    dataset.billNumberHighWater = 46;
    const source = join(parent, "export.json");
    const output = join(parent, "output");
    await writeFile(source, JSON.stringify(dataset));
    execFileSync(process.execPath, ["scripts/prepare-convex-import.mjs", source, output]);
    const profile = JSON.parse(await readFile(join(output, "profiles.jsonl"), "utf8"));
    assert.equal(profile.id, "staff-old");
    assert.equal(profile.email, "staff@example.test");
    assert.equal(profile.created_at, stamp);
    assert.deepEqual(JSON.parse(await readFile(join(output, "counters.jsonl"), "utf8")), {
      name: "bills",
      value: 46,
    });
    dataset.user_roles[0].user_id = "missing";
    await writeFile(source, JSON.stringify(dataset));
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ["scripts/prepare-convex-import.mjs", source, join(parent, "bad")],
          { stdio: "pipe" },
        ),
      /Unresolved reference/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
