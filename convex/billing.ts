import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.ts";
import type { Doc } from "./_generated/dataModel.ts";
import { internal } from "./_generated/api.ts";
import { billStatus, nullableString, patientsFields, paymentMethod } from "./schema.ts";
import {
  audit,
  canAccessService,
  canBill,
  fail,
  getService,
  id,
  int,
  now,
  row,
  staff,
  text,
} from "./lib.ts";
import type { Staff } from "./lib.ts";
import { moveStock } from "./catalog.ts";
import { enqueue } from "./emailQueue.ts";

type ReadCtx = QueryCtx | MutationCtx;
type Bill = Doc<"bills">;
const itemLimit = 200;
const itemSummary = v.object({
  id: v.string(),
  name: v.string(),
  department: v.string(),
  unit_price: v.number(),
  quantity: v.number(),
});
const patientSummary = v.object({
  full_name: v.string(),
  phone: v.string(),
  email: v.string(),
  insurance: v.string(),
});
const billSummary = v.object({
  id: v.string(),
  number: v.number(),
  status: billStatus,
  current_department: v.string(),
  total: v.number(),
  payment_method: v.union(paymentMethod, v.null()),
  payment_reference: v.string(),
  appointment_id: nullableString,
  created_at: v.string(),
  paid_at: nullableString,
  created_by_name: v.string(),
  paid_by_name: v.string(),
  finalized_by_name: v.string(),
  bill_items: v.array(itemSummary),
});
const publicReceipt = v.object({
  number: v.number(),
  status: billStatus,
  total: v.number(),
  payment_method: v.union(paymentMethod, v.null()),
  payment_reference: v.string(),
  created_at: v.string(),
  paid_at: nullableString,
  paid_by_name: v.string(),
  finalized_by_name: v.string(),
  patients: v.union(v.object({ full_name: v.string() }), v.null()),
  bill_items: v.array(itemSummary),
});

const byBill = (ctx: ReadCtx, id: string) =>
  ctx.db
    .query("bills")
    .withIndex("by_legacy_id", (q) => q.eq("id", id))
    .unique();
const byPatient = (ctx: ReadCtx, id: string) =>
  ctx.db
    .query("patients")
    .withIndex("by_legacy_id", (q) => q.eq("id", id))
    .unique();
const byAppointment = (ctx: ReadCtx, id: string) =>
  ctx.db
    .query("appointments")
    .withIndex("by_legacy_id", (q) => q.eq("id", id))
    .unique();
const itemsForBill = (ctx: ReadCtx, id: string) =>
  ctx.db
    .query("bill_items")
    .withIndex("by_bill_id", (q) => q.eq("bill_id", id))
    .take(itemLimit + 1);

async function summarize(ctx: ReadCtx, bill: Bill) {
  const {
    id,
    number,
    status,
    current_department,
    total,
    payment_method,
    payment_reference,
    appointment_id,
    created_at,
    paid_at,
    created_by_name,
    paid_by_name,
    finalized_by_name,
  } = bill;
  const bill_items = (await itemsForBill(ctx, id)).map(
    ({ id, name, department, unit_price, quantity }) => ({
      id,
      name,
      department,
      unit_price,
      quantity,
    }),
  );
  return {
    id,
    number,
    status,
    current_department,
    total,
    payment_method,
    payment_reference,
    appointment_id,
    created_at,
    paid_at,
    created_by_name,
    paid_by_name,
    finalized_by_name,
    bill_items,
  };
}

async function editableBill(ctx: MutationCtx, actor: Staff, id: string, status: Bill["status"]) {
  const bill = await byBill(ctx, id);
  if (!bill || !canBill(actor, bill.current_department))
    return fail("This bill is assigned to another department.");
  if (bill.status !== status) fail("The bill has changed. Refresh and try again.");
  return bill;
}

const patientInput = v.object({
  full_name: v.string(),
  email: v.string(),
  phone: v.string(),
  location: v.string(),
  date_of_birth: nullableString,
  sex: v.string(),
  insurance: v.string(),
  emergency_contact: v.string(),
  national_id: v.string(),
});
export const patients = query({
  args: {},
  returns: v.array(v.object(patientsFields)),
  handler: async (ctx) => {
    await staff(ctx);
    return (await ctx.db.query("patients").withIndex("by_created_at").order("desc").take(500)).map(
      row,
    );
  },
});

