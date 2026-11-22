import { useServices } from "@/lib/services";
import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useServiceName } from "@/lib/services";
import { createBooking } from "@/lib/booking.functions";
import { SLOT_CAPACITY, bookingDays, formatDate, formatTime, type ServiceId } from "@/lib/booking";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: `Book an Appointment | ${BRAND_NAME}` },
      { name: "description", content: "Book a 30-minute appointment for prosthetics, orthotics, physiotherapy or outpatient therapy in a few simple steps." },
      { property: "og:title", content: `Book an Appointment | ${BRAND_NAME}` },
      { property: "og:description", content: "Pick your service and a free 30-minute slot online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

const STEPS = ["Your details", "Service", "Date & time", "Review"];

function BookPage() {
  const serviceName = useServiceName();
  const bookable = useServices().filter((s) => s.bookable);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [remind3d, setRemind3d] = useState(false);
  const [remind1d, setRemind1d] = useState(true);
  const [service, setService] = useState<ServiceId | null>(null);
  const days = useMemo(() => bookingDays(Date.now()), []);
  const [day, setDay] = useState(days[0]!);
  const availability = useQuery(api.appointments.availability, step === 2 && service ? { service, day } : "skip");
  const slots = availability ?? [];
  const loadingSlots = step === 2 && availability === undefined;
  const request = useRef<{ details: string; id: string } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ reference: string; token: string } | null>(null);
  const book = useServerFn(createBooking);

  const detailsOk = name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email);
  const canNext = [detailsOk, !!service, !!slot, true][step];

  async function submit() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    const details = { name, email, phone, service, startAt: new Date(slot).toISOString(), remind3d, remind1d };
    const key = JSON.stringify(details);
    if (request.current?.details !== key) request.current = { details: key, id: crypto.randomUUID() };
    const res = await book({ data: { ...details, requestId: request.current.id } })
      .catch(() => ({ ok: false as const, error: "Could not save your booking. Please try again." }));
    setSubmitting(false);
    if (res.ok) setDone({ reference: res.reference, token: res.token });
    else {
      setError(res.error);
      if (res.error.includes("booked")) { setSlot(null); setStep(2); }
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="leading-none">
            <BrandLogo onNavy className="h-auto w-24 sm:w-[126px]" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/30 px-4 py-1.5 text-sm hover:bg-navy-foreground/10">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">[ Booking ]</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight md:text-5xl">Book an Appointment</h1>

        {done ? (
          <div className="mt-10 rounded-2xl bg-card p-8 shadow-sm">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-navy text-navy-foreground"><Check className="h-6 w-6" /></span>
            <h2 className="mt-5 text-2xl font-light">Request received, {name.split(" ")[0]}!</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Your appointment is being reviewed and will usually be approved within 5 minutes. We'll email you at <b>{email}</b> once it's confirmed.
            </p>
            <div className="mt-6 grid gap-3 rounded-xl bg-secondary p-5 text-sm sm:grid-cols-2">
              <div><span className="text-foreground/60">Reference</span><p className="text-lg font-medium tracking-widest">{done.reference}</p></div>
              <div><span className="text-foreground/60">Service</span><p className="font-medium">{serviceName(service!)}</p></div>
              <div><span className="text-foreground/60">When</span><p className="font-medium">{formatDate(slot!)} · {formatTime(slot!)}</p></div>
              <div><span className="text-foreground/60">Duration</span><p className="font-medium">30 minutes</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/manage/$token" params={{ token: done.token }} className="rounded-full border border-foreground/30 px-5 py-2.5 text-sm">Manage booking</Link>
              <Link to="/" className="rounded-full bg-navy px-5 py-2.5 text-sm text-navy-foreground">Back to home</Link>
            </div>
          </div>
        ) : (
          <>
            <ol className="mt-8 grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <div className={cn("h-1.5 rounded-full", i <= step ? "bg-navy" : "bg-border")} />
                  <p className={cn("mt-2 text-xs", i === step ? "font-medium text-foreground" : "text-foreground/50")}>
                    {i + 1}. {s}
                  </p>
                </li>
              ))}
            </ol>

            <div key={step} className="service-detail-in mt-8 rounded-2xl bg-card p-6 shadow-sm md:p-8">
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-light">Tell us who you are</h2>
                  <Field label="Full name" value={name} onChange={setName} placeholder="e.g. Grace Mukamana" />
                  <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                  <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+250 7xx xxx xxx" />
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-light">Choose a service</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {bookable.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setService(s.id)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          service === s.id ? "border-navy bg-navy text-navy-foreground" : "border-border hover:border-navy/50",
                        )}
                      >
                        <p className="font-medium">{s.name}</p>
                        <p className={cn("mt-1 text-xs", service === s.id ? "text-navy-foreground/75" : "text-foreground/60")}>{s.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-light">Pick a date and 30-minute slot</h2>
                  <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                    {days.map((k) => {
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setDay(k); setSlot(null); }}
                          className={cn(
                            "min-w-16 shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition",
                            day === k ? "border-navy bg-navy text-navy-foreground" : "border-border hover:border-navy/50",
                          )}
                        >
                          <span className="block uppercase tracking-wider opacity-70">{new Date(k + "T12:00:00+02:00").toLocaleDateString("en-GB", { weekday: "short", timeZone: "Africa/Kigali" })}</span>
                          <span className="block text-lg font-medium">{Number(k.slice(-2))}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-foreground/60">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-navy-soft" /> Available</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-border" /> Booked</span>
                  </div>
                  {loadingSlots ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-foreground/50" /></div>
                  ) : (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {slots.map((s) => {
                        const unavailable = s.blocked || s.booked >= SLOT_CAPACITY || new Date(s.start_at).getTime() < Date.now();
                        const selected = slot === s.start_at;
                        return (
                          <button
                            key={s.start_at}
                            type="button"
                            disabled={unavailable}
                            onClick={() => setSlot(s.start_at)}
                            className={cn(
                              "rounded-lg px-2 py-2.5 text-sm transition",
                              unavailable && "cursor-not-allowed bg-border/60 text-foreground/35",
                              !unavailable && !selected && "bg-navy-soft/15 font-medium text-navy hover:bg-navy-soft/30",
                              selected && "bg-navy font-medium text-navy-foreground ring-2 ring-navy-soft",
                            )}
                          >
                            {formatTime(s.start_at)}
                            {unavailable && <span className="block text-[10px]">Booked</span>}
                            {!unavailable && s.booked > 0 && <span className="block text-[10px] opacity-70">1 spot left</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-light">Review your booking</h2>
                  <dl className="mt-5 divide-y divide-border text-sm">
                    {[["Name", name], ["Email", email], ["Phone", phone || "—"], ["Service", serviceName(service!)], ["When", `${formatDate(slot!)} · ${formatTime(slot!)} (30 min)`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-3"><dt className="text-foreground/60">{k}</dt><dd className="font-medium">{v}</dd></div>
                    ))}
                  </dl>
                  <div className="mt-6 rounded-xl bg-secondary p-4">
                    <p className="text-sm font-medium">Email reminders once your appointment is approved</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([["Remind me 3 days before", remind3d, setRemind3d], ["Remind me 1 day before", remind1d, setRemind1d]] as const).map(([label, on, set]) => (
                        <button key={label} type="button" aria-pressed={on} onClick={() => set(!on)}
                          className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition", on ? "border-navy bg-navy text-navy-foreground" : "border-border bg-background hover:border-navy/50")}>
                          {on && <Check className="h-4 w-4" />} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

              <div className="mt-8 flex justify-between">
                <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-full border border-foreground/30 px-5 py-2.5 text-sm disabled:opacity-30">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {step < 3 ? (
                  <button type="button" disabled={!canNext} onClick={() => { setError(null); setStep(step + 1); }} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-40 bg-primary text-primary-foreground transition hover:bg-brand-hover">
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" disabled={submitting} onClick={submit} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-40 bg-primary text-primary-foreground transition hover:bg-brand-hover">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm booking
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-widest text-foreground/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-navy"
      />
    </label>
  );
}
