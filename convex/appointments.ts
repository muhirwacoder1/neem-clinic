import { bookingDays, SLOT_CAPACITY } from "../src/lib/booking.ts";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.ts";
import type { Doc } from "./_generated/dataModel.ts";
import { appointmentStatus, nullableString } from "./schema.ts";
import {
  admin,
  assertSecret,
  audit,
  canAccessService,
  fail,
  getService,
  id,
  now,
  row,
  staff,
  text,
} from "./lib.ts";
import { enqueue } from "./emailQueue.ts";

type ReadCtx = QueryCtx | MutationCtx;
const halfHour = 30 * 60_000;
const capacity = SLOT_CAPACITY;
const activeStatuses = ["pending", "accepted", "checked_in", "no_show", "completed"] as const;
const active = (status: Doc<"appointments">["status"]) =>
  status !== "declined" && status !== "cancelled";
const tokenValid = (token: string) => /^[a-f0-9]{48}$/.test(token);

async function forSlot(ctx: ReadCtx, service: string, start: string) {
  const rows = await Promise.all(
    activeStatuses.map((status) =>
      ctx.db
        .query("appointments")
        .withIndex("by_service_and_start_at_and_status", (q) =>
          q.eq("service", service).eq("start_at", start).eq("status", status),
        )
        .take(capacity + 1),
    ),
  );
  return rows.flat();
}
async function blocked(ctx: ReadCtx, service: string, start: string) {
  const forService = (slug: string | null) =>
    ctx.db
      .query("blocked_slots")
      .withIndex("by_start_at_and_service", (q) => q.eq("start_at", start).eq("service", slug))
      .first();
  return Boolean((await forService(null)) ?? (await forService(service)));
}

function bookingTime(value: string, publicBooking: boolean) {
  const date = new Date(value);
  const instant = date.getTime();
  if (!Number.isFinite(instant) || instant < Date.now() || instant % halfHour !== 0)
    fail("Invalid appointment time.");
  const local = new Date(instant + 2 * 60 * 60_000);
  const hour = local.getUTCHours();
  if (
    publicBooking &&
    (hour < 8 || hour >= 17 || !bookingDays(Date.now()).includes(local.toISOString().slice(0, 10)))
  ) {
    fail("That appointment time is outside the booking window.");
  }
  return date.toISOString();
}

async function guardSlot(ctx: ReadCtx, service: string, start: string, except?: string) {
  if (await blocked(ctx, service, start)) fail("That slot is not available.");
  const rows = await forSlot(ctx, service, start);
  if (rows.filter((a) => a.id !== except).length >= capacity) {
    fail("Sorry, that slot was just booked. Please pick another.");
  }
}

type BookingNotice =
  | "booking-received"
  | "booking-cancelled"
  | "booking-accepted"
  | "booking-declined"
  | "booking-rescheduled"
  | "booking-reminder";
async function notify(
  ctx: MutationCtx,
  appointment: Doc<"appointments">,
  template: BookingNotice,
  options: {
    oldStartAt?: string;
    daysLeft?: number;
    note?: string;
  } = {},
) {
  const service = await getService(ctx, appointment.service);
  const { id, reference, manage_token, patient_name, patient_email, start_at } = appointment;
  const occurrence = template === "booking-reminder" ? options.daysLeft : appointment.updated_at;
  await enqueue(ctx, `${id}-${template}-${start_at}-${occurrence}`, {
    type: "booking",
    template,
    appointment: {
      id,
      reference,
      manage_token,
      patient_name,
      patient_email,
      start_at,
      service: appointment.service,
      service_name: service?.name ?? appointment.service,
    },
    ...options,
  });
}

export const availability = query({
  args: { service: v.string(), day: v.string() },
  returns: v.array(v.object({ start_at: v.string(), booked: v.number(), blocked: v.boolean() })),
  handler: async (ctx, { service, day }) => {
    const start = new Date(`${day}T08:00:00+02:00`).getTime();
    const config = await getService(ctx, service);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(start) ||
      !config?.active ||
      !config.bookable
    )
      return [];
    return Promise.all(
      Array.from({ length: 18 }, async (_, index) => {
        const start_at = new Date(start + index * halfHour).toISOString();
        const appointments = await forSlot(ctx, service, start_at);
        return {
          start_at,
          booked: appointments.length,
          blocked: await blocked(ctx, service, start_at),
        };
      }),
    );
  },
});

