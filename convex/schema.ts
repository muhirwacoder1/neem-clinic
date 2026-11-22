import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const nullableString = v.union(v.string(), v.null());
export const staffRole = v.union(
  v.literal("super_admin"),
  v.literal("provider"),
  v.literal("checkin"),
);
export const appointmentStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("checked_in"),
  v.literal("no_show"),
  v.literal("completed"),
);
export const billStatus = v.union(
  v.literal("unpaid"),
  v.literal("awaiting_payment"),
  v.literal("paid"),
  v.literal("cancelled"),
);
export const paymentMethod = v.union(
  v.literal("cash"),
  v.literal("mobile_money"),
  v.literal("card"),
  v.literal("insurance"),
);

export const activity_logFields = {
  action: v.string(),
  actor_id: nullableString,
  actor_name: v.string(),
  appointment_id: nullableString,
  category: v.string(),
  created_at: v.string(),
  details: v.string(),
  id: v.string(),
};

export const appointmentsFields = {
  created_at: v.string(),
  id: v.string(),
  manage_token: v.string(),
  notes: v.string(),
  patient_email: v.string(),
  patient_name: v.string(),
  patient_phone: v.string(),
  reference: v.string(),
  remind_1d: v.boolean(),
  remind_3d: v.boolean(),
  reminder_sent: v.boolean(),
  service: v.string(),
  start_at: v.string(),
  status: appointmentStatus,
  updated_at: v.string(),
};

export const bill_handoffsFields = {
  bill_id: v.string(),
  by_id: nullableString,
  by_name: v.string(),
  created_at: v.string(),
  from_department: v.string(),
  id: v.string(),
  to_department: v.string(),
};

export const bill_itemsFields = {
  added_by: nullableString,
  bill_id: v.string(),
  created_at: v.string(),
  department: v.string(),
  id: v.string(),
  name: v.string(),
  product_id: nullableString,
  quantity: v.number(),
  service_item_id: nullableString,
  unit_price: v.number(),
};

export const billsFields = {
  appointment_id: nullableString,
  created_at: v.string(),
  created_by: nullableString,
  created_by_name: v.string(),
  current_department: v.string(),
  finalized_at: nullableString,
  finalized_by_name: v.string(),
  id: v.string(),
  number: v.number(),
  paid_at: nullableString,
  paid_by: nullableString,
  paid_by_name: v.string(),
  patient_id: v.string(),
  payment_method: v.union(paymentMethod, v.null()),
  payment_reference: v.string(),
  receipt_token: v.string(),
  status: billStatus,
  total: v.number(),
  updated_at: v.string(),
};

export const blocked_slotsFields = {
  created_at: v.string(),
  id: v.string(),
  reason: v.string(),
  service: nullableString,
  start_at: v.string(),
};

export const patientsFields = {
  created_at: v.string(),
  created_by: nullableString,
  date_of_birth: nullableString,
  email: v.string(),
  emergency_contact: v.string(),
  full_name: v.string(),
  id: v.string(),
  insurance: v.string(),
  location: v.string(),
  national_id: v.string(),
  phone: v.string(),
  sex: v.string(),
  updated_at: v.string(),
};

export const productsFields = {
  active: v.boolean(),
  category: v.string(),
  created_at: v.string(),
  description: v.string(),
  id: v.string(),
  image_url: v.string(),
  low_stock_level: v.number(),
  name: v.string(),
  price: v.number(),
  show_on_site: v.boolean(),
  stock: v.number(),
  updated_at: v.string(),
};

export const profilesFields = {
  created_at: v.string(),
  email: v.string(),
  full_name: v.string(),
  id: v.string(),
  service: nullableString,
  clerkSubject: v.optional(v.string()),
  disabled: v.optional(v.boolean()),
};

export const service_itemsFields = {
  active: v.boolean(),
  created_at: v.string(),
  department: v.string(),
  description: v.string(),
  id: v.string(),
  name: v.string(),
  price: v.number(),
  updated_at: v.string(),
};

