<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep service selection in a separate detail panel so all service cards remain equal-sized and stable.
- Booking writes go through server functions (admin client) and slot availability through a public DB function returning counts only; patients never read the appointments table. Why: keeps patient data private.
- Slot capacity (2 patients per service per 30-min slot) is enforced by a DB trigger. Why: prevents double booking under races.
- Staff roles live in user_roles (super_admin, provider, checkin); first signup becomes super_admin. Why: avoids privilege escalation and bootstraps the clinic.
- Booking emails are React Email templates in src/lib/email-templates/ sent via sendTemplateEmail from src/lib/email-templates/send-email.ts; shared sender logic lives in src/lib/notify-email.server.ts (sendBookingEmail), failures are logged not thrown. Why: mail problems must never break booking or dashboard actions.
- Day-before reminders run via pg_cron job daily-booking-reminders (16:00 UTC) POSTing to /api/public/cron/reminders with Bearer CRON_SECRET. Why: no app-side scheduler exists; the DB scheduler is the durable trigger.
- Bills flow: status unpaid (open, `current_department` shows who has it) → awaiting_payment (final biller via finalizeBill, emails invoice) → paid (markBillPaid, emails a secret `/r/$token` receipt link since email attachments aren't supported). Why: one combined invoice per visit.
- Product stock changes only through DB triggers on bill_items and the admin-only `stock_in` RPC, all logged in stock_movements; the public site reads products via `get_public_products`. Why: stock can't drift or be edited from the browser.
- ARCHITECTURE.md is the full system doc (schema, flows, emails, migration guide); update it and its change log with every change. Why: user needs a portable spec to move providers.
- Services/departments live in the `services` table, read via `src/lib/services.ts` (useServices/serviceName); never hardcode service lists. Why: admin creates services from the dashboard.