export const lookup = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      reference: v.string(),
      service: v.string(),
      service_name: v.string(),
      start_at: v.string(),
      status: appointmentStatus,
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!tokenValid(token)) return null;
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_manage_token", (q) => q.eq("manage_token", token))
      .unique();
    if (!appointment) return null;
    const { reference, service, start_at, status } = appointment;
    return {
      reference,
      service,
      service_name: (await getService(ctx, service))?.name ?? service,
      start_at,
      status,
    };
  },
});

export const createFromServer = mutation({
  args: {
    secret: v.string(),
    token: v.string(),
    reference: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    service: v.string(),
    startAt: v.string(),
    remind1d: v.boolean(),
    remind3d: v.boolean(),
  },
  returns: v.object({ reference: v.string(), token: v.string() }),
  handler: async (ctx, args) => {
    assertSecret(args.secret, process.env["CLINIC_SERVER_SECRET"]);
    if (!tokenValid(args.token) || !/^[A-Z0-9]{8}$/.test(args.reference))
      fail("Invalid booking credentials.");
    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_manage_token", (q) => q.eq("manage_token", args.token))
      .unique();
    if (existing) return { reference: existing.reference, token: existing.manage_token };
    const service = await getService(ctx, args.service);
    if (!service?.active || !service.bookable) fail("That service is not available for booking.");
    if (
      await ctx.db
        .query("appointments")
        .withIndex("by_reference", (q) => q.eq("reference", args.reference))
        .first()
    )
      fail("Duplicate booking reference.");
    const start_at = bookingTime(args.startAt, true);
    await guardSlot(ctx, args.service, start_at);
    const patient_email = text(args.email, 255, 3).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient_email)) fail("Enter a valid email address.");
    const stamp = now();
    const appointment = {
      id: id(),
      reference: args.reference,
      manage_token: args.token,
      status: "pending" as const,
      patient_name: text(args.name, 100, 2),
      patient_email,
      patient_phone: text(args.phone, 30),
      start_at,
      service: args.service,
      notes: "",
      remind_1d: args.remind1d,
      remind_3d: args.remind3d,
      reminder_sent: false,
      created_at: stamp,
      updated_at: stamp,
    };
    const storedId = await ctx.db.insert("appointments", appointment);
    await audit(ctx, null, "booking", "booked", "", appointment.id, appointment.patient_name);
    await notify(ctx, (await ctx.db.get(storedId))!, "booking-received");
    return { reference: args.reference, token: args.token };
  },
});

export const cancelFromServer = mutation({
  args: { secret: v.string(), token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { secret, token }) => {
    assertSecret(secret, process.env["CLINIC_SERVER_SECRET"]);
    if (!tokenValid(token)) return false;
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_manage_token", (q) => q.eq("manage_token", token))
      .unique();
    if (!appointment || (appointment.status !== "pending" && appointment.status !== "accepted"))
      return false;
    const patch = { status: "cancelled" as const, updated_at: now() };
    await ctx.db.patch(appointment._id, patch);
    await audit(
      ctx,
      null,
      "booking",
      "cancelled",
      "Cancelled by patient",
      appointment.id,
      appointment.patient_name,
    );
    await notify(ctx, { ...appointment, ...patch }, "booking-cancelled");
    return true;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      reference: v.string(),
      patient_name: v.string(),
      patient_email: v.string(),
      patient_phone: v.string(),
      service: v.string(),
      start_at: v.string(),
      status: appointmentStatus,
      notes: v.string(),
      created_at: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const actor = await staff(ctx);
    const rows =
      actor.role === "provider" && actor.service
        ? await ctx.db
            .query("appointments")
            .withIndex("by_service_and_start_at", (q) => q.eq("service", actor.service!))
            .order("desc")
            .take(1000)
        : await ctx.db.query("appointments").withIndex("by_start_at").order("desc").take(1000);
    return rows
      .reverse()
      .map(
        ({
          id,
          reference,
          patient_name,
          patient_email,
          patient_phone,
          service,
          start_at,
          status,
          notes,
          created_at,
        }) => ({
          id,
          reference,
          patient_name,
          patient_email,
          patient_phone,
          service,
          start_at,
          status,
          notes,
          created_at,
        }),
      );
  },
});