export const servicesFields = {
  active: v.boolean(),
  bookable: v.boolean(),
  created_at: v.string(),
  description: v.string(),
  details: v.string(),
  id: v.string(),
  image_url: v.string(),
  name: v.string(),
  show_on_home: v.boolean(),
  sort: v.number(),
  updated_at: v.string(),
};

export const stock_movementsFields = {
  by_id: nullableString,
  by_name: v.string(),
  change: v.number(),
  created_at: v.string(),
  id: v.string(),
  product_id: v.string(),
  reason: v.string(),
};

export const user_rolesFields = {
  id: v.string(),
  role: staffRole,
  user_id: v.string(),
};

export const emailPayload = v.union(
  v.object({
    type: v.literal("booking"),
    template: v.string(),
    appointment: v.object({
      id: v.string(),
      reference: v.string(),
      manage_token: v.string(),
      patient_name: v.string(),
      patient_email: v.string(),
      service: v.string(),
      service_name: v.string(),
      start_at: v.string(),
    }),
    oldStartAt: v.optional(v.string()),
    daysLeft: v.optional(v.number()),
    note: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("bill"),
    email: v.string(),
    name: v.string(),
    number: v.number(),
    total: v.number(),
    status: billStatus,
    method: v.union(paymentMethod, v.null()),
    reference: v.string(),
    receiptToken: v.string(),
    items: v.array(v.object({ name: v.string(), quantity: v.number(), unit_price: v.number() })),
  }),
);

export default defineSchema({
  activity_log: defineTable(activity_logFields).index("by_created_at", ["created_at"]),
  appointments: defineTable(appointmentsFields)
    .index("by_legacy_id", ["id"])
    .index("by_reference", ["reference"])
    .index("by_manage_token", ["manage_token"])
    .index("by_service_and_start_at", ["service", "start_at"])
    .index("by_service_and_start_at_and_status", ["service", "start_at", "status"])
    .index("by_start_at", ["start_at"])
    .index("by_status_and_start_at", ["status", "start_at"]),
  bill_handoffs: defineTable(bill_handoffsFields).index("by_bill_id", ["bill_id"]),
  bill_items: defineTable(bill_itemsFields)
    .index("by_legacy_id", ["id"])
    .index("by_bill_id", ["bill_id"])
    .index("by_product_id", ["product_id"])
    .index("by_service_item_id", ["service_item_id"]),
  bills: defineTable(billsFields)
    .index("by_legacy_id", ["id"])
    .index("by_number", ["number"])
    .index("by_receipt_token", ["receipt_token"])
    .index("by_patient_id_and_created_at", ["patient_id", "created_at"])
    .index("by_appointment_id", ["appointment_id"])
    .index("by_status_and_current_department", ["status", "current_department"]),
  blocked_slots: defineTable(blocked_slotsFields)
    .index("by_legacy_id", ["id"])
    .index("by_start_at_and_service", ["start_at", "service"]),
  patients: defineTable(patientsFields)
    .index("by_legacy_id", ["id"])
    .index("by_created_at", ["created_at"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"]),
  products: defineTable(productsFields)
    .index("by_legacy_id", ["id"])
    .index("by_active_and_show_on_site", ["active", "show_on_site"])
    .index("by_active_and_stock", ["active", "stock"])
    .index("by_category_and_name", ["category", "name"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["active"] }),
  profiles: defineTable(profilesFields)
    .index("by_legacy_id", ["id"])
    .index("by_email", ["email"])
    .index("by_clerkSubject", ["clerkSubject"]),
  service_items: defineTable(service_itemsFields)
    .index("by_legacy_id", ["id"])
    .index("by_department_and_name", ["department", "name"]),
  services: defineTable(servicesFields)
    .index("by_legacy_id", ["id"])
    .index("by_sort_and_name", ["sort", "name"])
    .index("by_active_and_show_on_home", ["active", "show_on_home"]),
  stock_movements: defineTable(stock_movementsFields).index("by_product_id", ["product_id"]),
  user_roles: defineTable(user_rolesFields)
    .index("by_user_id", ["user_id"])
    .index("by_role", ["role"]),
  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),
  email_outbox: defineTable({
    key: v.string(),
    payload: emailPayload,
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    dueAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status_and_dueAt", ["status", "dueAt"]),
});
