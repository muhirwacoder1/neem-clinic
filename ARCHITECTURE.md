# NEEM Wellness — System Architecture

> Living system specification for the clinic app. Update the change log whenever behavior changes.
> Last updated 2026-11-22.

## 1. Product and runtime

NEEM Wellness is a Kigali clinic website and staff portal. Patients can browse services, make a booking without an account, manage it by private link, and view a finalized invoice or receipt by private link. Staff have an appointment calendar, reception check-in, patient records, billing, departments, price lists, inventory, and an audit log.

| Layer | Implementation |
| --- | --- |
| Web app | TanStack Start, React, Tailwind and shadcn/ui. The Lovable Vite configuration supplies the existing Cloudflare build target. |
| Clinic backend | Convex schema, indexed queries, serializable mutations, actions and cron jobs under `convex/`. |
| Staff identity | Clerk with Convex JWT verification. Clerk identities link to existing clinic profiles and roles. |
| Email | React Email via `sendTemplateEmail` calling the Resend HTTPS API directly. Convex queues and retries delivery through the app's server relay. |
| Clinic defaults | Africa/Kigali (UTC+2), whole Rwandan francs, and printed or private-link receipts. |

The visual reference is the [NEEM Wellness Studio Style Guide](https://stodio-ten.vercel.app/utility-pages/style-guide). The app uses Geist, slate navy `#1B2F45`, ivory `#F7F5F1`, apricot `#F4A259` for primary actions, and sky blue `#A5D1E6` for dividers and action hover states. Supporting colors include blue `#2D4F73`, slate `#465B6C`, muted blue `#61788B`, and teal `#1F7A6E`.

`src/styles.css` maps the palette to the app’s existing utility classes. `src/lib/brand.ts` supplies the display name for pages and email templates. The Studio wordmark and its ivory variant are served from `public/brand/` through `BrandLogo`. The browser icon uses the leaf from the original wordmark. Emails use the same palette and system fonts for email client compatibility.

## 2. Application entry points

| Entry point | Data and authorization |
| --- | --- |
| `/` | Active services and public products through Convex. Service cards keep their own size and show selection in a separate panel. Public inventory shows availability only. |
| `/book` | Public availability query returns time, count, and blocked flag. A TanStack server function calls the secret-protected Convex booking mutation. |
| `/manage/$token` | Convex returns the reference, service, time and status associated with the 48-character bearer token. Cancellation goes through a protected server mutation. |
| `/provider` | Clerk sign-in and approved account setup. |
| `/dashboard` | Clerk session and an active Convex staff role are required. Convex checks access again inside each staff query and mutation. |
| `/receipt/$billId` | Printable staff receipt, with staff authentication and role checks. |
| `/r/$token` | Private 36-character bearer token authorizes a finalized invoice or receipt. The response omits the patient's contact details. |
| `POST /api/public/cron/reminders` | Internal email delivery relay from Convex. Requires `Authorization: Bearer CRON_SECRET` and a validated JSON delivery payload. |

`src/integrations/convex/ClinicProvider.tsx` connects the frontend to Clerk and Convex. Staff routes disable SSR, use Convex subscriptions, and check both identity and clinic access before rendering. The two credentials patients may hold are the booking and receipt links. Avoid recording either in analytics or request logs.

## 3. Data model and invariants

`convex/schema.ts` defines the active schema. The data model keeps a separate application `id` field for importing old Postgres IDs and preserving references. New clinic records also store that field. Native Convex IDs identify individual stored documents. Legacy Postgres SQL under `supabase/migrations/` documents the source system for export and rollback.

| Data | Operations and invariants |
| --- | --- |
| `services`, `service_items` | Administrators manage services and price lists. Services drive booking, display, provider assignment and billing department selection. The reserved `reception` service represents the front desk. At most eight active services can be featured on the home page. |
| `profiles`, `user_roles` | Imported clinic profiles retain their IDs and audit references. Their authoritative account emails come from the legacy auth user table. A verified approved Clerk email can claim an unlinked profile. Subsequent access matches the Clerk subject. Administrators assign departments and can revoke staff access. The first administrator on a fresh deployment must match `BOOTSTRAP_ADMIN_EMAIL`. |
| `appointments`, `blocked_slots` | Booking is open for the next 14 eligible Kigali dates, excluding Sundays, from 08:00 through 16:30 in 30-minute slots. A Convex mutation checks blocks and capacity in the same transaction as the appointment write. A service can have at most two active appointments in a slot. A request identifier lets a patient retry a submission safely. Staff rescheduling applies the same capacity and block checks. |
| `patients` | Staff can search and maintain patient records. As in the source workflow, all enabled staff roles can view patient records and bill history. Provider appointment access follows the assigned service. |
| `bills`, `bill_items`, `bill_handoffs`, `counters` | A visit linked to an appointment can have one non-cancelled bill. An unpaid bill belongs to its current department. Handing it off and writing the handoff record share a transaction. Only the current department and super administrators can modify an open bill or record payment. Finalizing moves it to `awaiting_payment`, and payment confirmation moves it to `paid`. Line items snapshot the price and item name. Invoice numbering starts above the imported sequence and stored invoices. |
| `products`, `stock_movements` | Add a product to a bill to deduct stock. Remove it or cancel an unpaid bill to restore stock. Stock changes, item changes and totals update in one transaction. Admin stock adjustments record a reason and cannot drive stock below zero. Archiving inventory preserves its movement and bill history. |
| `activity_log` | Server-generated audit entries use the current staff identity or the patient's booking action and are visible only to administrators. |
| `email_outbox` | Changes that send email enqueue a job in the same transaction. A worker claims jobs with a lease, uses stable provider idempotency keys and retries transient failures. Jobs exhausted after five attempts are visible in the Convex dashboard. |

`super_admin` manages staff, data and configuration. `checkin` can see all appointments and edit bills at Reception. `provider` operates within the assigned appointment and billing department, or all non-Reception billing departments when unassigned. Manual Mobile Money confirmation and other allowed payment methods record the staff member and payment reference.

## 4. Authentication and email configuration

Set up Clerk for the staff site using the [Convex integration](https://docs.convex.dev/auth/clerk). Enabling this integration adds audience `convex` but does not automatically add the clinic's email identity claims. In Clerk **Configure → Sessions → Customize session token**, preserve the managed audience and include these signed claims:

```json
{
  "aud": "convex",
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}",
  "name": "{{user.full_name}}"
}
```

Clerk resolves the verification shortcode to a Boolean; never hardcode it to `true`. `name` is optional for access. If using the older JWT template integration instead, configure a template named `convex` with the same claims. `ConvexProviderWithClerk` uses the session token when its audience is `convex`, otherwise it requests that template. After saving changed claims, sign out and back in to obtain a fresh token. Test the claims with a dev staff account before importing real records. Set Clerk signup and invitation policies appropriate for an internal staff app, require MFA for privileged users, and enable the clinic site as a valid redirect origin.

`staff.claim` deliberately refuses access without a signed email and `emailVerified === true`, before considering `BOOTSTRAP_ADMIN_EMAIL`. Setting the bootstrap email does not create an account or add missing JWT claims. For the native integration, the staff access screen inspects Clerk's session claims to distinguish missing claim configuration from an unverified email or missing staff approval and displays the current Clerk email. These are display-only diagnostics: the backend still independently verifies the token and grants roles through `profiles` and `user_roles`. In JWT-template mode the session claims describe a different token, so that mode retains the general access message.

| Variable | Location and purpose |
| --- | --- |
| `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY` | App build environment. Select the matching Convex and Clerk development or production instances. |
| `CONVEX_URL` | Optional app server override for the same Convex deployment the browser uses. |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex environment. Set to the issuer for the corresponding Clerk instance. |
| `BOOTSTRAP_ADMIN_EMAIL` | Convex environment for a fresh clinic without an existing administrator. Remove it after the administrator is verified. |
| `CLERK_SECRET_KEY` | Convex only. Used by the authorized staff invitation action. |
| `CLINIC_SERVER_SECRET` | Server and Convex. Same separate high-entropy value protects public booking writes. Keep browser environment variables free of this secret. Rotate under an approved change window so a retry with an in-flight booking ID can be reconciled. |
| `CRON_SECRET` | Server and Convex. Same separate high-entropy value protects the email relay. |
| `APP_ORIGIN` | Server and Convex. Canonical clinic URL for Clerk invitations and patient links. |
| `RESEND_API_KEY` | App server only. Resend sending-only API key, preferably restricted to the sender's verified domain. Never set this in the browser environment or Convex. |
| `RESEND_FROM_EMAIL` | App server only. Sender address on a domain verified in the same Resend account. The app adds the NEEM Wellness display name. The selected development sender is `noreply@rivomobility.co.rw`. |
| `NEEM_EMAILS_ENABLED` | Convex only. Set to `true` to start delivery after verifying the relay and switching off the legacy scheduler. |

For local development, put actual app settings in the ignored `.env.local` file and keep `.env.example` free of credentials. The optional `.env.credentials.local` reference lists app and Convex settings by destination. Set deployment secrets in the host and Convex dashboard. Keep server-side credentials out of the `VITE_` namespace.

This is a Vite app: copy the Clerk publishable key into `VITE_CLERK_PUBLISHABLE_KEY`, even if Clerk's example labels it `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. The latter name is for Next.js and is not read here. Match `CLERK_JWT_ISSUER_DOMAIN` on Convex to that Clerk instance. Keep `CLERK_SECRET_KEY` in Convex; the app's browser provider only needs the publishable key. Both Convex URLs must select the same deployment. For local development, `APP_ORIGIN` is `http://localhost:5173`; change it in both the app server and Convex to the deployed canonical URL when configuring hosting. Preserve the existing separate `CLINIC_SERVER_SECRET` and `CRON_SECRET` values when filling in missing settings.

The ignored `.env.convex.local` file contains only the selected development deployment settings, with email delivery disabled. The initial administrator email is prepared as `BOOTSTRAP_ADMIN_EMAIL` in that file and the local credentials reference. Apply it with `npx convex env set --deployment beloved-sandpiper-98 --from-file .env.convex.local` from a machine with Convex CLI access. The CLI refuses differing existing values by default; inspect differences before overwriting them. Do not import the broader `.env.credentials.local` reference, which also contains legacy and app-only settings. Updating this file locally does not update Convex. The 2026-11-22 configuration attempt could not reach the Convex API because DNS resolution failed, so remote environment settings remain unverified. After applying the bootstrap setting, sign in through Clerk with that verified email and click "Check access again". Bootstrap only creates the first administrator when no super admin already exists; it does not promote existing staff profiles or replace an existing administrator. Remove the bootstrap variable from Convex after verifying access.

The Convex job `daily-booking-reminders` runs at 16:00 UTC, 18:00 Kigali. It queues reminders for accepted appointments one or three days away according to the patient's preferences. The delivery job runs each minute. A reminder is skipped at claim time if the appointment was changed, cancelled, passed, or opted out. Booking email templates run through `sendBookingEmail`, which logs delivery failures and returns a status. The booking and billing mutations do not wait for external delivery.

`sendTemplateEmail` renders HTML and plain text, then posts to `https://api.resend.com/emails` with a 15-second timeout, the queue's stable `Idempotency-Key`, and a template tag. An HTTP error or missing provider email ID fails the relay so the existing outbox can retry. Provider response bodies are excluded from errors to keep recipient details out of application logs. A successful response means Resend accepted the email; final delivery, bounces and suppressions are visible in Resend. Idempotency keys expire after 24 hours, so do not manually replay older jobs without checking their provider status. No Lovable email credentials, sender delegation or endpoint overrides are used. The existing `/lovable/email/transactional/preview` URL remains a rendering-only compatibility endpoint; it now requires `Bearer CRON_SECRET` and never needs the Resend key.

Run `npm run test:email` to verify all seven template payloads, retry stability, configuration errors and delivery failure isolation using mocked provider responses. These checks send no real emails. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the deployed app server and check delivery before enabling `NEEM_EMAILS_ENABLED` on Convex.

## 5. Data migration and cutover

1. Provision a development Convex deployment and a Clerk test instance. Install dependencies from the lockfile, set the environment variables, then run `bunx convex dev`, `bun run build`, and `bun run test:migration`. Test staff sign-in and an entire visit using synthetic records. Leave real email delivery disabled during this rehearsal.
2. Map staff to the correct roles and departments. A legacy staff member claims their existing profile using the same verified email in Clerk. Invite staff through Clerk or the migrated dashboard as appropriate. Legacy passwords and sessions are not in the export. Prepare a verified administrator account for cutover. If this installation starts with no legacy dataset, create Reception and the clinic's services, prices and products in the admin dashboard.
3. Confirm the permitted data location before using real records. Document the regions and vendors handling the database, staff identities, email and backups. Rwanda's published rules require authorization for storage of personal data outside Rwanda. Check the actual tenant setup against the [Rwanda Data Protection and Privacy Office](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data) and [Convex regions](https://docs.convex.dev/production/regions).
4. Export the source with a read-only Postgres connection that can read the clinic tables, auth user emails and invoice sequence. Run the versioned extraction script from an authorized machine. Use a protected local directory outside the repo.

   ```sh
   umask 077
   psql -XqtA -f scripts/export-clinic-for-convex.sql > /secure-path/clinic.json
   node scripts/prepare-convex-import.mjs /secure-path/clinic.json /secure-path/convex-import
   ```

   If Lovable only provides separate table exports, assemble the same JSON object and use the authorized auth account email list for the profiles. Inventory any hosted images or off-database files. The preparation script validates row shapes, duplicates, relationships, totals, tokens, stock, and slot capacity before writing JSONL and a reconciliation manifest. Resolve reported discrepancies against the source. The script never contacts Convex or prints patient records.

5. Import each non-empty JSONL table into the designated **empty** target using `bunx convex import --table <table> <path>`. The default target is development. Select the reviewed production project explicitly when carrying out cutover. Resume a partial import from its first empty table after checking counts. Avoid appending a snapshot twice. Check table counts, bill sequence, totals and stock against the manifest. Test an original booking link and receipt link from the legacy site, including the original hostname if it is changing.
6. During an agreed write pause, disable the old `pg_cron` job, take a final consistent export and backup, import the final snapshot into the designated production target, apply app and Clerk configuration, and run smoke checks. Confirm that payment routing, invoice display, permissions, scheduling and email relay behave as expected. Reopen writes only after checks pass, then enable the new scheduler for email delivery.
   For a legacy Supabase rollback, set a fresh secret named `clinic_legacy_cron_secret` in [Supabase Vault](https://supabase.com/docs/guides/database/vault) and use the same value as `CRON_SECRET` on the **legacy** app server. Apply the sanitized legacy scheduler SQL to install or replace the job. Its command reads Vault at runtime and skips the HTTP request if the secret is missing. A previously installed job stores its own command, so editing the checked-in migration does not update that job. Verify the legacy endpoint before restarting its scheduler.

7. Retain a protected legacy snapshot and an approved rollback route. If new bookings, payments or inventory movements have occurred, reconcile those writes before reopening the legacy app. Verify the restore procedure and preserve invoice and audit records under the clinic's retention policy.

## Change log
- 2026-11-22: Diagnosed the initial administrator access failure against live settings: the selected bootstrap email and issuer matched, the Clerk account's email was verified, and clinic staff tables were empty, but the Clerk session token configuration contained only `aud`. Documented the required email claims, added display-only identity diagnostics and a signed-in email display, and regression-tested refusal of incomplete tokens plus successful bootstrap for the configured verified email. Backend access rules are unchanged. Preparing local code or a claim configuration draft does not publish or apply it.
- 2026-11-22: Prepared the user-selected initial super administrator email in ignored local Convex configuration. Access still requires applying the setting to the development deployment and claiming it through the matching verified Clerk account.
- 2026-11-22: Replaced the Lovable email transport with direct Resend delivery, retaining React Email templates, stable queue retry keys, and non-blocking clinic writes. Added server-only Resend settings for the selected verified sender; removed obsolete email dependencies and variables. The template preview endpoint now authenticates with the server relay secret. Local email delivery remains disabled until remote configuration and delivery checks are complete.
- 2026-11-22: Filled the ignored local Clerk configuration for the existing development Convex deployment, preserved the existing booking and email relay secrets, and documented Vite key naming and local versus hosted origin settings. Deployment configuration still requires the matching settings on Convex and a bootstrap administrator email for a fresh installation.
- 2026-09-28: Homepage, booking + dashboard, emails & reminders, mobile fixes, billing & price list, products/stock, final-biller flow. Document created.
- 2026-09-28: blocked_slots read restricted to staff with a role.

### 2026-09-28 — Editable services
- Legacy Postgres `services` table added (id slug, name, description, bookable, active, sort). Public read; super admin write. Seeded with reception + the 5 original services.
- Frontend reads it via `src/lib/services.ts` (`useServices`, `serviceName`, `reloadServices`); services double as billing departments and provider assignments. Admin "Services" dashboard tab adds/edits/hides services.
- `createBooking` rejects services that are missing, hidden or not bookable. Server-side IDs validated as slugs instead of a fixed list.
- Product photo fields accept internet image links with a live preview.
- `services` gains `show_on_home`, `details`, `image_url`. The home page Services section shows only active services with `show_on_home` (admin toggles it; max 8 enforced in the UI). Added "Gait Training" service.

- 2026-10-01: Patients choose reminders at booking (`appointments.remind_3d` default false, `remind_1d` default true). Daily cron sends `booking-reminder` with `daysLeft` 1 or 3 for accepted appointments that opted in.

- 2026-11-16: Applied the NEEM Wellness Studio guidelines to the homepage, booking and management screens, staff portal, invoice and receipt views, and transactional email templates. Added the Studio wordmark, leaf favicon, and shared display name for page metadata and mail.


- 2026-11-16: Ported the app to Convex and Clerk locally. Moved booking capacity, department billing, stock adjustments and audit writes into Convex transactions. Added durable email scheduling, environment documentation, legacy export/import scripts and synthetic migration checks.

- 2026-11-16: Moved the local app secrets into ignored environment configuration. Replaced the embedded legacy reminder credential with a runtime Supabase Vault lookup.
