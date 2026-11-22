import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server.ts";
import { internal } from "./_generated/api.ts";
import { emailPayload } from "./schema.ts";

const job = v.object({
  id: v.id("email_outbox"),
  attempts: v.number(),
  key: v.string(),
  payload: emailPayload,
});
export const claim = internalMutation({
  args: {},
  returns: v.array(job),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("email_outbox")
      .withIndex("by_status_and_dueAt", (q) => q.eq("status", "sending").lte("dueAt", now))
      .take(15);
    const remaining = 15 - expired.length;
    const pending = remaining
      ? await ctx.db
          .query("email_outbox")
          .withIndex("by_status_and_dueAt", (q) => q.eq("status", "pending").lte("dueAt", now))
          .take(remaining)
      : [];
    const jobs = [];
    for (const row of [...expired, ...pending]) {
      if (row.attempts >= 5) {
        await ctx.db.patch(row._id, { status: "failed", dueAt: now });
        continue;
      }
      if (row.payload.type === "booking" && row.payload.template === "booking-reminder") {
        const { id, start_at } = row.payload.appointment;
        const appointment = await ctx.db
          .query("appointments")
          .withIndex("by_legacy_id", (q) => q.eq("id", id))
          .unique();
        const eligible =
          appointment?.status === "accepted" &&
          appointment.start_at === start_at &&
          Date.parse(start_at) > now &&
          (row.payload.daysLeft === 1 ? appointment.remind_1d : appointment.remind_3d);
        if (!eligible) {
          await ctx.db.patch(row._id, { status: "skipped", dueAt: now });
          continue;
        }
      }
      const attempts = row.attempts + 1;
      await ctx.db.patch(row._id, { status: "sending", attempts, dueAt: now + 5 * 60_000 });
      jobs.push({ id: row._id, key: row.key, payload: row.payload, attempts });
    }
    return jobs;
  },
});

export const finish = internalMutation({
  args: { id: v.id("email_outbox"), attempts: v.number(), sent: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, attempts, sent }) => {
    const job = await ctx.db.get(id);
    if (!job || job.status !== "sending" || job.attempts !== attempts) return null;
    const status = sent ? "sent" : attempts >= 5 ? "failed" : "pending";
    await ctx.db.patch(id, { status, dueAt: Date.now() + (sent ? 0 : 60_000 * 2 ** attempts) });
    return null;
  },
});

export const deliver = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const origin = process.env["APP_ORIGIN"];
    const secret = process.env["CRON_SECRET"];
    if (!origin || !secret || process.env["NEEM_EMAILS_ENABLED"] !== "true") return null;
    const jobs = await ctx.runMutation(internal.emailDelivery.claim);
    await Promise.all(
      jobs.map(async ({ id, attempts, key, payload }) => {
        let sent = false;
        try {
          const response = await fetch(new URL("/api/public/cron/reminders", origin), {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
            body: JSON.stringify({ key, payload }),
          });
          sent = response.ok;
        } catch {
          // The durable queue keeps the retry independent of the clinic write.
        }
        if (!sent && attempts >= 5)
          console.error("Clinic email exhausted its delivery attempts:", id);
        await ctx.runMutation(internal.emailDelivery.finish, { id, attempts, sent });
      }),
    );
    return null;
  },
});

export const reminders = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const days of [1, 3] as const) {
      const localDay = new Date(Date.now() + (days * 24 + 2) * 3_600_000)
        .toISOString()
        .slice(0, 10);
      const from = new Date(`${localDay}T00:00:00+02:00`).toISOString();
      const to = new Date(Date.parse(from) + 24 * 3_600_000).toISOString();
      await ctx.runMutation(internal.appointments.queueReminders, { from, to, days });
    }
    return null;
  },
});
