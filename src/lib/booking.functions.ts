import { createServerFn } from "@tanstack/react-start";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { api } from "../../convex/_generated/api";

const bookingSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).default(""),
  service: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,40}$/),
  startAt: z.string().datetime(),
  remind3d: z.boolean().default(false),
  remind1d: z.boolean().default(true),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => bookingSchema.parse(value))
  .handler(async ({ data: { requestId, ...data } }: { data: z.output<typeof bookingSchema> }) => {
    try {
      const { clinicServer, bookingSecret } = await import("@/integrations/convex/server");
      const secret = bookingSecret();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`booking:${requestId}:${data.email.toLowerCase()}`),
      );
      const credentials = Array.from(new Uint8Array(signature), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const token = credentials.slice(0, 48);
      const reference = credentials.slice(48, 56).toUpperCase();
      const result = await clinicServer().mutation(api.appointments.createFromServer, {
        ...data,
        secret,
        token,
        reference,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string")
        return { ok: false as const, error: error.data };
      console.error("Could not store booking.");
      return { ok: false as const, error: "Could not save your booking. Please try again." };
    }
  });

export const cancelBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(value),
  )
  .handler(async ({ data }) => {
    const { clinicServer, bookingSecret } = await import("@/integrations/convex/server");
    const ok = await clinicServer().mutation(api.appointments.cancelFromServer, {
      ...data,
      secret: bookingSecret(),
    });
    return { ok };
  });
