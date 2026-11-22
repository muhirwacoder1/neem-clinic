export type ServiceId = string;

export const SLOT_CAPACITY = 2;

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  checked_in: "Checked in",
  no_show: "No-show",
  completed: "Completed",
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Kigali" });

/** yyyy-mm-dd in Kigali time */
export const kigaliDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" });


/** The upcoming 14 booking dates, calculated in Kigali rather than the viewer's timezone. */
export function bookingDays(instant: number) {
  const local = new Date(instant + 2 * 3_600_000);
  local.setUTCHours(12, 0, 0, 0);
  const days: string[] = [];
  while (days.length < 14) {
    if (local.getUTCDay() !== 0) days.push(local.toISOString().slice(0, 10));
    local.setUTCDate(local.getUTCDate() + 1);
  }
  return days;
}
