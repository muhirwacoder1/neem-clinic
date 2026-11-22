import { createFileRoute } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { getReceiptByToken } from "@/lib/billing.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { PAY_CODE, formatRWF, paymentName } from "@/lib/billing";

export const Route = createFileRoute("/r/$token")({
  headers: () => ({ "cache-control": "private, no-store", "referrer-policy": "no-referrer" }),
  head: () => ({
    meta: [
      { title: `Your receipt | ${BRAND_NAME}` },
      { name: "description", content: `View, print or save your ${BRAND_NAME} invoice or receipt.` },
      { property: "og:title", content: `Your receipt | ${BRAND_NAME}` },
      { property: "og:description", content: `View, print or save your ${BRAND_NAME} invoice or receipt.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => getReceiptByToken({ data: { token: params.token } }).catch(() => null),
  errorComponent: () => <p className="p-10 text-sm">This receipt could not be loaded.</p>,
  notFoundComponent: () => <p className="p-10 text-sm">Receipt not found.</p>,
  component: PublicReceipt,
});

function PublicReceipt() {
  const b: FunctionReturnType<typeof api.billing.receiptByToken> = Route.useLoaderData();
  if (!b) return <p className="p-10 text-sm">Receipt not found.</p>;
  const paid = b.status === "paid";
  const dt = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Africa/Kigali" });
  return (
    <div className="min-h-screen bg-background p-4 print:bg-card print:p-0">
      <div className="mx-auto max-w-lg rounded-2xl bg-card p-6 sm:p-8 print:rounded-none">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <BrandLogo className="mb-2 h-auto w-24" />
            <p className="text-xs text-foreground/60">Wellness · Kigali, Rwanda</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium">{paid ? "Receipt" : "Final invoice"} #{b.number}</p>
            <p className="text-xs text-foreground/60">{dt(b.created_at)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium">{b.patients?.full_name}</p>
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-foreground/50"><tr><th className="py-2">Item</th><th>Qty</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {b.bill_items.map((i) => (
              <tr key={i.id} className="border-t border-border"><td className="py-2">{i.name}</td><td>{i.quantity}</td><td className="text-right">{formatRWF(i.unit_price * i.quantity)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-foreground/40 font-medium"><td className="py-2" colSpan={2}>Total</td><td className="text-right">{formatRWF(b.total)}</td></tr></tfoot>
        </table>
        <div className="mt-6 text-xs text-foreground/70">
          {paid
            ? <p>PAID by {paymentName(b.payment_method)}{b.payment_reference && ` · Ref ${b.payment_reference}`} on {b.paid_at && dt(b.paid_at)} · confirmed by {b.paid_by_name}</p>
            : <p>AWAITING PAYMENT · Pay with Mobile Money: <b>{PAY_CODE}</b>, then show the message to our staff.</p>}
          {b.finalized_by_name && <p className="mt-1">Final biller: {b.finalized_by_name}</p>}
        </div>
        <button onClick={() => window.print()} className="mt-8 rounded-full bg-navy px-5 py-2 text-sm text-navy-foreground print:hidden">Print / Save as PDF</button>
      </div>
    </div>
  );
}
