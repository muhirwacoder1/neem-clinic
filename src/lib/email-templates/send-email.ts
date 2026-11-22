import * as React from "react";
import { render } from "@react-email/render";
import { BRAND_NAME } from "../brand";
import { TEMPLATES } from "./registry";

// Server-only: keep Resend credentials out of browser imports and VITE_ settings.

// "sent" means accepted by Resend, not confirmed delivery to the recipient.
export type SendTemplateEmailResult = { sent: true };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Renders a registered template and calls Resend directly. The Convex outbox
 * owns retries and supplies a stable idempotency key. Errors propagate to the
 * delivery relay; booking and billing writes do not wait for email delivery.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const fromEmail = process.env["RESEND_FROM_EMAIL"];
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey || crypto.randomUUID(),
    },
    body: JSON.stringify({
      to: [recipient],
      from: `${BRAND_NAME} <${fromEmail}>`,
      subject,
      html,
      text,
      tags: [{ name: "template", value: templateName }],
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // Provider bodies may contain recipient details; do not include them in errors.
  if (!response.ok) {
    throw new Error(`Resend request failed (HTTP ${response.status}).`);
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id
  ) {
    throw new Error("Resend returned no email ID.");
  }

  return { sent: true };
}
