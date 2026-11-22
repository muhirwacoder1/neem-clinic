import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PAY_CODE, PAY_HREF, formatRWF, paymentName } from "@/lib/billing";

const bookingKind = z.enum([
  "booking-received",
  "booking-accepted",
  "booking-declined",
  "booking-rescheduled",
  "booking-cancelled",
  "booking-reminder",
]);
const relay = z.object({
  key: z.string().min(8).max(240),
  payload: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("booking"),
      template: bookingKind,
      appointment: z.object({
        id: z.string(),
        reference: z.string(),
        manage_token: z.string().regex(/^[a-f0-9]{48}$/),
        patient_name: z.string(),
        patient_email: z.string().email(),
        service: z.string(),
        service_name: z.string(),
        start_at: z.string(),
      }),
      oldStartAt: z.string().optional(),
      daysLeft: z.union([z.literal(1), z.literal(3)]).optional(),
      note: z.string().optional(),
    }),
    z.object({
      type: z.literal("bill"),
      email: z.string().email(),
      name: z.string(),
      number: z.number(),
      total: z.number(),
      status: z.enum(["unpaid", "awaiting_payment", "paid", "cancelled"]),
      method: z.enum(["cash", "mobile_money", "card", "insurance"]).nullable(),
      reference: z.string(),
      receiptToken: z.string().regex(/^[a-f0-9]{36}$/),
      items: z
        .array(z.object({ name: z.string(), quantity: z.number(), unit_price: z.number() }))
        .max(201),
    }),
  ]),
});

function authorized(header: string, secret: string | undefined) {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < expected.length; index++)
    different |= header.charCodeAt(index) ^ expected.charCodeAt(index);
  return different === 0;
}

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request.headers.get("authorization") ?? "", process.env["CRON_SECRET"])) {
          return new Response("Unauthorized", { status: 401 });
        }
        const parsed = relay.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid delivery payload", { status: 400 });
        const { key, payload } = parsed.data;
        if (payload.type === "booking") {
          const { sendBookingEmail } = await import("@/lib/notify-email.server");
          const sent = await sendBookingEmail(payload.appointment, payload.template, {
            ...(payload.daysLeft ? { daysLeft: payload.daysLeft } : {}),
            ...(payload.oldStartAt ? { oldStartAt: payload.oldStartAt } : {}),
            ...(payload.note ? { note: payload.note } : {}),
            idempotencyKey: key,
          });
          return new Response(null, { status: sent ? 204 : 502 });
        }
        try {
          const origin = process.env["APP_ORIGIN"];
          if (!origin) throw new Error("Set APP_ORIGIN.");
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const sent = await sendTemplateEmail("bill-issued", payload.email, {
            idempotencyKey: key,
            templateData: {
              name: payload.name,
              number: payload.number,
              items: payload.items.map((item) => ({
                name: item.name,
                qty: item.quantity,
                amount: formatRWF(item.unit_price * item.quantity),
              })),
              total: formatRWF(payload.total),
              status: payload.status,
              method: paymentName(payload.method),
              reference: payload.reference || undefined,
              payCode: PAY_CODE,
              payHref: PAY_HREF,
              receiptUrl: new URL(`/r/${payload.receiptToken}`, origin).href,
            },
          });
          return new Response(null, { status: sent.sent ? 204 : 502 });
        } catch {
          console.error("Could not deliver bill email.");
          return new Response(null, { status: 502 });
        }
      },
    },
  },
});