export const savePatient = mutation({
  args: { id: v.optional(v.string()), patient: patientInput },
  returns: v.object(patientsFields),
  handler: async (ctx, args) => {
    const actor = await staff(ctx);
    const p = args.patient;
    const patient = {
      full_name: text(p.full_name, 100, 2),
      email: text(p.email, 255).toLowerCase(),
      phone: text(p.phone, 30),
      location: text(p.location, 200),
      date_of_birth: p.date_of_birth,
      sex: text(p.sex, 50),
      insurance: text(p.insurance, 200),
      emergency_contact: text(p.emergency_contact, 200),
      national_id: text(p.national_id, 80),
    };
    if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email))
      fail("Enter a valid email address.");
    if (patient.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(patient.date_of_birth))
      fail("Enter a valid date of birth.");
    const stamp = now();
    if (args.id) {
      const existing = await byPatient(ctx, args.id);
      if (!existing) return fail("Patient not found.");
      await ctx.db.patch(existing._id, { ...patient, updated_at: stamp });
      await audit(ctx, actor, "billing", "patient_updated", patient.full_name);
      return { ...row(existing), ...patient, updated_at: stamp };
    }
    const created = {
      ...patient,
      id: id(),
      created_by: actor.id,
      created_at: stamp,
      updated_at: stamp,
    };
    await ctx.db.insert("patients", created);
    await audit(ctx, actor, "billing", "patient_registered", patient.full_name);
    return created;
  },
});

export const patientBills = query({
  args: { patientId: v.string() },
  returns: v.array(billSummary),
  handler: async (ctx, { patientId }) => {
    await staff(ctx);
    const bills = await ctx.db
      .query("bills")
      .withIndex("by_patient_id_and_created_at", (q) => q.eq("patient_id", patientId))
      .order("desc")
      .take(50);
    return Promise.all(bills.map((bill) => summarize(ctx, bill)));
  },
});

export const waiting = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      number: v.number(),
      total: v.number(),
      current_department: v.string(),
      patient_id: v.string(),
      patients: v.union(v.null(), v.object({ full_name: v.string() })),
    }),
  ),
  handler: async (ctx) => {
    const actor = await staff(ctx);
    const department =
      actor.role === "checkin" ? "reception" : actor.role === "provider" ? actor.service : null;
    const bills = await ctx.db
      .query("bills")
      .withIndex("by_status_and_current_department", (q) => {
        const unpaid = q.eq("status", "unpaid");
        return department ? unpaid.eq("current_department", department) : unpaid;
      })
      .take(200);
    return Promise.all(
      bills
        .filter((b) => canBill(actor, b.current_department))
        .map(async ({ id, number, total, current_department, patient_id }) => {
          const p = await byPatient(ctx, patient_id);
          return {
            id,
            number,
            total,
            current_department,
            patient_id,
            patients: p ? { full_name: p.full_name } : null,
          };
        }),
    );
  },
});

const openArgs = { patientId: v.string(), appointmentId: nullableString, department: v.string() };
export const open = action({
  args: openArgs,
  returns: v.object({ id: v.string(), number: v.number() }),
  handler: async (ctx, args): Promise<{ id: string; number: number }> => {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const receiptToken = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return ctx.runMutation(internal.billing.openWithToken, { ...args, receiptToken });
  },
});

export const openWithToken = internalMutation({
  args: { ...openArgs, receiptToken: v.string() },
  returns: v.object({ id: v.string(), number: v.number() }),
  handler: async (ctx, { patientId, appointmentId, department, receiptToken }) => {
    const actor = await staff(ctx);
    if (!canBill(actor, department) || !(await getService(ctx, department))?.active)
      fail("Invalid billing department.");
    const patient = await byPatient(ctx, patientId);
    if (!patient) return fail("Patient not found.");
    if (appointmentId) {
      const appointment = await byAppointment(ctx, appointmentId);
      if (!appointment || !canAccessService(actor, appointment.service))
        return fail("Appointment access denied.");
      const existing = await ctx.db
        .query("bills")
        .withIndex("by_appointment_id", (q) => q.eq("appointment_id", appointmentId))
        .take(50);
      const open = existing.find((bill) => bill.status !== "cancelled");
      if (open) {
        if (open.patient_id !== patientId)
          return fail("This appointment already has a bill for another patient.");
        return { id: open.id, number: open.number };
      }
    }
    const [counter, last] = await Promise.all([
      ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "bills"))
        .unique(),
      ctx.db.query("bills").withIndex("by_number").order("desc").first(),
    ]);
    const number = Math.max(counter?.value ?? 0, last?.number ?? 0) + 1;
    if (counter) await ctx.db.patch(counter._id, { value: number });
    else await ctx.db.insert("counters", { name: "bills", value: number });
    const billId = id();
    const stamp = now();
    await ctx.db.insert("bills", {
      id: billId,
      number,
      patient_id: patientId,
      appointment_id: appointmentId,
      status: "unpaid",
      total: 0,
      current_department: department,
      payment_method: null,
      payment_reference: "",
      created_by: actor.id,
      created_by_name: actor.name,
      finalized_by_name: "",
      finalized_at: null,
      paid_by: null,
      paid_by_name: "",
      paid_at: null,
      receipt_token: receiptToken,
      created_at: stamp,
      updated_at: stamp,
    });
    await audit(
      ctx,
      actor,
      "billing",
      "bill_opened",
      `Bill #${number} · ${patient.full_name}`,
      appointmentId,
    );
    return { id: billId, number };
  },
});

