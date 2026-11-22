# Booking System, Provider Dashboard, Super Admin and Emails

## What we will build

### 1. Step-by-step booking (for patients)

A booking page opened from every "Book Appointment" / "Book Now" button.

```text
Step 1  Your details   -> full name, email, phone
Step 2  Service        -> Prosthetics, Orthotics, Physiotherapy, Outpatient Therapy, Consultation
Step 3  Date & time    -> calendar + 30-minute slots
Step 4  Review         -> summary, confirm
Done    Confirmation   -> booking reference + "email sent"
```

- Progress bar at the top showing the current step; Back / Next buttons.
- Time slots are 30 minutes (e.g. 08:00, 08:30 ... 16:30), shown per service.
- Free slots: bright, clickable. Taken slots: dimmed, labelled "Booked", not clickable.
- A slot is locked the moment someone books it, so two people cannot take the same one.

### 2. Provider dashboard (clinic staff)

Reached from the "Provider" button after signing in. Suggested features:

- Today overview: counts for pending, accepted, checked-in, cancelled.
- Appointment list with filters (date, service, status) and search by name/email.
- Actions per appointment: Accept, Decline, Reschedule, Mark checked-in, Mark no-show, add a private note.
- Calendar view (day / week) showing who is coming when.
- Patient detail panel: contact info and past visits.
- Each provider sees only their own service area (e.g. physiotherapist sees physiotherapy bookings).
- Check-in view for the hospital check-in person: today's arrivals, one-tap "Arrived".

### 3. Super admin

Everything providers can do, plus:

- See and act on every appointment across all services.
- Cancel or reschedule any appointment.
- Add/remove providers and assign their service and role.
- Set clinic hours, 30-minute slot rules, closed days/holidays, and block specific slots.
- Activity log: who accepted, cancelled or changed what, and when and admin can set account if someone is physiotherapy on other roles 

### 4. Emails to patients

- Booking received (with reference).
- Booking accepted / declined.
- Rescheduled (new date and time).
- Cancelled.
- Reminder the day before, with links to "Keep", "Reschedule" or "Cancel".
- Patients can manage their booking from a secure link in the email without creating an account.

## Visual direction

Same navy/cream MotionWell style, Onest font, rounded cards, [0X] section labels. Dashboard uses a navy side menu with cream content area.

## Build order

1. Turn on Lovable Cloud (database, staff sign-in, emails).
2. Booking steps + live slot availability.
3. Provider sign-in and dashboard.
4. Super admin tools.
5. Emails, then the day-before reminder and when approved

## Technical details

- Tables: services, providers/profiles, user_roles (separate table: super_admin, provider, checkin), appointments (patient name/email/phone, service, start time, status, manage token), clinic_hours, blocked_slots, activity_log.
- Unique constraint on (service, start time) for active appointments prevents double booking.
- Public booking via server functions; patients never read others' data (slots returned only as free/taken).
- Staff routes under a protected area with role checks enforced on the server.
- Transactional emails from a configured email domain; hourly scheduled job sends reminders ~24h ahead.

## Questions to confirm

- Clinic hours and days open? (Default assumed: Mon-Sat, 08:00-17:00.)
- Can several patients book the same time slot for different services/providers, or one patient per slot for the whole clinic? answer two patient can book one service at time.
- Do new bookings need provider approval, or are they confirmed automatically? send email that approinment is sent and is being reviewed it will be approved in 5 mins 
- Do you have a domain name (e.g. motionwell.rw) for sending emails you can use email services from lovable 