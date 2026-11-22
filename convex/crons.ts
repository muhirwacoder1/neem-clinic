import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.ts";

const jobs = cronJobs();
jobs.daily(
  "daily-booking-reminders",
  { hourUTC: 16, minuteUTC: 0 },
  internal.emailDelivery.reminders,
);
jobs.interval("deliver-clinic-email", { minutes: 1 }, internal.emailDelivery.deliver);
export default jobs;