export const addItem = mutation({
  args: { billId: v.string(), itemId: v.string(), product: v.boolean(), quantity: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, args.billId, "unpaid");
    const quantity = int(args.quantity, 1, 1000);
    if ((await itemsForBill(ctx, bill.id)).length >= itemLimit)
      fail("This bill has reached its line-item limit.");
    const item = args.product
      ? await ctx.db
          .query("products")
          .withIndex("by_legacy_id", (q) => q.eq("id", args.itemId))
          .unique()
      : await ctx.db
          .query("service_items")
          .withIndex("by_legacy_id", (q) => q.eq("id", args.itemId))
          .unique();
    if (!item?.active) return fail("That item is unavailable.");
    if ("stock" in item) {
      if (item.stock < quantity) fail(`Only ${item.stock} left in stock.`);
      await moveStock(ctx, item, actor, -quantity, "Sold on bill");
    } else if (
      !canBill(actor, item.department) ||
      (actor.role !== "super_admin" && item.department !== bill.current_department)
    ) {
      fail("You can only bill items from your current department.");
    }
    await ctx.db.insert("bill_items", {
      id: id(),
      bill_id: bill.id,
      service_item_id: args.product ? null : item.id,
      product_id: args.product ? item.id : null,
      department: "department" in item ? item.department : "products",
      name: item.name,
      unit_price: item.price,
      quantity,
      added_by: actor.id,
      created_at: now(),
    });
    await ctx.db.patch(bill._id, {
      total: int(bill.total + item.price * quantity, 0, 2_147_483_647),
      updated_at: now(),
    });
    await audit(
      ctx,
      actor,
      "billing",
      "bill_item_added",
      `Bill #${bill.number} · ${item.name} × ${quantity}`,
      bill.appointment_id,
    );
    return null;
  },
});

async function removeLine(ctx: MutationCtx, actor: Staff, item: Doc<"bill_items">) {
  if (item.product_id) {
    const product = await ctx.db
      .query("products")
      .withIndex("by_legacy_id", (q) => q.eq("id", item.product_id!))
      .unique();
    if (!product)
      return fail("Product missing. Restore the inventory record before removing this item.");
    await moveStock(ctx, product, actor, item.quantity, "Removed from bill");
  }
  await ctx.db.delete(item._id);
}

export const removeItem = mutation({
  args: { billId: v.string(), itemId: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId, itemId }) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, billId, "unpaid");
    const item = await ctx.db
      .query("bill_items")
      .withIndex("by_legacy_id", (q) => q.eq("id", itemId))
      .unique();
    if (!item || item.bill_id !== billId) return fail("Bill item not found.");
    await removeLine(ctx, actor, item);
    await ctx.db.patch(bill._id, {
      total: int(bill.total - item.unit_price * item.quantity, 0, 2_147_483_647),
      updated_at: now(),
    });
    await audit(
      ctx,
      actor,
      "billing",
      "bill_item_removed",
      `Bill #${bill.number} · ${item.name}`,
      bill.appointment_id,
    );
    return null;
  },
});

export const handoff = mutation({
  args: { billId: v.string(), department: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId, department }) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, billId, "unpaid");
    const service = await getService(ctx, department);
    if (!service?.active || department === bill.current_department)
      fail("Pick another active department.");
    const stamp = now();
    await ctx.db.patch(bill._id, { current_department: department, updated_at: stamp });
    await ctx.db.insert("bill_handoffs", {
      id: id(),
      bill_id: billId,
      from_department: bill.current_department,
      to_department: department,
      by_id: actor.id,
      by_name: actor.name,
      created_at: stamp,
    });
    await audit(
      ctx,
      actor,
      "billing",
      "bill_handed_off",
      `Bill #${bill.number} → ${department}`,
      bill.appointment_id,
    );
    return null;
  },
});

