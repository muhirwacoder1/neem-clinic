import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cancelBookingByToken } from "@/lib/booking.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { STATUS_LABEL, formatDate, formatTime } from "@/lib/booking";

export const Route = createFileRoute("/manage/$token")({
  headers: () => ({ "cache-control": "private, no-store", "referrer-policy": "no-referrer" }),
  head: () => ({
    meta: [
      { title: `Manage Your Booking | ${BRAND_NAME}` },
      { name: "description", content: `View or cancel your ${BRAND_NAME} appointment.` },
      { property: "og:title", content: `Manage Your Booking | ${BRAND_NAME}` },
      { property: "og:description", content: `View or cancel your ${BRAND_NAME} appointment.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { token } = Route.useParams();
  const b = useQuery(api.appointments.lookup, { token });
  const cancel = useServerFn(cancelBookingByToken);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function cancelAppointment() {
    if (!confirm("Cancel this appointment?")) return;
    setBusy(true);
    const response = await cancel({ data: { token } }).catch(() => ({ ok: false }));
    setBusy(false);
    setMessage(response.ok ? "" : "The booking could not be cancelled. Please try again.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-sm">
        <Link to="/" className="mb-5 inline-block"><BrandLogo className="h-auto w-24" /></Link>
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">[ Your booking ]</p>
        {message && <p role="status" className="mt-3 text-sm text-destructive">{message}</p>}
        {b === undefined && <p className="mt-4 text-sm">Loading…</p>}
        {b === null && <p className="mt-4 text-sm">We couldn't find this booking.</p>}
        {b && (
          <>
            <h1 className="mt-2 text-3xl font-light">{b.service_name}</h1>
            <p className="mt-1 text-sm text-foreground/70">{formatDate(b.start_at)} · {formatTime(b.start_at)} · 30 min</p>
            <p className="mt-4 text-sm">Reference <b className="tracking-widest">{b.reference}</b></p>
            <p className="mt-1 text-sm">Status <b>{STATUS_LABEL[b.status]}</b></p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["pending", "accepted"].includes(b.status) && (
                <button
                  onClick={cancelAppointment}
                  disabled={busy}
                  className="rounded-full border border-destructive px-5 py-2.5 text-sm text-destructive"
                >
                  Cancel appointment
                </button>
              )}
              <Link to="/book" className="rounded-full px-5 py-2.5 text-sm bg-primary text-primary-foreground transition hover:bg-brand-hover">Book another time</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
