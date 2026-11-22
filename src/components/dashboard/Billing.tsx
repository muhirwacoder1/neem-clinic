import { useServices } from "@/lib/services";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { clinicError } from "@/integrations/convex/errors";
import { Mail, Package, Pencil, Phone, Plus, Printer, Search, Trash2, X } from "lucide-react";
import {
  PAYMENT_METHODS, PAY_CODE, PAY_HREF, allowedDepartments, formatRWF, paymentName,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

export type Staff = { id: string; name: string; role: string; service: string | null };
type Item = { id: string; department: string; name: string; price: number; description: string; active: boolean };
export type Patient = {
  id: string; full_name: string; email: string; phone: string; location: string; date_of_birth: string | null;
  sex: string; insurance: string; emergency_contact: string; national_id: string; created_at: string;
};
type Bill = {
  id: string; number: number; status: string; payment_method: string | null; total: number; created_at: string;
  created_by_name: string; paid_by_name: string; paid_at: string | null; appointment_id: string | null;
  current_department: string; payment_reference: string; finalized_by_name: string;
  bill_items: { id: string; name: string; department: string; unit_price: number; quantity: number }[];
};
export type Prefill = { full_name: string; email: string; phone: string; appointment_id: string } | null;

const inp = "rounded-lg border border-input bg-background px-3 py-2 text-sm";
const btn = "rounded-full px-4 py-2 text-xs";

function Heading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">[{label}]</p>
      <h1 className="mt-1 text-3xl font-light tracking-tight md:text-4xl">{title}</h1>
    </div>
  );
}

/* ---------------- Price list ---------------- */

