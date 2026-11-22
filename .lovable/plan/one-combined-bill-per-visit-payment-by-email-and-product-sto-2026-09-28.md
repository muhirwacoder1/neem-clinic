# One combined bill per visit, payment by email, and product stock

## 1. One bill that travels with the patient
- A patient has one open bill per visit. Each department (Reception, Physiotherapy, Orthotics, etc.) adds its own services and products to that same bill.
- When a staff member finishes adding items, they tap **"Done with this patient"**. The app asks: **"Are you the final biller?"**
  - **No**: nothing prints. The staff member picks the next department (for example Physiotherapy). The bill shows in that department's "Waiting for billing" list with everything added so far.
  - **Yes**: the bill becomes **Awaiting payment**. No more items can be added.
- The bill shows every department step (who added what, and when).

## 2. Collecting payment
- When the bill becomes Awaiting payment, the patient gets an email with the full list of charges, the total, and how to pay (the mobile money code).
- The patient pays and shows the payment message to the final biller.
- The biller enters the payment method and, if needed, the transaction number from the message, then taps **Mark as paid**.
- The bill becomes the **Final invoice / receipt**. The patient gets an email with the receipt as a PDF attachment. The biller can also print it or save it as a PDF on screen.
- The activity log records who handed the bill on, who finalized it, who confirmed payment, and the transaction number.

## 3. Products and stock
- **Admin, "Products & stock" tab**: add or edit a product (name, category such as physiotherapy or pharmacy, price, photo, description, low-stock level). Admin can also **Stock in**: add a quantity, with a note, for example "Refill from supplier".
- **Stock list**: shows how many are left. Products at or below the low-stock level show a "Low stock" badge, and products with none left show "Out of stock". Admin sees a **Needs refill** list at the top of the tab and on the Overview.
- **Reception and billing**: staff can type to search for a product and see its price and how many are left. Adding it to a bill removes it from stock. Out-of-stock products can't be added. Removing a product from an unpaid bill puts it back in stock.
- **Home page**: a new **"Products"** section shows the products the admin marks as visible, with photo, name, price, and whether they're available. There's also a "Ask at reception" note. Online buying isn't part of this.
- Stock history: every stock-in and sale is logged, including who did it and when.

## Things I'll assume (tell me if wrong)
- Payment is still confirmed by hand. No automatic mobile money payments yet.
- Any department can be the final biller, not only Reception.
- I'll add about 8 sample products with made-up prices and stock for you to replace.

## Technical details
- `bills`: add `stage` (open / awaiting_payment / paid), `current_department`, and `payment_reference`. Keep `status` in sync. Add a `bill_handoffs` table (from_dept, to_dept, by, at).
- New `products` table (name, category, price, stock, low_stock_level, image_url, description, show_on_site, active) and a `stock_movements` table (product_id, change, reason, by). Grants plus RLS: staff can read, admin can write. Public reads go only through a narrow RPC that returns visible products with price and in-stock status.
- `bill_items`: allow a `product_id` as an alternative to `service_item_id`. The guard trigger checks stock, reduces it, and records the change. A delete trigger adds the stock back. Only open bills can be changed.
- Server functions: `handoffBill`, `finalizeBill` (sends the `bill-payment-request` email), and `markBillPaid` (sends a `bill-receipt` email with the PDF made on the server by a Worker-safe PDF library, pdf-lib).
- A storage bucket for product photos. Dashboard gets new "Waiting for billing" and "Products & stock" views. The home page gets a Products section.
