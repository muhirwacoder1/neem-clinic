import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { formatDate, formatTime } from "@/lib/booking";

// Server-only helper: builds template data for an appointment and sends the
// matching booking email. Email failures are logged, never thrown, so a mail
// problem can never break a booking or a dashboard action.

export type BookingEmailKind =
  | "booking-received"
  | "booking-accepted"
  | "booking-declined"
  | "booking-rescheduled"
  | "booking-cancelled"
  | "booking-reminder";

export interface AppointmentLike {
  id: string;
  reference: string;
  patient_name: string;
  patient_email: string;
  service: string;
  service_name: string;
  start_at: string;
  manage_token: string;
}

export async function sendBookingEmail(
  appt: AppointmentLike,
  kind: BookingEmailKind,
  extras: { oldStartAt?: string; note?: string; daysLeft?: number; idempotencyKey?: string } = {},
): Promise<boolean> {
  try {
    const origin = process.env["APP_ORIGIN"];
    if (!origin) throw new Error("Set APP_ORIGIN.");
    const manageUrl =
      kind === "booking-declined" || kind === "booking-cancelled"
        ? new URL("/book", origin).href
        : new URL(`/manage/${appt.manage_token}`, origin).href;
    const result = await sendTemplateEmail(kind, appt.patient_email, {
      templateData: {
        name: appt.patient_name,
        serviceName: appt.service_name,
        dateLabel: formatDate(appt.start_at),
        timeLabel: formatTime(appt.start_at),
        reference: appt.reference,
        manageUrl,
        oldDateLabel: extras.oldStartAt ? formatDate(extras.oldStartAt) : undefined,
        oldTimeLabel: extras.oldStartAt ? formatTime(extras.oldStartAt) : undefined,
        note: extras.note,
        daysLeft: extras.daysLeft,
      },
      idempotencyKey: extras.idempotencyKey ?? `${appt.id}-${kind}-${appt.start_at}${extras.daysLeft ? `-${extras.daysLeft}d` : ""}`,
    });
    return result.sent;
  } catch {
    console.error(`[email] ${kind} failed.`);
    return false;
  }
}
