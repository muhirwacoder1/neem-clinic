import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let sendTemplateEmail;
let sendBookingEmail;
let templates;
const names = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "APP_ORIGIN"];
let saved;

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ sendTemplateEmail } = await server.ssrLoadModule("/src/lib/email-templates/send-email.ts"));
  ({ sendBookingEmail } = await server.ssrLoadModule("/src/lib/notify-email.server.ts"));
  ({ TEMPLATES: templates } = await server.ssrLoadModule("/src/lib/email-templates/registry.ts"));
});

after(async () => server?.close());
beforeEach(() => {
  saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.RESEND_API_KEY = "re_synthetic_test_key";
  process.env.RESEND_FROM_EMAIL = "noreply@example.test";
  process.env.APP_ORIGIN = "https://clinic.example.test";
});
afterEach(() => {
  mock.restoreAll();
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

test("missing Resend settings fail before contacting a provider", async () => {
  const request = mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network request");
  });
  for (const name of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
    const previous = process.env[name];
    delete process.env[name];
    await assert.rejects(
      sendTemplateEmail("booking-received", "patient@example.test"),
      new RegExp(name),
    );
    process.env[name] = previous;
  }
  assert.equal(request.mock.callCount(), 0);
});

test("all booking and invoice templates render and submit directly to Resend", async () => {
  const request = mock.method(globalThis, "fetch", async () => Response.json({ id: "test-email" }));
  for (const [name, entry] of Object.entries(templates)) {
    assert.deepEqual(
      await sendTemplateEmail(name, "patient@example.test", {
        templateData: entry.previewData,
        idempotencyKey: `outbox-${name}`,
        replyTo: "desk@example.test",
      }),
      { sent: true },
    );
    const [url, options] = request.mock.calls.at(-1).arguments;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer re_synthetic_test_key");
    assert.equal(options.headers["Idempotency-Key"], `outbox-${name}`);
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ["patient@example.test"]);
    assert.equal(body.from, "NEEM Wellness <noreply@example.test>");
    assert.equal(body.reply_to, "desk@example.test");
    assert.ok(body.subject);
    assert.match(body.html, /<html/);
    assert.ok(body.text.length > 30);
    assert.deepEqual(body.tags, [{ name: "template", value: name }]);
  }
  assert.equal(request.mock.callCount(), 7);
});

test("a queued retry preserves the Resend idempotency key and rendered payload", async () => {
  const request = mock.method(globalThis, "fetch", async () => Response.json({ id: "test-email" }));
  const options = {
    idempotencyKey: "outbox-stable-event",
    templateData: templates["booking-received"].previewData,
  };
  await sendTemplateEmail("booking-received", "patient@example.test", options);
  await sendTemplateEmail("booking-received", "patient@example.test", options);
  const first = request.mock.calls[0].arguments[1];
  const retry = request.mock.calls[1].arguments[1];
  assert.deepEqual(first.headers, retry.headers);
  assert.equal(first.body, retry.body);
});

test("provider rejection, malformed success and network failure are delivery failures without leaking provider bodies", async () => {
  const request = mock.method(globalThis, "fetch");
  for (const status of [401, 403, 429, 500]) {
    request.mock.mockImplementation(async () =>
      Response.json({ message: "private patient details" }, { status }),
    );
    await assert.rejects(sendTemplateEmail("booking-received", "patient@example.test"), {
      message: `Resend request failed (HTTP ${status}).`,
    });
  }
  request.mock.mockImplementation(async () => Response.json({}));
  await assert.rejects(
    sendTemplateEmail("booking-received", "patient@example.test"),
    /no email ID/,
  );
  request.mock.mockImplementation(async () => {
    throw new TypeError("Network failure");
  });
  const logs = mock.method(console, "error", () => {});
  assert.equal(
    await sendBookingEmail(
      {
        id: "test-appointment",
        reference: "TEST-1234",
        patient_name: "Test Patient",
        patient_email: "patient@example.test",
        service: "test-service",
        service_name: "Test service",
        start_at: "2026-11-25T09:00:00.000Z",
        manage_token: "a".repeat(48),
      },
      "booking-received",
    ),
    false,
  );
  assert.deepEqual(logs.mock.calls[0].arguments, ["[email] booking-received failed."]);
});
