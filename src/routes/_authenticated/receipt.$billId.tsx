import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { PAY_CODE, formatRWF, paymentName } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/receipt/$billId")({
  head: () => ({
    meta: [
      { title: `Receipt | ${BRAND_NAME}` },
      { name: "description", content: `Printable ${BRAND_NAME} bill or receipt.` },
      { property: "og:title", content: `Receipt | ${BRAND_NAME}` },
      { property: "og:description", content: `Printable ${BRAND_NAME} bill or receipt.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Receipt,
});

function Receipt() {
  const { billId } = Route.useParams();
  const b = useQuery(api.billing.receipt, { billId });
  if (b === undefined) return <p className="p-10 text-sm">Loading…</p>;
  if (!b) return <p className="p-10 text-sm">Bill not found.</p>;
  const paid = b.status === "paid";
  const dt = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Africa/Kigali" });
  return (
    <div className="min-h-screen bg-background p-4 print:bg-card print:p-0">
      <div className="mx-auto max-w-lg rounded-2xl bg-card p-8 print:rounded-none">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <BrandLogo className="mb-2 h-auto w-24" />
            <p className="text-xs text-foreground/60">Wellness · Kigali, Rwanda</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium">{paid ? "Receipt" : "Bill"} #{b.number}</p>
            <p className="text-xs text-foreground/60">{dt(b.created_at)}</p>
          </div>
        </div>
        <div className="mt-4 text-sm">
          <p className="font-medium">{b.patients?.full_name}</p>
          <p className="text-foreground/60">{b.patients?.phone} {b.patients?.email && `· ${b.patients.email}`}</p>
          {b.patients?.insurance && <p className="text-foreground/60">Insurance: {b.patients.insurance}</p>}
        </div>
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50"><tr><th className="py-2">Service</th><th>Qty</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {b.bill_items.map((i) => (
              <tr key={i.id} className="border-t border-border"><td className="py-2">{i.name}</td><td>{i.quantity}</td><td className="text-right">{formatRWF(i.unit_price * i.quantity)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-foreground/40 font-medium"><td className="py-2" colSpan={2}>Total</td><td className="text-right">{formatRWF(b.total)}</td></tr></tfoot>
        </table>
        <div className="mt-6 text-xs text-foreground/70">
          {paid ? (
            <p>PAID by {paymentName(b.payment_method)} on {b.paid_at && dt(b.paid_at)} · confirmed by {b.paid_by_name}</p>
          ) : (
            <p>Status: {b.status.toUpperCase()} · Pay with Mobile Money: <b>{PAY_CODE}</b></p>
          )}
          <p className="mt-1">Issued by {b.created_by_name}</p>
        </div>
        <button onClick={() => window.print()} className="mt-8 rounded-full bg-navy px-5 py-2 text-sm text-navy-foreground print:hidden">Print / Save as PDF</button>
      </div>
    </div>
  );
}