const transitions: Record<Doc<"appointments">["status"], Doc<"appointments">["status"][]> = {
  pending: ["accepted", "declined", "cancelled", "checked_in", "no_show"],
  accepted: ["cancelled", "checked_in", "no_show", "completed"],
  checked_in: ["completed"],
  completed: [],
  no_show: [],
  declined: [],
  cancelled: [],
};
export const update = mutation({
  args: {
    id: v.string(),
    status: v.optional(appointmentStatus),
    startAt: v.optional(v.string()),
    notes: v.optional(v.string()),
    details: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await staff(ctx);
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_legacy_id", (q) => q.eq("id", args.id))
      .unique();
    if (!appointment || !canAccessService(actor, appointment.service))
      return fail("Appointment access denied.");
    const status = args.status ?? appointment.status;
    if (status !== appointment.status && !transitions[appointment.status].includes(status))
      fail("Invalid appointment status change.");
    const start_at = args.startAt ? bookingTime(args.startAt, false) : appointment.start_at;
    if (start_at !== appointment.start_at) {
      if (!["pending", "accepted"].includes(appointment.status))
        fail("That appointment can no longer be rescheduled.");
      if (active(status)) await guardSlot(ctx, appointment.service, start_at, appointment.id);
    }
    const patch = {
      status,
      start_at,
      notes: args.notes === undefined ? appointment.notes : text(args.notes, 2000),
      updated_at: now(),
    };
    const action =
      start_at !== appointment.start_at
        ? "rescheduled"
        : status !== appointment.status
          ? status
          : "notes";
    await ctx.db.patch(appointment._id, patch);
    await audit(ctx, actor, "booking", action, text(args.details, 2000), appointment.id);
    if (action === "rescheduled")
      await notify(ctx, { ...appointment, ...patch }, "booking-rescheduled", {
        oldStartAt: appointment.start_at,
      });
    else if (action === "accepted" || action === "declined" || action === "cancelled") {
      await notify(
        ctx,
        { ...appointment, ...patch },
        `booking-${action}`,
        args.details ? { note: args.details } : {},
      );
    }
    return null;
  },
});

export const listBlocks = query({
  args: { from: v.string() },
  returns: v.array(
    v.object({
      id: v.string(),
      service: nullableString,
      start_at: v.string(),
      reason: v.string(),
      created_at: v.string(),
    }),
  ),
  handler: async (ctx, { from }) => {
    await admin(ctx);
    return (
      await ctx.db
        .query("blocked_slots")
        .withIndex("by_start_at_and_service", (q) => q.gte("start_at", from))
        .take(1000)
    ).map(row);
  },
});

export const block = mutation({
  args: { slots: v.array(v.string()), service: nullableString, reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { slots, service, reason }) => {
    await admin(ctx);
    if (slots.length > 48 || (service && !(await getService(ctx, service))))
      fail("Invalid blocked slots.");
    for (const value of slots) {
      const start_at = bookingTime(value, false);
      const exists = await ctx.db
        .query("blocked_slots")
        .withIndex("by_start_at_and_service", (q) =>
          q.eq("start_at", start_at).eq("service", service),
        )
        .first();
      if (!exists)
        await ctx.db.insert("blocked_slots", {
          id: id(),
          service,
          start_at,
          reason: text(reason, 250),
          created_at: now(),
        });
    }
    return null;
  },
});

export const unblock = mutation({
  args: { id: v.string() },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await admin(ctx);
    const slot = await ctx.db
      .query("blocked_slots")
      .withIndex("by_legacy_id", (q) => q.eq("id", id))
      .unique();
    if (slot) await ctx.db.delete(slot._id);
    return null;
  },
});

export const queueReminders = internalMutation({
  args: { from: v.string(), to: v.string(), days: v.union(v.literal(1), v.literal(3)) },
  returns: v.number(),
  handler: async (ctx, { from, to, days }) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_status_and_start_at", (q) =>
        q.eq("status", "accepted").gte("start_at", from).lt("start_at", to),
      )
      .take(1000);
    let count = 0;
    for (const appointment of appointments) {
      if (days === 1 ? appointment.remind_1d : appointment.remind_3d) {
        await notify(ctx, appointment, "booking-reminder", { daysLeft: days });
        count++;
      }
    }
    return count;
  },
});
