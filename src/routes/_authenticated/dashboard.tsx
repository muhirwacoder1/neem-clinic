import { useServiceName, useServices } from "@/lib/services";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useClerk } from "@clerk/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { clinicError } from "@/integrations/convex/errors";
import {
  CalendarDays, CheckCircle2, Stethoscope, Package, ClipboardList, History, LayoutDashboard, LogOut, Receipt, Search, ShieldBan, Tags, Users, X,
} from "lucide-react";
import { STATUS_LABEL, formatDate, formatTime, kigaliDay } from "@/lib/booking";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { LowStockAlert, Patients, PriceList, Products, type Prefill } from "@/components/dashboard/Billing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Provider Dashboard | ${BRAND_NAME}` },
      { name: "description", content: `Manage appointments, check-ins and staff at ${BRAND_NAME}.` },
      { property: "og:title", content: `Provider Dashboard | ${BRAND_NAME}` },
      { property: "og:description", content: "Manage appointments, check-ins and staff." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Appt = FunctionReturnType<typeof api.appointments.list>[number];
type Role = "super_admin" | "provider" | "checkin";
type Tab = "services" | "overview" | "appointments" | "calendar" | "checkin" | "billing" | "prices" | "products" | "staff" | "blocks" | "activity";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-chart-4/25 text-foreground",
  accepted: "bg-navy-soft/20 text-navy",
  checked_in: "bg-chart-2/25 text-foreground",
  completed: "bg-chart-2/15 text-foreground/70",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-border text-foreground/60",
};

function Dashboard() {
  const { signOut: clerkSignOut } = useClerk();
  const serviceName = useServiceName();
  const me = useQuery(api.staff.me);
  const appts = useQuery(api.appointments.list, me ? {} : "skip");
  const updateAppointment = useMutation(api.appointments.update);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill>(null);
  const openBilling = (a: Appt) => {
    setPrefill({ full_name: a.patient_name, email: a.patient_email, phone: a.patient_phone, appointment_id: a.id });
    setSelectedId(null);
    setTab("billing");
  };

  async function act(a: Appt, patch: Partial<Appt>, _action: string, details = "") {
    try {
      await updateAppointment({
        id: a.id, details,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.start_at ? { startAt: patch.start_at } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      });
      return true;
    } catch (error) {
      alert(clinicError(error));
      return false;
    }
  }

  const signOut = () => clerkSignOut({ redirectUrl: "/provider" });
  if (!me || !appts) return <p className="p-8 text-sm">Loading…</p>;
  const { id: staffId, name: actorName, role } = me;
  const isAdmin = role === "super_admin";
  const staffInfo = me;
  const selected = appts.find((appointment) => appointment.id === selectedId);
  const setSelected = (appointment: Appt | null) => setSelectedId(appointment?.id ?? null);
  const nav: { id: Tab; label: string; icon: typeof Users; admin?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "appointments", label: "Appointments", icon: ClipboardList },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "checkin", label: "Today's check-in", icon: CheckCircle2 },
    { id: "billing", label: "Patients & billing", icon: Receipt },
    { id: "services", label: "Services", icon: Stethoscope, admin: true },
    { id: "prices", label: "Price list", icon: Tags, admin: true },
    { id: "products", label: "Products & stock", icon: Package, admin: true },
    { id: "staff", label: "Staff & roles", icon: Users, admin: true },
    { id: "blocks", label: "Blocked slots", icon: ShieldBan, admin: true },
    { id: "activity", label: "Activity log", icon: History, admin: true },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-navy p-6 text-navy-foreground md:flex">
        <Link to="/" className="leading-none">
          <BrandLogo onNavy className="mb-2 h-auto w-28" />
          <span className="block text-[10px] uppercase tracking-[0.35em]">Provider</span>
        </Link>
        <nav className="mt-10 space-y-1">
          {nav.filter((n) => !n.admin || isAdmin).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition", tab === n.id ? "bg-navy-foreground/15" : "hover:bg-navy-foreground/10")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-navy-foreground/15 pt-4 text-xs">
          <p className="font-medium">{actorName}</p>
          <p className="text-navy-foreground/60">{isAdmin ? "Super admin" : role === "checkin" ? "Check-in desk" : `Provider${me?.service ? " · " + serviceName(me.service) : ""}`}</p>
          <button onClick={signOut} className="mt-3 inline-flex items-center gap-2 text-navy-foreground/80 hover:text-navy-foreground"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-10">
        <Link to="/" className="mb-5 inline-block md:hidden"><BrandLogo className="h-auto w-24" /></Link>
        <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
          {nav.filter((n) => !n.admin || isAdmin).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-xs", tab === n.id ? "bg-navy text-navy-foreground" : "bg-card")}>{n.label}</button>
          ))}
        </div>
        {tab === "overview" && isAdmin && <LowStockAlert />}
        {tab === "overview" && <Overview appts={appts} onOpen={setSelected} />}
        {tab === "appointments" && <AppointmentList appts={appts} onOpen={setSelected} act={act} />}
        {tab === "calendar" && <CalendarView appts={appts} onOpen={setSelected} />}
        {tab === "checkin" && <CheckIn appts={appts} act={act} onBill={openBilling} />}
        {tab === "billing" && <Patients staff={staffInfo} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
        {tab === "services" && isAdmin && <ServicesAdmin goStaff={() => setTab("staff")} />}
        {tab === "prices" && isAdmin && <PriceList />}
        {tab === "products" && isAdmin && <Products />}
        {tab === "staff" && isAdmin && <Staff selfId={staffId} />}
        {tab === "blocks" && isAdmin && <Blocks />}
        {tab === "activity" && isAdmin && <Activity />}
      </main>

      {selected && <Detail key={selected.id} a={selected} all={appts} onClose={() => setSelected(null)} act={act} />}
    </div>
  );
}