async function queueBill(ctx: MutationCtx, bill: Bill, key: string) {
  const patient = await byPatient(ctx, bill.patient_id);
  if (!patient?.email) return false;
  const items = (await itemsForBill(ctx, bill.id)).map(({ name, quantity, unit_price }) => ({
    name,
    quantity,
    unit_price,
  }));
  await enqueue(ctx, key, {
    type: "bill",
    email: patient.email,
    name: patient.full_name,
    number: bill.number,
    items,
    status: bill.status,
    total: bill.total,
    method: bill.payment_method,
    reference: bill.payment_reference,
    receiptToken: bill.receipt_token,
  });
  return true;
}

export const finalize = mutation({
  args: { billId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { billId }) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, billId, "unpaid");
    if (bill.total <= 0) fail("An empty bill cannot be finalized.");
    const stamp = now();
    const patch = {
      status: "awaiting_payment" as const,
      finalized_by_name: actor.name,
      finalized_at: stamp,
      updated_at: stamp,
    };
    await ctx.db.patch(bill._id, patch);
    await audit(
      ctx,
      actor,
      "billing",
      "final_invoice_issued",
      `Bill #${bill.number}`,
      bill.appointment_id,
    );
    return queueBill(ctx, { ...bill, ...patch }, `bill-${billId}-awaiting`);
  },
});

export const markPaid = mutation({
  args: { billId: v.string(), method: paymentMethod, reference: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { billId, method, reference }) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, billId, "awaiting_payment");
    const stamp = now();
    const patch = {
      status: "paid" as const,
      payment_method: method,
      payment_reference: text(reference, 120),
      paid_by: actor.id,
      paid_by_name: actor.name,
      paid_at: stamp,
      updated_at: stamp,
    };
    await ctx.db.patch(bill._id, patch);
    await audit(
      ctx,
      actor,
      "billing",
      "payment_confirmed",
      `Bill #${bill.number} · ${method}`,
      bill.appointment_id,
    );
    return queueBill(ctx, { ...bill, ...patch }, `bill-${billId}-paid`);
  },
});

export const resend = mutation({
  args: { billId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { billId }) => {
    const actor = await staff(ctx);
    const bill = await byBill(ctx, billId);
    if (
      !bill ||
      !["paid", "awaiting_payment"].includes(bill.status) ||
      !canBill(actor, bill.current_department)
    )
      return fail("This bill cannot be emailed.");
    return queueBill(ctx, bill, `bill-${billId}-resend-${id()}`);
  },
});

export const cancel = mutation({
  args: { billId: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId }) => {
    const actor = await staff(ctx);
    const bill = await editableBill(ctx, actor, billId, "unpaid");
    const items = await itemsForBill(ctx, bill.id);
    if (items.length > itemLimit)
      fail("Ask an administrator to reconcile this older bill before cancelling it.");
    for (const item of items) await removeLine(ctx, actor, item);
    await ctx.db.patch(bill._id, { status: "cancelled", total: 0, updated_at: now() });
    await audit(
      ctx,
      actor,
      "billing",
      "bill_cancelled",
      `Bill #${bill.number}`,
      bill.appointment_id,
    );
    return null;
  },
});

export const receipt = query({
  args: { billId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ ...billSummary.fields, patients: v.union(patientSummary, v.null()) }),
  ),
  handler: async (ctx, { billId }) => {
    await staff(ctx);
    const bill = await byBill(ctx, billId);
    if (!bill) return null;
    const patient = await byPatient(ctx, bill.patient_id);
    const patients = patient
      ? {
          full_name: patient.full_name,
          phone: patient.phone,
          email: patient.email,
          insurance: patient.insurance,
        }
      : null;
    return { ...(await summarize(ctx, bill)), patients };
  },
});

export const receiptByToken = query({
  args: { token: v.string() },
  returns: v.union(v.null(), publicReceipt),
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{36}$/.test(token)) return null;
    const bill = await ctx.db
      .query("bills")
      .withIndex("by_receipt_token", (q) => q.eq("receipt_token", token))
      .unique();
    if (!bill || (bill.status !== "paid" && bill.status !== "awaiting_payment")) return null;
    const {
      number,
      status,
      total,
      payment_method,
      payment_reference,
      created_at,
      paid_at,
      paid_by_name,
      finalized_by_name,
      bill_items,
    } = await summarize(ctx, bill);
    const patient = await byPatient(ctx, bill.patient_id);
    return {
      number,
      status,
      total,
      payment_method,
      payment_reference,
      created_at,
      paid_at,
      paid_by_name,
      finalized_by_name,
      bill_items,
      patients: patient ? { full_name: patient.full_name } : null,
    };
  },
});
