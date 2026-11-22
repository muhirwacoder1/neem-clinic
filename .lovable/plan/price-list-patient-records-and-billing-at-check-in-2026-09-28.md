# Price List, Patient Records and Billing at Check-in

## What we will build

### 1. Price list (admin)

New dashboard tab "Price list", visible to the super admin for editing.

- Services grouped by department: Physiotherapy, Prosthetics, Orthotics, Outpatient Therapy, Consultation, plus a "Reception" group for things billed at the desk also admin can add or delete services
- Each item has a name, department, price (RWF), short description, and on/off switch (hidden items stay in old bills).
- Add, Edit and Deactivate buttons on every row, including the starter items we pre-fill.
- Starter items, for example:
  - Reception: Registration / file opening, Consultation fee
  - Physiotherapy: Initial assessment, Manual therapy session, Exercise therapy session, Electrotherapy (TENS), Ultrasound therapy, Hydrotherapy, Home exercise plan, Sports injury rehab session
  - Prosthetics: Below-knee prosthesis, Above-knee prosthesis, Socket adjustment, Prosthesis repair
  - Orthotics: Custom foot insoles, Knee brace, Ankle-foot orthosis (AFO), Spinal brace
  - Outpatient Therapy: Follow-up rehab session, Gait training
  Prices are placeholders for you to change.

### 2. Patient records (check-in / reception)

- "Register patient" form: full name, email, phone, where they're from (district/city), date of birth, sex, insurance (optional also )emergency contact,id optional 
- Search existing patients by name or phone so returning patients are not re-entered.
- When an arriving booked patient taps "Arrived", reception can link them to a patient record (create one on first visit).

### 3. Billing

- From a patient's record, staff create a bill: pick items from the price list, set quantity; total is calculated automatically.
- Reception bills desk items straight away at check-in; providers (physio etc.) add their session charges later to the same visit or a new bill.
- Each bill has a status: Unpaid, Paid, Cancelled, and a payment method: Cash, Mobile Money, Card, Insurance. and send bill to the user on the email
- "Mark as paid" records who confirmed payment and when.
- Prices are copied into the bill when billed, so later price changes don't alter past bills.
- Providers can bill only their own department's items; reception can bill Reception items; admin can bill anything.

### 4. Billing log (admin)

The existing Activity log gains billing entries: "Patient X registered by Y", "Bill #123 (15,000 RWF) created by Y", "Bill #123 marked paid (Mobile Money) by Z", "Price of Manual therapy changed 10,000 -> 12,000 by Admin". Filter by type (bookings / billing / prices).

## Technical details

- New tables: `service_items` (department, name, price, description, active), `patients` (personal info), `bills` (patient, optional appointment, status, payment method, total, created_by, paid_by, paid_at), `bill_items` (bill, item, name/price snapshot, qty).
- RLS: super admin manages `service_items`; all staff read active items; staff read/write patients and bills; department restriction enforced with a DB check on bill items.
- Starter price list inserted in the migration.
- Activity log gains a `category` column; writes happen alongside each action.
- New dashboard tabs: Price list (admin), Patients, Billing; check-in view gets "Register / Bill".

## Assumptions to confirm

- Currency is Rwandan Franc (RWF).
- send bill on email and button pay button which dail star*182 star* 8 star 1 star 2088293# and after pay you can mark user as payed and also receive receipts printing/PDF in this step .