export function PriceList() {
  const departments = useServices();
  const items = useQuery(api.catalog.priceList, { activeOnly: false }) ?? [];
  const [editing, setEditing] = useState<Item | null>(null);
  const empty = { department: "", name: "", price: 0, description: "" };
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState<string | null>(null);
  const savePrice = useMutation(api.catalog.savePrice);
  const archive = useMutation(api.catalog.archivePrice);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const department = form.department || departments[0]?.id;
    if (!department) return setMsg("Create a service before adding prices.");
    try {
      await savePrice({ item: { ...form, department, price: Math.round(form.price), active: true } });
      setForm(empty);
      setMsg("Service added.");
    } catch (error) {
      setMsg(clinicError(error));
    }
  }
  async function update(item: Item) {
    const { id, name, department, price, description, active } = item;
    try {
      await savePrice({ id, item: { name, department, price: Math.round(price), description, active } });
      setEditing(null);
    } catch (error) {
      setMsg(clinicError(error));
    }
  }
  async function remove(item: Item) {
    if (!confirm(`Remove "${item.name}" from the price list?`)) return;
    await archive({ id: item.id }).catch((error) => setMsg(clinicError(error)));
  }

  return (
    <>
      <Heading label="08" title="Price list" />
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-card p-5 md:grid-cols-6">
        <select value={form.department || departments[0]?.id || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inp}>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input required placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cn(inp, "md:col-span-2")} />
        <input required type="number" min={0} placeholder="Price (RWF)" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inp} />
        <input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
        <button className="inline-flex items-center justify-center gap-1 rounded-full bg-navy px-4 py-2 text-sm text-navy-foreground"><Plus className="h-4 w-4" /> Add service</button>
      </form>
      {msg && <p className="mt-3 text-sm text-foreground/70">{msg}</p>}

      <div className="mt-6 space-y-6">
        {departments.map((d) => {
          const list = items.filter((i) => i.department === d.id);
          if (!list.length) return null;
          return (
            <div key={d.id} className="overflow-x-auto rounded-2xl bg-card">
              <p className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-widest text-foreground/60">{d.name}</p>
              <table className="w-full text-sm">
                <tbody>
                  {list.map((i) => editing?.id === i.id ? (
                    <tr key={i.id} className="border-t border-border first:border-0">
                      <td className="p-3"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={cn(inp, "w-full")} />
                        <input value={editing.description} placeholder="Description" onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={cn(inp, "mt-2 w-full")} /></td>
                      <td className="p-3"><select value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} className={inp}>
                        {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
                      <td className="p-3"><input type="number" min={0} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className={cn(inp, "w-32")} /></td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => { if (editing) void update(editing); }} className={cn(btn, "bg-navy text-navy-foreground")}>Save</button>
                        <button onClick={() => setEditing(null)} className={cn(btn, "ml-2 border border-border")}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i.id} className={cn("border-t border-border first:border-0", !i.active && "opacity-50")}>
                      <td className="p-4"><b className="font-medium">{i.name}</b>{i.description && <span className="block text-xs text-foreground/50">{i.description}</span>}</td>
                      <td className="p-4 text-foreground/60">{i.active ? "Visible" : "Hidden"}</td>
                      <td className="p-4 whitespace-nowrap font-medium">{formatRWF(i.price)}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(i)} className={cn(btn, "inline-flex items-center gap-1 border border-border")}><Pencil className="h-3 w-3" /> Edit</button>
                        <button onClick={() => update({ ...i, active: !i.active })} className={cn(btn, "ml-2 border border-border")}>{i.active ? "Hide" : "Show"}</button>
                        <button onClick={() => remove(i)} aria-label="Delete" className="ml-2 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Patients & billing ---------------- */

const blankPatient = { full_name: "", email: "", phone: "", location: "", date_of_birth: "", sex: "", insurance: "", emergency_contact: "", national_id: "" };

export function Patients({ staff, prefill, clearPrefill }: { staff: Staff; prefill: Prefill; clearPrefill: () => void }) {
  const result = useQuery(api.billing.patients);
  const patients = result ?? [];
  const savePatient = useMutation(api.billing.savePatient);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Patient | null>(null);
  const [apptId, setApptId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankPatient);

  useEffect(() => {
    if (!prefill || !result) return;
    setApptId(prefill.appointment_id);
    const match = result.find((p) => (prefill.email && p.email.toLowerCase() === prefill.email.toLowerCase()) || (prefill.phone && p.phone === prefill.phone));
    if (match) setOpen(match);
    else {
      setForm({ ...blankPatient, full_name: prefill.full_name, email: prefill.email, phone: prefill.phone });
      setShowForm(true);
    }
    clearPrefill();
  }, [prefill, result, clearPrefill]);

  const list = patients.filter((p) => !q || `${p.full_name} ${p.phone} ${p.email} ${p.national_id}`.toLowerCase().includes(q.toLowerCase()));

  async function register(e: React.FormEvent) {
    e.preventDefault();
    try {
      const patient = await savePatient({ patient: { ...form, date_of_birth: form.date_of_birth || null } });
      setForm(blankPatient);
      setShowForm(false);
      setOpen(patient);
    } catch (error) {
      alert(clinicError(error));
    }
  }

  return (
    <>
      <Heading label="09" title="Patients & billing" />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-foreground/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email or ID" className="w-full bg-transparent outline-none" />
        </label>
        <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-1 rounded-full bg-navy px-5 py-2 text-sm text-navy-foreground"><Plus className="h-4 w-4" /> Register patient</button>
      </div>

      <WaitingQueue onOpen={(id) => { const m = patients.find((x) => x.id === id); if (m) { setApptId(null); setOpen(m); } }} />

      {showForm && (
        <form onSubmit={register} className="mb-6 grid gap-3 rounded-2xl bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
          <input required placeholder="Full name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inp} />
          <input required placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
          <input placeholder="Where from (district / city)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inp} />
          <label className="flex items-center gap-2 text-xs text-foreground/60">Date of birth
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={cn(inp, "flex-1")} /></label>
          <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className={inp}>
            <option value="">Sex</option><option>Female</option><option>Male</option>
          </select>
          <input placeholder="Insurance (optional)" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} className={inp} />
          <input placeholder="Emergency contact" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} className={inp} />
          <input placeholder="National ID (optional)" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} className={inp} />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button className="rounded-full bg-navy px-5 py-2 text-sm text-navy-foreground">Save patient</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-border px-5 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50">
            <tr><th className="p-4">Patient</th><th className="p-4">Phone</th><th className="p-4">From</th><th className="p-4">Insurance</th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer border-t border-border hover:bg-secondary">
                <td className="p-4"><b className="font-medium">{p.full_name}</b><span className="block text-xs text-foreground/50">{p.email}</span></td>
                <td className="p-4">{p.phone}</td>
                <td className="p-4">{p.location || "—"}</td>
                <td className="p-4">{p.insurance || "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-foreground/60">No patients yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <PatientPanel p={open} staff={staff} appointmentId={apptId} onClose={() => { setOpen(null); setApptId(null); }} onSaved={setOpen} />}
    </>
  );
}

function PatientPanel({ p, staff, appointmentId, onClose, onSaved }: {
  p: Patient; staff: Staff; appointmentId: string | null; onClose: () => void; onSaved: (p: Patient) => void;
}) {
  const bills = useQuery(api.billing.patientBills, { patientId: p.id }) ?? [];
  const priceList = useQuery(api.catalog.priceList, { activeOnly: true }) ?? [];
  const departments = useServices();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(p);
  const allowed = allowedDepartments(staff.role, staff.service, departments);
  const items = priceList.filter((item) => allowed.includes(item.department));
  const savePatient = useMutation(api.billing.savePatient);
  const openBill = useAction(api.billing.open);
  const [opening, setOpening] = useState(false);
  useEffect(() => setF(p), [p]);

  async function saveInfo() {
    const { id, full_name, email, phone, location, date_of_birth, sex, insurance, emergency_contact, national_id } = f;
    try {
      const updated = await savePatient({ id, patient: { full_name, email, phone, location, date_of_birth: date_of_birth || null, sex, insurance, emergency_contact, national_id } });
      setEdit(false);
      onSaved(updated);
    } catch (error) {
      alert(clinicError(error));
    }
  }

  async function newBill() {
    const department = allowed[0];
    if (!department) return alert("You have no billing department.");
    setOpening(true);
    try {
      await openBill({ patientId: p.id, appointmentId, department });
    } catch (error) {
      alert(clinicError(error));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30" onClick={onClose}>
      <div className="service-detail-in h-full w-full max-w-xl overflow-y-auto bg-card p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Patient</p>
            <h2 className="mt-1 text-2xl font-light">{p.full_name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {!edit ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {([["Phone", p.phone], ["Email", p.email], ["From", p.location], ["Date of birth", p.date_of_birth], ["Sex", p.sex],
              ["Insurance", p.insurance], ["Emergency contact", p.emergency_contact], ["National ID", p.national_id]] as const).map(([k, v]) => (
              <div key={k}><dt className="text-foreground/50">{k}</dt><dd>{v || "—"}</dd></div>
            ))}
            <button onClick={() => setEdit(true)} className={cn(btn, "col-span-2 inline-flex w-fit items-center gap-1 border border-border")}><Pencil className="h-3 w-3" /> Edit details</button>
          </dl>
        ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(["full_name", "phone", "email", "location", "sex", "insurance", "emergency_contact", "national_id"] as const).map((k) => (
              <input key={k} placeholder={k.replace("_", " ")} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inp} />
            ))}
            <input type="date" value={f.date_of_birth ?? ""} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} className={inp} />
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={saveInfo} className={cn(btn, "bg-navy text-navy-foreground")}>Save</button>
              <button onClick={() => { setF(p); setEdit(false); }} className={cn(btn, "border border-border")}>Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Bills</p>
          <button onClick={newBill} disabled={opening || !allowed.length} className={cn(btn, "inline-flex items-center gap-1 bg-navy text-navy-foreground")}><Plus className="h-3 w-3" /> New bill</button>
        </div>
        {bills.length === 0 && <p className="mt-3 text-sm text-foreground/50">No bills yet.</p>}
        <div className="mt-3 space-y-4">
          {bills.map((b) => <BillCard key={b.id} b={b} items={items} staff={staff} patient={p} />)}
        </div>
      </div>
    </div>
  );
}

type Product = {
  id: string; name: string; category: string; price: number; stock: number; low_stock_level: number;
  image_url: string; description: string; show_on_site: boolean; active: boolean;
};

const STATUS_TEXT: Record<string, string> = { unpaid: "Open", awaiting_payment: "Awaiting payment", paid: "Paid · final", cancelled: "Cancelled" };

function BillCard({ b, items, staff, patient }: { b: Bill; items: Item[]; staff: Staff; patient: Patient }) {
  const departments = useServices();
  const departmentName = (id: string) => departments.find((department) => department.id === id)?.name ?? id;
  const canEdit = staff.role === "super_admin" ||
    (staff.role === "checkin"
      ? b.current_department === "reception"
      : b.current_department !== "reception" && (!staff.service || staff.service === b.current_department));
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [pq, setPq] = useState("");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("mobile_money");
  const [ref, setRef] = useState("");
  const [step, setStep] = useState<"idle" | "ask" | "handoff">("idle");
  const [nextDept, setNextDept] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const products = useQuery(api.catalog.searchProducts, b.status === "unpaid" && canEdit && pq.trim() ? { term: pq.trim() } : "skip") ?? [];
  const send = useMutation(api.billing.resend);
  const finalize = useMutation(api.billing.finalize);
  const pay = useMutation(api.billing.markPaid);
  const append = useMutation(api.billing.addItem);
  const remove = useMutation(api.billing.removeItem);
  const transfer = useMutation(api.billing.handoff);
  const cancel = useMutation(api.billing.cancel);
  const grouped = departments
    .filter((department) => staff.role === "super_admin" || department.id === b.current_department)
    .map((d) => ({ d, list: items.filter((item) => item.department === d.id) }))
    .filter((group) => group.list.length);

  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setNote(null);
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setNote(clinicError(error));
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!itemId) return;
    await run(async () => {
      await append({ billId: b.id, itemId, product: false, quantity: qty });
      setItemId("");
      setQty(1);
    });
  }
  async function addProduct(product: Product) {
    const quantity = Number(prompt(`How many "${product.name}"? (${product.stock} in stock)`, "1"));
    if (!quantity || quantity < 1) return;
    await run(async () => {
      await append({ billId: b.id, itemId: product.id, product: true, quantity });
      setPq("");
    });
  }
  const removeItem = (itemId: string) => run(() => remove({ billId: b.id, itemId }));

  async function handoff() {
    if (!nextDept) return;
    await run(async () => {
      await transfer({ billId: b.id, department: nextDept });
      setStep("idle");
      setNextDept("");
    });
  }
  async function finalizeIt() {
    await run(async () => {
      const queued = await finalize({ billId: b.id });
      setStep("idle");
      setNote(queued ? `Payment request queued for ${patient.email}.` : "Finalized. Show the patient the invoice.");
    });
  }
  async function markPaid() {
    if (!confirm(`Confirm ${formatRWF(b.total)} received by ${paymentName(method)}?`)) return;
    await run(async () => {
      const queued = await pay({ billId: b.id, method, reference: ref });
      setNote(queued ? `Receipt queued for ${patient.email}.` : "Payment recorded. The patient has no email address.");
    });
  }
  async function cancelBill() {
    if (confirm("Cancel this bill?")) await run(() => cancel({ billId: b.id }));
  }
  async function emailIt() {
    await run(async () => {
      const queued = await send({ billId: b.id });
      setNote(queued ? `Email queued for ${patient.email}.` : "The patient has no email address.");
    });
  }

  const statusCls = b.status === "paid" ? "bg-chart-2/25" : b.status === "cancelled" ? "bg-destructive/10 text-destructive" : b.status === "awaiting_payment" ? "bg-navy-soft/20 text-navy" : "bg-chart-4/25";
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{b.status === "paid" ? "Receipt" : b.status === "awaiting_payment" ? "Final invoice" : "Bill"} #{b.number}</p>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusCls)}>{STATUS_TEXT[b.status] ?? b.status}</span>
      </div>
      <p className="text-xs text-foreground/50">
        {new Date(b.created_at).toLocaleString("en-GB", { timeZone: "Africa/Kigali" })} · opened by {b.created_by_name}
        {b.status === "unpaid" && <> · now at <b>{departmentName(b.current_department)}</b></>}
      </p>
      <div className="mt-3 space-y-1 text-sm">
        {b.bill_items.length === 0 && <p className="text-foreground/50">No items yet.</p>}
        {b.bill_items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2">
            <span>{i.name} × {i.quantity} <span className="text-xs text-foreground/40">{i.department === "products" ? "Product" : departmentName(i.department)}</span></span>
            <span className="flex items-center gap-2 whitespace-nowrap">{formatRWF(i.unit_price * i.quantity)}
              {b.status === "unpaid" && canEdit && <button onClick={() => removeItem(i.id)} aria-label="Remove item" className="text-destructive"><X className="h-3.5 w-3.5" /></button>}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2 font-medium"><span>Total</span><span>{formatRWF(b.total)}</span></div>
        {b.finalized_by_name && <p className="text-xs text-foreground/60">Final biller: {b.finalized_by_name}</p>}
        {b.status === "paid" && <p className="text-xs text-foreground/60">Paid by {paymentName(b.payment_method)}{b.payment_reference && ` · ref ${b.payment_reference}`} · confirmed by {b.paid_by_name} · {b.paid_at && new Date(b.paid_at).toLocaleString("en-GB", { timeZone: "Africa/Kigali" })}</p>}
      </div>

      {b.status === "unpaid" && canEdit && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={cn(inp, "min-w-0 flex-1")}>
              <option value="">Add a service…</option>
              {grouped.map((g) => (
                <optgroup key={g.d.id} label={g.d.name}>
                  {g.list.map((i) => <option key={i.id} value={i.id}>{i.name} — {formatRWF(i.price)}</option>)}
                </optgroup>
              ))}
            </select>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className={cn(inp, "w-16")} />
            <button onClick={addItem} disabled={busy || !itemId} className={cn(btn, "bg-navy text-navy-foreground disabled:opacity-40")}>Add</button>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <Package className="h-4 w-4 text-foreground/40" />
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search a product to add…" className="w-full bg-transparent outline-none" />
          </label>
          {products.length > 0 && (
            <div className="mt-1 divide-y divide-border rounded-lg border border-border">
              {products.map((pr) => (
                <button key={pr.id} disabled={busy || pr.stock <= 0} onClick={() => addProduct(pr)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50">
                  <span>{pr.name}<span className="block text-xs text-foreground/50">{formatRWF(pr.price)}</span></span>
                  <StockBadge p={pr} />
                </button>
              ))}
            </div>
          )}

          {step === "idle" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setStep("ask")} disabled={b.total <= 0} className={cn(btn, "bg-navy text-navy-foreground disabled:opacity-40")}>Done with this patient</button>
              <button onClick={cancelBill} className={cn(btn, "border border-destructive text-destructive")}>Cancel bill</button>
            </div>
          )}
          {step === "ask" && (
            <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
              <p className="font-medium">Are you the final biller?</p>
              <p className="text-xs text-foreground/60">Yes: the invoice is closed and the patient is emailed how to pay. No: pass the bill to the next department.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button disabled={busy} onClick={finalizeIt} className={cn(btn, "bg-navy text-navy-foreground")}>Yes, finalize</button>
                <button onClick={() => setStep("handoff")} className={cn(btn, "border border-border bg-card")}>No, send to next department</button>
                <button onClick={() => setStep("idle")} className={cn(btn)}>Back</button>
              </div>
            </div>
          )}
          {step === "handoff" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
              <select value={nextDept} onChange={(e) => setNextDept(e.target.value)} className={inp}>
                <option value="">Next department…</option>
                {departments.filter((d) => d.id !== b.current_department).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button onClick={handoff} disabled={busy || !nextDept} className={cn(btn, "bg-navy text-navy-foreground disabled:opacity-40")}>Send</button>
              <button onClick={() => setStep("ask")} className={btn}>Back</button>
            </div>
          )}
        </>
      )}

      {b.status === "awaiting_payment" && canEdit && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-foreground/60">Patient pays with <a href={PAY_HREF} className="inline-flex items-center gap-1 font-medium underline"><Phone className="h-3 w-3" />{PAY_CODE}</a>, then shows you the payment message.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inp}>
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction ID from message" className={cn(inp, "min-w-0 flex-1")} />
            <button onClick={markPaid} disabled={busy} className={cn(btn, "bg-navy text-navy-foreground")}>Mark as paid</button>
          </div>
        </div>
      )}
      {b.status !== "cancelled" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {b.status !== "unpaid" && canEdit && <button onClick={emailIt} disabled={busy || !patient.email} className={cn(btn, "inline-flex items-center gap-1 border border-border disabled:opacity-40")}><Mail className="h-3 w-3" /> {b.status === "paid" ? "Email receipt again" : "Email invoice again"}</button>}
          {b.status === "paid" && <Link to="/receipt/$billId" params={{ billId: b.id }} target="_blank" className={cn(btn, "inline-flex items-center gap-1 border border-border")}><Printer className="h-3 w-3" /> Print receipt / PDF</Link>}
          {note && <span className="text-xs text-foreground/60">{note}</span>}
        </div>
      )}
    </div>
  );
}