type ActFn = (a: Appt, patch: Partial<Appt>, action: string, details?: string) => Promise<boolean>;

function Heading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">[{label}]</p>
      <h1 className="mt-1 text-3xl font-light tracking-tight md:text-4xl">{title}</h1>
    </div>
  );
}

function Badge({ s }: { s: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[s])}>{STATUS_LABEL[s]}</span>;
}

function Overview({ appts, onOpen }: { appts: Appt[]; onOpen: (a: Appt) => void }) {
  const serviceName = useServiceName();
  const today = kigaliDay(new Date());
  const todays = appts.filter((a) => kigaliDay(new Date(a.start_at)) === today);
  const count = (s: string, list = todays) => list.filter((a) => a.status === s).length;
  const pending = appts.filter((a) => a.status === "pending" && new Date(a.start_at) > new Date());
  const cards = [
    ["Today", todays.filter((a) => !["cancelled", "declined"].includes(a.status)).length],
    ["Awaiting review", pending.length],
    ["Checked in today", count("checked_in")],
    ["Cancelled today", count("cancelled")],
  ] as const;
  return (
    <>
      <Heading label="01" title="Good day — here's the clinic" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([l, v], i) => (
          <div key={l} className={cn("rounded-2xl p-5", i === 1 ? "bg-navy text-navy-foreground" : "bg-card")}>
            <p className="text-xs uppercase tracking-widest opacity-70">{l}</p>
            <p className="mt-3 text-4xl font-light">{v}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-lg font-medium">Needs your review</h2>
      <div className="mt-3 overflow-hidden rounded-2xl bg-card">
        {pending.length === 0 && <p className="p-6 text-sm text-foreground/60">Nothing waiting. Nice work.</p>}
        {pending.slice(0, 8).map((a) => (
          <button key={a.id} onClick={() => onOpen(a)} className="flex w-full items-center justify-between border-b border-border px-5 py-3 text-left text-sm last:border-0 hover:bg-secondary">
            <span><b className="font-medium">{a.patient_name}</b> · {serviceName(a.service)}</span>
            <span className="text-foreground/60">{formatDate(a.start_at)} {formatTime(a.start_at)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function AppointmentList({ appts, onOpen, act }: { appts: Appt[]; onOpen: (a: Appt) => void; act: ActFn }) {
  const serviceName = useServiceName();
  const services = useServices();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [service, setService] = useState("all");
  const [date, setDate] = useState("");
  const list = appts.filter((a) =>
    (status === "all" || a.status === status) &&
    (service === "all" || a.service === service) &&
    (!date || kigaliDay(new Date(a.start_at)) === date) &&
    (!q || `${a.patient_name} ${a.patient_email} ${a.reference}`.toLowerCase().includes(q.toLowerCase())),
  );
  const sel = "rounded-lg border border-input bg-card px-3 py-2 text-sm";
  return (
    <>
      <Heading label="02" title="Appointments" />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-foreground/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or reference" className="w-full bg-transparent outline-none" />
        </label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={sel} />
        <select value={service} onChange={(e) => setService(e.target.value)} className={sel}>
          <option value="all">All services</option>
          {services.filter((x) => x.id !== "reception").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50">
            <tr><th className="p-4">Patient</th><th className="p-4">Service</th><th className="p-4">When</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-4"><button onClick={() => onOpen(a)} className="text-left"><b className="font-medium">{a.patient_name}</b><span className="block text-xs text-foreground/50">{a.patient_email}</span></button></td>
                <td className="p-4">{serviceName(a.service)}</td>
                <td className="p-4 whitespace-nowrap">{formatDate(a.start_at)} · {formatTime(a.start_at)}</td>
                <td className="p-4"><Badge s={a.status} /></td>
                <td className="p-4 text-right whitespace-nowrap">
                  {a.status === "pending" && (
                    <>
                      <button onClick={() => act(a, { status: "accepted" }, "accepted")} className="rounded-full bg-navy px-3 py-1 text-xs text-navy-foreground">Accept</button>
                      <button onClick={() => act(a, { status: "declined" }, "declined")} className="ml-2 rounded-full border border-border px-3 py-1 text-xs">Decline</button>
                    </>
                  )}
                  {a.status !== "pending" && <button onClick={() => onOpen(a)} className="rounded-full border border-border px-3 py-1 text-xs">Open</button>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-foreground/60">No appointments match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CalendarView({ appts, onOpen }: { appts: Appt[]; onOpen: (a: Appt) => void }) {
  const serviceName = useServiceName();
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    return Array.from({ length: 6 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [offset]);
  return (
    <>
      <Heading label="03" title="Week calendar" />
      <div className="mb-4 flex gap-2">
        <button onClick={() => setOffset(offset - 1)} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">← Prev</button>
        <button onClick={() => setOffset(0)} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">This week</button>
        <button onClick={() => setOffset(offset + 1)} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">Next →</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {days.map((d) => {
          const k = kigaliDay(d);
          const list = appts.filter((a) => kigaliDay(new Date(a.start_at)) === k && !["cancelled", "declined"].includes(a.status));
          return (
            <div key={k} className="rounded-2xl bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-foreground/50">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
              <div className="mt-3 space-y-2">
                {list.length === 0 && <p className="text-xs text-foreground/40">No visits</p>}
                {list.map((a) => (
                  <button key={a.id} onClick={() => onOpen(a)} className={cn("block w-full rounded-lg px-3 py-2 text-left text-xs", a.status === "pending" ? "bg-chart-4/20" : "bg-navy-soft/15")}>
                    <b className="font-medium">{formatTime(a.start_at)}</b> {a.patient_name}
                    <span className="block text-foreground/60">{serviceName(a.service)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CheckIn({ appts, act, onBill }: { appts: Appt[]; act: ActFn; onBill: (a: Appt) => void }) {
  const serviceName = useServiceName();
  const today = kigaliDay(new Date());
  const list = appts.filter((a) => kigaliDay(new Date(a.start_at)) === today && ["accepted", "pending", "checked_in"].includes(a.status));
  return (
    <>
      <Heading label="04" title="Today's arrivals" />
      <div className="grid gap-3 md:grid-cols-2">
        {list.length === 0 && <p className="text-sm text-foreground/60">No one is scheduled for today.</p>}
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-2xl bg-card p-5">
            <div>
              <p className="text-lg font-light">{formatTime(a.start_at)} · {a.patient_name}</p>
              <p className="text-xs text-foreground/60">{serviceName(a.service)} · Ref {a.reference}</p>
            </div>
            {a.status === "checked_in" ? (
              <div className="flex items-center gap-2">
                <Badge s="checked_in" />
                <button onClick={() => onBill(a)} className="rounded-full bg-navy px-3 py-2 text-xs text-navy-foreground">Register / Bill</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={async () => { if (await act(a, { status: "checked_in" }, "checked_in")) onBill(a); }} className="rounded-full bg-navy px-4 py-2 text-sm text-navy-foreground">Arrived</button>
                <button onClick={() => act(a, { status: "no_show" }, "no_show")} className="rounded-full border border-border px-3 py-2 text-xs">No-show</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Detail({ a, all, onClose, act }: { a: Appt; all: Appt[]; onClose: () => void; act: ActFn }) {
  const serviceName = useServiceName();
  const [notes, setNotes] = useState(a.notes);
  const [newTime, setNewTime] = useState("");
  const history = all.filter((x) => x.patient_email === a.patient_email && x.id !== a.id);
  const btn = "rounded-full px-4 py-2 text-xs";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30" onClick={onClose}>
      <div className="service-detail-in h-full w-full max-w-md overflow-y-auto bg-card p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Ref {a.reference}</p>
            <h2 className="mt-1 text-2xl font-light">{a.patient_name}</h2>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-2"><Badge s={a.status} /></div>
        <dl className="mt-6 space-y-2 text-sm">
          <div><dt className="text-foreground/50">Email</dt><dd>{a.patient_email}</dd></div>
          <div><dt className="text-foreground/50">Phone</dt><dd>{a.patient_phone || "—"}</dd></div>
          <div><dt className="text-foreground/50">Service</dt><dd>{serviceName(a.service)}</dd></div>
          <div><dt className="text-foreground/50">When</dt><dd>{formatDate(a.start_at)} · {formatTime(a.start_at)} (30 min)</dd></div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {a.status === "pending" && <button onClick={() => act(a, { status: "accepted" }, "accepted")} className={cn(btn, "bg-navy text-navy-foreground")}>Accept</button>}
          {a.status === "pending" && <button onClick={() => act(a, { status: "declined" }, "declined")} className={cn(btn, "border border-border")}>Decline</button>}
          {["accepted", "pending"].includes(a.status) && <button onClick={() => act(a, { status: "checked_in" }, "checked_in")} className={cn(btn, "border border-border")}>Checked in</button>}
          {["accepted", "checked_in"].includes(a.status) && <button onClick={() => act(a, { status: "completed" }, "completed")} className={cn(btn, "border border-border")}>Completed</button>}
          {["accepted", "pending"].includes(a.status) && <button onClick={() => act(a, { status: "no_show" }, "no_show")} className={cn(btn, "border border-border")}>No-show</button>}
          {["accepted", "pending"].includes(a.status) && <button onClick={() => confirm("Cancel this appointment?") && act(a, { status: "cancelled" }, "cancelled")} className={cn(btn, "border border-destructive text-destructive")}>Cancel</button>}
        </div>

        {["accepted", "pending"].includes(a.status) && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Reschedule</p>
            <div className="mt-2 flex gap-2">
              <input type="datetime-local" step={1800} value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1 rounded-lg border border-input px-3 py-2 text-sm" />
              <button
                disabled={!newTime}
                onClick={() => {
                  const d = new Date(newTime + ":00+02:00");
                  if (d.getUTCMinutes() % 30) return alert("Pick a time on the hour or half hour.");
                  act(a, { start_at: d.toISOString() }, "rescheduled", `${formatDate(a.start_at)} ${formatTime(a.start_at)} → ${formatDate(d.toISOString())} ${formatTime(d.toISOString())}`);
                  setNewTime("");
                }}
                className={cn(btn, "bg-navy text-navy-foreground disabled:opacity-40")}
              >Move</button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Private note</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-input p-3 text-sm" />
          <button onClick={() => act(a, { notes }, "note", "Note updated")} className={cn(btn, "mt-2 border border-border")}>Save note</button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Past & other visits</p>
          {history.length === 0 && <p className="mt-2 text-sm text-foreground/50">First visit.</p>}
          {history.map((h) => (
            <p key={h.id} className="mt-2 flex justify-between text-sm"><span>{serviceName(h.service)} · {formatDate(h.start_at)}</span><Badge s={h.status} /></p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Staff({ selfId }: { selfId: string }) {
  const services = useServices();
  const rows = useQuery(api.staff.list) ?? [];
  const [form, setForm] = useState({ fullName: "", email: "", role: "provider" as Role, service: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invite = useAction(api.staff.invite);
  const update = useMutation(api.staff.update);
  const remove = useMutation(api.staff.remove);

  async function inviteStaff(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const sent = await invite({ ...form, service: form.role === "provider" ? form.service || null : null });
      setMsg(sent ? "Staff invitation sent." : "Access was prepared, but Clerk did not send the invitation. Check Clerk and try again.");
      if (sent) setForm({ ...form, fullName: "", email: "" });
    } catch (error) {
      setMsg(clinicError(error));
    } finally {
      setBusy(false);
    }
  }

  const inp = "rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <>
      <Heading label="05" title="Staff & roles" />
      <form
        onSubmit={inviteStaff}
        className="grid gap-3 rounded-2xl bg-card p-5 md:grid-cols-5"
      >
        <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inp} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inp}>
          <option value="provider">Provider</option><option value="checkin">Check-in desk</option><option value="super_admin">Super admin</option>
        </select>
        <select disabled={form.role !== "provider"} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className={inp}>
          <option value="">All services</option>
          {services.filter((x) => x.id !== "reception").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button disabled={busy} className="rounded-full bg-navy px-4 py-2 text-sm text-navy-foreground">Invite staff</button>
      </form>
      {msg && <p className="mt-3 text-sm text-foreground/70">{msg}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50"><tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Service</th><th className="p-4" /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-4"><b className="font-medium">{s.full_name || "—"}</b><span className="block text-xs text-foreground/50">{s.email}{s.invited ? " · Awaiting sign-in" : ""}</span></td>
                <td className="p-4">
                  <select disabled={s.id === selfId} value={s.role ?? ""} onChange={async (e) => { await update({ userId: s.id, role: e.target.value as Role, service: s.service }).catch((error) => setMsg(clinicError(error))); }} className={inp}>
                    <option value="" disabled>No role</option><option value="provider">Provider</option><option value="checkin">Check-in desk</option><option value="super_admin">Super admin</option>
                  </select>
                </td>
                <td className="p-4">
                  <select disabled={s.role !== "provider"} value={s.service ?? ""} onChange={async (e) => { await update({ userId: s.id, role: s.role ?? "provider", service: e.target.value || null }).catch((error) => setMsg(clinicError(error))); }} className={inp}>
                    <option value="">All services</option>
                    {services.filter((x) => x.id !== "reception").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td className="p-4 text-right">
                  {s.id !== selfId && <button onClick={async () => { if (confirm(`Remove ${s.full_name}?`)) { await remove({ userId: s.id }).catch((error) => setMsg(clinicError(error))); } }} className="text-xs text-destructive">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Blocks() {
  const serviceName = useServiceName();
  const services = useServices();
  const [fromNow] = useState(() => new Date().toISOString());
  const rows = useQuery(api.appointments.listBlocks, { from: fromNow }) ?? [];
  const block = useMutation(api.appointments.block);
  const unblock = useMutation(api.appointments.unblock);
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("17:00");
  const [service, setService] = useState("");
  const [reason, setReason] = useState("");
  const inp = "rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <>
      <Heading label="06" title="Blocked slots & closed days" />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const start = new Date(`${date}T${from}:00+02:00`);
          const end = new Date(`${date}T${to}:00+02:00`);
          const inserts = [];
          for (let t = start.getTime(); t < end.getTime(); t += 30 * 60000)
            inserts.push(new Date(t).toISOString());
          if (inserts.length) await block({ slots: inserts, service: service || null, reason }).catch((error) => alert(clinicError(error)));
        }}
        className="flex flex-wrap gap-3 rounded-2xl bg-card p-5"
      >
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
        <input type="time" step={1800} value={from} onChange={(e) => setFrom(e.target.value)} className={inp} />
        <input type="time" step={1800} value={to} onChange={(e) => setTo(e.target.value)} className={inp} />
        <select value={service} onChange={(e) => setService(e.target.value)} className={inp}>
          <option value="">All services</option>
          {services.filter((x) => x.id !== "reception").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="Reason (e.g. Holiday)" value={reason} onChange={(e) => setReason(e.target.value)} className={cn(inp, "flex-1")} />
        <button className="rounded-full bg-navy px-5 py-2 text-sm text-navy-foreground">Block</button>
      </form>
      <div className="mt-6 space-y-2">
        {rows.length === 0 && <p className="text-sm text-foreground/60">No upcoming blocks.</p>}
        {rows.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl bg-card px-5 py-3 text-sm">
            <span>{formatDate(b.start_at)} · {formatTime(b.start_at)} · {b.service ? serviceName(b.service) : "All services"} {b.reason && `— ${b.reason}`}</span>
            <button onClick={async () => { await unblock({ id: b.id }).catch((error) => alert(clinicError(error))); }} className="text-xs text-destructive">Unblock</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Activity() {
  const all = useQuery(api.catalog.activity) ?? [];
  const [cat, setCat] = useState("all");
  const rows = all.filter((r) => cat === "all" || r.category === cat);
  return (
    <>
      <Heading label="07" title="Activity log" />
      <div className="mb-4 flex flex-wrap gap-2">
        {([["all", "All"], ["booking", "Bookings"], ["billing", "Billing"], ["prices", "Prices"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setCat(k as string)} className={cn("rounded-full px-4 py-1.5 text-xs", cat === k ? "bg-navy text-navy-foreground" : "bg-card")}>{l}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        {rows.length === 0 && <p className="p-6 text-sm text-foreground/60">No activity yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border px-5 py-3 text-sm last:border-0">
            <span><b className="font-medium">{r.actor_name}</b> {r.action.replace("_", " ")} {r.appointments && <>· {r.appointments.patient_name} ({r.appointments.reference})</>} {r.details && <span className="text-foreground/50">— {r.details}</span>}</span>
            <span className="text-xs text-foreground/50">{new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Africa/Kigali" })}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ServicesAdmin({ goStaff }: { goStaff: () => void }) {
  const list = useServices(true);
  const [form, setForm] = useState({ name: "", description: "", bookable: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", bookable: true, details: "", image_url: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const rows = useQuery(api.staff.list) ?? [];
  const counts: Record<string, number> = {};
  for (const { service, role } of rows) {
    if (service && role === "provider") counts[service] = (counts[service] ?? 0) + 1;
  }
  const homeCount = list.filter((x) => x.show_on_home && x.active).length;
  const inp = "rounded-lg border border-input bg-background px-3 py-2 text-sm";
  const update = useMutation(api.catalog.updateService);
  const add = useMutation(api.catalog.addService);
  const save = async (id: string, patch: { name?: string; description?: string; bookable?: boolean; active?: boolean; show_on_home?: boolean; details?: string; image_url?: string }) => {
    try {
      await update({ id, patch });
      setMsg("Saved.");
      return true;
    } catch (error) {
      setMsg(clinicError(error));
      return false;
    }
  };
  return (
    <>
      <Heading label="04" title="Services" />
      <p className="mb-4 max-w-2xl text-sm text-foreground/60">Add the services your clinic offers. Bookable services appear on the online booking page. Switch on "On home page" for up to 8 popular services to feature them on the website. Each new service also becomes a billing department — add its prices in Price list, and assign providers to it in Staff &amp; roles.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await add(form);
            setMsg(`${form.name} added.`);
            setForm({ name: "", description: "", bookable: true });
          } catch (error) {
            setMsg(clinicError(error));
          }
        }}
        className="grid gap-3 rounded-2xl bg-card p-5 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-center"
      >
        <input required placeholder="Service name (e.g. Speech therapy)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
        <input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.bookable} onChange={(e) => setForm({ ...form, bookable: e.target.checked })} /> Bookable online</label>
        <button className="rounded-full bg-navy px-4 py-2 text-sm text-navy-foreground">Add service</button>
      </form>
      {msg && <p className="mt-3 text-sm text-foreground/70">{msg}</p>}
      <div className="mt-6 space-y-3">
        {list.map((s) => (
          <div key={s.id} className={cn("rounded-2xl bg-card p-5", !s.active && "opacity-60")}>
            {editing === s.id ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} />
                <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inp} />
                <textarea placeholder="Longer details shown on the home page" value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} className={cn(inp, "sm:col-span-2")} rows={2} />
                <input type="url" placeholder="Photo link for the home page (optional, https://…)" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value.trim() })} className={cn(inp, "sm:col-span-2")} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.bookable} onChange={(e) => setDraft({ ...draft, bookable: e.target.checked })} /> Bookable online</label>
                <div className="flex gap-2 sm:justify-end">
                  <button onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-1.5 text-xs">Cancel</button>
                  <button onClick={async () => { if (await save(s.id, draft)) setEditing(null); }} className="rounded-full bg-navy px-4 py-1.5 text-xs text-navy-foreground">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name} {!s.active && <span className="text-xs text-foreground/50">(hidden)</span>}</p>
                  <p className="text-xs text-foreground/60">{s.description || "No description"}</p>
                  <p className="mt-1 text-xs text-foreground/50">{s.bookable ? "Bookable online" : "Not bookable online"} · {counts[s.id] ?? 0} provider{(counts[s.id] ?? 0) === 1 ? "" : "s"}</p>
                </div>
                {s.id !== "reception" && s.active && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <button type="button" role="switch" aria-checked={s.show_on_home} aria-label={`Show ${s.name} on home page`}
                      onClick={() => { if (!s.show_on_home && homeCount >= 8) return setMsg("The home page can show up to 8 services. Turn one off first."); save(s.id, { show_on_home: !s.show_on_home }); }}
                      className={cn("relative h-5 w-9 rounded-full transition", s.show_on_home ? "bg-navy" : "bg-border")}>
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all", s.show_on_home ? "left-[18px]" : "left-0.5")} />
                    </button>
                    On home page
                  </label>
                )}
                {s.id !== "reception" && <button onClick={goStaff} className="rounded-full border border-border px-3 py-1.5 text-xs">Add provider</button>}
                <button onClick={() => { setEditing(s.id); setDraft({ name: s.name, description: s.description, bookable: s.bookable, details: s.details, image_url: s.image_url }); }} className="rounded-full border border-border px-3 py-1.5 text-xs">Edit</button>
                {s.id !== "reception" && <button onClick={() => save(s.id, { active: !s.active })} className="rounded-full border border-border px-3 py-1.5 text-xs">{s.active ? "Hide" : "Show"}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
