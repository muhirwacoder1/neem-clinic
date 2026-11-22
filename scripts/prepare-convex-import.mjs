import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import schema from "../convex/schema.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("Usage: node scripts/prepare-convex-import.mjs SOURCE.json NEW_OUTPUT_DIRECTORY");

const legacyTables = [
  "services",
  "profiles",
  "user_roles",
  "appointments",
  "blocked_slots",
  "activity_log",
  "patients",
  "service_items",
  "products",
  "bills",
  "bill_items",
  "bill_handoffs",
  "stock_movements",
];
const validators = new Map(
  JSON.parse(schema.export()).tables.map(({ tableName, documentType }) => [
    tableName,
    documentType,
  ]),
);
const source = JSON.parse(await readFile(resolve(input), "utf8"));

function validate(value, rule, path) {
  switch (rule.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) break;
      const entries = Object.entries(rule.value);
      if (Object.keys(value).some((key) => !Object.hasOwn(rule.value, key)))
        throw new Error(`${path}: unexpected property`);
      for (const [key, { fieldType, optional }] of entries) {
        if (!optional || Object.hasOwn(value, key))
          validate(value[key], fieldType, `${path}.${key}`);
      }
      return;
    }
    case "union":
      for (const validator of rule.value) {
        try {
          validate(value, validator, path);
          return;
        } catch {
          /* Try the next member. */
        }
      }
      break;
    case "literal":
      if (value === rule.value) return;
      break;
    case "null":
      if (value === null) return;
      break;
    case "number":
      if (Number.isSafeInteger(value)) return;
      break;
    case "boolean":
    case "string":
      if (typeof value === rule.type) return;
      break;
    default:
      throw new Error(`Unsupported schema validator: ${rule.type}`);
  }
  throw new Error(`${path}: invalid value`);
}

function unique(rows, column, table) {
  const values = new Set();
  for (const row of rows) {
    if (!row[column] || values.has(row[column]))
      throw new Error(`${table}.${column}: empty or duplicate value`);
    values.add(row[column]);
  }
  return values;
}

const rows = {};
for (const table of legacyTables) {
  if (!Array.isArray(source[table])) throw new Error(`Missing export table: ${table}`);
  rows[table] = source[table].map((raw, index) => {
    const row = { ...raw };
    if (table === "profiles") {
      if (typeof row.email === "string") row.email = row.email.trim().toLowerCase();
      delete row.clerkSubject;
      delete row.disabled;
    }
    if (table === "appointments") {
      row.remind_1d ??= true;
      row.remind_3d ??= false;
    }
    for (const [key, value] of Object.entries(row)) {
      if (
        value !== null &&
        ["created_at", "updated_at", "start_at", "finalized_at", "paid_at"].includes(key)
      ) {
        const instant = new Date(value);
        if (!Number.isFinite(instant.getTime()))
          throw new Error(`${table}[${index}].${key}: invalid time`);
        row[key] = instant.toISOString();
      }
    }
    validate(row, validators.get(table), `${table}[${index}]`);
    return row;
  });
  unique(rows[table], "id", table);
}

unique(rows.profiles, "email", "profiles");
unique(rows.appointments, "reference", "appointments");
unique(rows.appointments, "manage_token", "appointments");
unique(rows.bills, "receipt_token", "bills");
unique(rows.bills, "number", "bills");

if (rows.appointments.some((row) => !/^[a-f0-9]{48}$/.test(row.manage_token)))
  throw new Error("Invalid booking tokens");
if (rows.bills.some((row) => !/^[a-f0-9]{36}$/.test(row.receipt_token)))
  throw new Error("Invalid receipt tokens");

const links = [
  ["user_roles", "user_id", "profiles"],
  ["activity_log", "appointment_id", "appointments"],
  ["bills", "patient_id", "patients"],
  ["bills", "appointment_id", "appointments"],
  ["bill_items", "bill_id", "bills"],
  ["bill_items", "product_id", "products"],
  ["bill_items", "service_item_id", "service_items"],
  ["bill_handoffs", "bill_id", "bills"],
  ["stock_movements", "product_id", "products"],
];
for (const [table, column, target] of links) {
  const keys = new Set(rows[target].map((row) => row.id));
  if (rows[table].some((row) => row[column] !== null && !keys.has(row[column]))) {
    throw new Error(`Unresolved reference: ${table}.${column} → ${target}`);
  }
}

const totals = new Map();
for (const item of rows.bill_items) {
  if (item.quantity < 1 || item.unit_price < 0) throw new Error("Invalid bill line amounts");
  totals.set(item.bill_id, (totals.get(item.bill_id) ?? 0) + item.quantity * item.unit_price);
}
if (rows.bills.some((bill) => bill.total !== (totals.get(bill.id) ?? 0)))
  throw new Error("Bill totals differ from line items");
if (rows.products.some((product) => product.stock < 0))
  throw new Error("Negative stock requires reconciliation");
const activeSlots = new Map();
for (const appointment of rows.appointments) {
  if (["cancelled", "declined"].includes(appointment.status)) continue;
  const key = JSON.stringify([appointment.service, appointment.start_at]);
  const count = (activeSlots.get(key) ?? 0) + 1;
  if (count > 2) throw new Error("Over-capacity appointment slot requires reconciliation");
  activeSlots.set(key, count);
}
const highWater = Math.max(
  source.billNumberHighWater ?? 0,
  rows.bills.reduce((maximum, bill) => Math.max(maximum, bill.number), 0),
);
if (!Number.isSafeInteger(highWater)) throw new Error("Invalid bill sequence");
rows.counters = [{ name: "bills", value: highWater }];

const directory = resolve(output);
await mkdir(directory, { mode: 0o700 });
for (const [table, documents] of Object.entries(rows)) {
  const contents = documents.map((document) => JSON.stringify(document)).join("\n");
  await writeFile(join(directory, `${table}.jsonl`), contents ? `${contents}\n` : "", {
    mode: 0o600,
    flag: "wx",
  });
}
const manifest = {
  counts: Object.fromEntries(
    Object.entries(rows).map(([table, documents]) => [table, documents.length]),
  ),
  billNumberHighWater: highWater,
  totalBilledRwf: rows.bills.reduce((total, row) => total + row.total, 0),
  totalStockUnits: rows.products.reduce((total, row) => total + row.stock, 0),
};
await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
  mode: 0o600,
  flag: "wx",
});
console.log(JSON.stringify(manifest, null, 2));