function StockBadge({ p }: { p: Pick<Product, "stock" | "low_stock_level"> }) {
  if (p.stock <= 0) return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Out of stock</span>;
  if (p.stock <= p.low_stock_level) return <span className="rounded-full bg-chart-4/25 px-2 py-0.5 text-xs">Low · {p.stock} left</span>;
  return <span className="rounded-full bg-chart-2/20 px-2 py-0.5 text-xs">{p.stock} in stock</span>;
}

/* ---------------- Waiting for billing ---------------- */

function WaitingQueue({ onOpen }: { onOpen: (patientId: string) => void }) {
  const rows = useQuery(api.billing.waiting) ?? [];
  const departments = useServices();
  const departmentName = (id: string) => departments.find((department) => department.id === id)?.name ?? id;
  if (!rows.length) return null;
  return (
    <div className="mb-6 rounded-2xl bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-foreground/60">Waiting for billing ({rows.length})</p>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <button key={r.id} onClick={() => onOpen(r.patient_id)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            {r.patients?.full_name} · #{r.number} · {departmentName(r.current_department)} · {formatRWF(r.total)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Products & stock ---------------- */

const PRODUCT_CATEGORIES = [
  { id: "physiotherapy", name: "Physiotherapy" }, { id: "orthotics", name: "Orthotics & supports" },
  { id: "prosthetics", name: "Prosthetics" }, { id: "pharmacy", name: "Pharmacy" },
];
export const categoryName = (id: string) => PRODUCT_CATEGORIES.find((c) => c.id === id)?.name ?? id;

export function LowStockAlert() {
  const list = useQuery(api.catalog.lowStock) ?? [];
  if (!list.length) return null;
  return (
    <div className="mb-6 rounded-2xl border border-chart-4/60 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Needs refill ({list.length})</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((p) => <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">{p.name} <StockBadge p={p} /></span>)}
      </div>
    </div>
  );
}

export function Products() {
  const list = useQuery(api.catalog.products) ?? [];
  const [q, setQ] = useState("");
  const empty = { name: "", category: "physiotherapy", price: 0, stock: 0, low_stock_level: 5, description: "", image_url: "" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Product | null>(null);
  const saveProduct = useMutation(api.catalog.saveProduct);
  const adjustStock = useMutation(api.catalog.stockIn);
  const archive = useMutation(api.catalog.archiveProduct);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { stock, ...product } = form;
    try {
      await saveProduct({ openingStock: Math.round(stock), product: { ...product, price: Math.round(product.price), active: true, show_on_site: true } });
      setForm(empty);
    } catch (error) {
      alert(clinicError(error));
    }
  }
  async function update(product: Product) {
    const { id, name, category, price, low_stock_level, description, image_url, active, show_on_site } = product;
    try {
      await saveProduct({ id, product: { name, category, price: Math.round(price), low_stock_level, description, image_url, active, show_on_site } });
      setEditing(null);
    } catch (error) {
      alert(clinicError(error));
    }
  }
  async function stockIn(product: Product) {
    const quantity = Number(prompt(`Add how many "${product.name}" to stock? Use a negative number to correct stock.`, "10"));
    if (!quantity) return;
    const reason = prompt("Stock adjustment reason", "Refill");
    if (!reason) return;
    await adjustStock({ id: product.id, quantity: Math.round(quantity), reason }).catch((error) => alert(clinicError(error)));
  }
  const toggle = (product: Product, field: "active" | "show_on_site") => update({ ...product, [field]: !product[field] });
  async function remove(product: Product) {
    if (!confirm(`Archive "${product.name}"?`)) return;
    await archive({ id: product.id }).catch((error) => alert(clinicError(error)));
  }
  const shown = list.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Heading label="10" title="Products & stock" />
      <LowStockAlert />
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <input required placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cn(inp, "lg:col-span-2")} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inp}>
          {PRODUCT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input required type="number" min={0} placeholder="Price (RWF)" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inp} />
        <input type="number" min={0} placeholder="Opening stock" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className={inp} />
        <input type="number" min={0} placeholder="Low-stock alert at" value={form.low_stock_level || ""} onChange={(e) => setForm({ ...form, low_stock_level: Number(e.target.value) })} className={inp} />
        <div className="flex items-center gap-2"><input type="url" placeholder="Photo link from the internet (https://…)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value.trim() })} className={cn(inp, "flex-1")} />{form.image_url && <img src={form.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" onError={(e) => (e.currentTarget.style.opacity = "0.2")} />}</div>
        <input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
        <button className="inline-flex items-center justify-center gap-1 rounded-full bg-navy px-4 py-2 text-sm text-navy-foreground sm:col-span-2 lg:col-span-4 lg:w-fit"><Plus className="h-4 w-4" /> Add product</button>
      </form>

      <label className="mt-6 flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
        <Search className="h-4 w-4 text-foreground/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full bg-transparent outline-none" />
      </label>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50">
            <tr><th className="p-4">Product</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4">Website</th><th className="p-4"></th></tr>
          </thead>
          <tbody>
            {shown.map((p) => editing?.id === p.id ? (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3" colSpan={2}>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={cn(inp, "w-full")} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={inp}>
                      {PRODUCT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" min={0} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className={cn(inp, "w-28")} />
                    <input type="number" min={0} title="Low-stock alert at" value={editing.low_stock_level} onChange={(e) => setEditing({ ...editing, low_stock_level: Number(e.target.value) })} className={cn(inp, "w-24")} />
                  </div>
                  <div className="mt-2 flex items-center gap-2"><input type="url" placeholder="Photo link from the internet (https://…)" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value.trim() })} className={cn(inp, "w-full")} />{editing.image_url && <img src={editing.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" onError={(e) => (e.currentTarget.style.opacity = "0.2")} />}</div>
                  <input placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={cn(inp, "mt-2 w-full")} />
                </td>
                <td className="p-3" colSpan={3}>
                  <button onClick={() => { if (editing) void update(editing); }} className={cn(btn, "bg-navy text-navy-foreground")}>Save</button>
                  <button onClick={() => setEditing(null)} className={cn(btn, "ml-2 border border-border")}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className={cn("border-t border-border", !p.active && "opacity-50")}>
                <td className="p-4"><b className="font-medium">{p.name}</b><span className="block text-xs text-foreground/50">{categoryName(p.category)}</span></td>
                <td className="p-4 whitespace-nowrap">{formatRWF(p.price)}</td>
                <td className="p-4 whitespace-nowrap"><StockBadge p={p} /></td>
                <td className="p-4"><button onClick={() => toggle(p, "show_on_site")} className="text-xs underline">{p.show_on_site ? "Shown" : "Hidden"}</button></td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button onClick={() => stockIn(p)} className={cn(btn, "bg-navy text-navy-foreground")}>Stock in</button>
                  <button onClick={() => setEditing(p)} className={cn(btn, "ml-2 inline-flex items-center gap-1 border border-border")}><Pencil className="h-3 w-3" /> Edit</button>
                  <button onClick={() => toggle(p, "active")} className={cn(btn, "ml-2 border border-border")}>{p.active ? "Disable" : "Enable"}</button>
                  <button onClick={() => remove(p)} aria-label="Delete" className="ml-2 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-foreground/60">No products.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
