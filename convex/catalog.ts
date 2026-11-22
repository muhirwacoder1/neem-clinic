import { v } from "convex/values";
import { mutation, query } from "./_generated/server.ts";
import { productsFields, service_itemsFields, servicesFields } from "./schema.ts";
import type { MutationCtx } from "./_generated/server.ts";
import type { Doc } from "./_generated/dataModel.ts";
import { admin, audit, fail, getService, id, int, now, row, staff, text } from "./lib.ts";
import type { Staff } from "./lib.ts";

export const services = query({
  args: {},
  returns: v.array(v.object(servicesFields)),
  handler: async (ctx) =>
    (await ctx.db.query("services").withIndex("by_sort_and_name").take(300))
      .filter((item) => item.active)
      .map(row),
});

export const allServices = query({
  args: {},
  returns: v.array(v.object(servicesFields)),
  handler: async (ctx) => {
    await admin(ctx);
    return (await ctx.db.query("services").withIndex("by_sort_and_name").take(300)).map(row);
  },
});

function imageUrl(value: string) {
  const url = text(value, 2000);
  if (url && !/^https?:\/\/\S+$/i.test(url)) fail("Enter an HTTP or HTTPS image URL.");
  return url;
}

export const addService = mutation({
  args: { name: v.string(), description: v.string(), bookable: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    const name = text(args.name, 100, 2);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/^-|-$/g, "");
    if (slug.length < 2) fail("Please enter a longer name.");
    if (await getService(ctx, slug)) fail("A service with that name already exists.");
    const last = await ctx.db.query("services").withIndex("by_sort_and_name").order("desc").first();
    const stamp = now();
    await ctx.db.insert("services", {
      id: slug,
      name,
      description: text(args.description, 1000),
      bookable: args.bookable,
      active: true,
      sort: (last?.sort ?? 0) + 1,
      show_on_home: false,
      details: "",
      image_url: "",
      created_at: stamp,
      updated_at: stamp,
    });
    await audit(ctx, actor, "prices", "service_added", name);
    return null;
  },
});

export const updateService = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      bookable: v.optional(v.boolean()),
      active: v.optional(v.boolean()),
      show_on_home: v.optional(v.boolean()),
      details: v.optional(v.string()),
      image_url: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { id, patch }) => {
    const actor = await admin(ctx);
    const current = await getService(ctx, id);
    if (!current) return fail("Service not found.");
    const next = {
      name: patch.name === undefined ? current.name : text(patch.name, 100, 2),
      description:
        patch.description === undefined ? current.description : text(patch.description, 1000),
      bookable: patch.bookable ?? current.bookable,
      active: patch.active ?? current.active,
      show_on_home: patch.show_on_home ?? current.show_on_home,
      details: patch.details === undefined ? current.details : text(patch.details, 5000),
      image_url: patch.image_url === undefined ? current.image_url : imageUrl(patch.image_url),
      updated_at: now(),
    };
    if (id === "reception" && (!next.active || next.show_on_home || next.bookable))
      fail("Reception is a staff-only department.");
    if (next.active && next.show_on_home && !(current.active && current.show_on_home)) {
      const featured = await ctx.db
        .query("services")
        .withIndex("by_active_and_show_on_home", (q) =>
          q.eq("active", true).eq("show_on_home", true),
        )
        .take(8);
      if (featured.length >= 8) fail("The home page can show up to 8 services.");
    }
    await ctx.db.patch(current._id, next);
    await audit(ctx, actor, "prices", "service_updated", next.name);
    return null;
  },
});

export const priceList = query({
  args: { activeOnly: v.boolean() },
  returns: v.array(v.object(service_itemsFields)),
  handler: async (ctx, { activeOnly }) => {
    if (activeOnly) await staff(ctx);
    else await admin(ctx);
    const items = await ctx.db
      .query("service_items")
      .withIndex("by_department_and_name")
      .take(1000);
    return items.filter((item) => !activeOnly || item.active).map(row);
  },
});

const priceInput = v.object({
  department: v.string(),
  name: v.string(),
  price: v.number(),
  description: v.string(),
  active: v.boolean(),
});
export const savePrice = mutation({
  args: { id: v.optional(v.string()), item: priceInput },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    const item = {
      ...args.item,
      name: text(args.item.name, 150, 1),
      description: text(args.item.description, 1000),
      price: int(args.item.price, 0, 1_000_000_000),
    };
    if (!(await getService(ctx, item.department))) fail("Unknown department.");
    if (args.id) {
      const existing = await ctx.db
        .query("service_items")
        .withIndex("by_legacy_id", (q) => q.eq("id", args.id!))
        .unique();
      if (!existing) return fail("Price item not found.");
      await ctx.db.patch(existing._id, { ...item, updated_at: now() });
    } else {
      const stamp = now();
      await ctx.db.insert("service_items", {
        ...item,
        id: id(),
        created_at: stamp,
        updated_at: stamp,
      });
    }
    await audit(ctx, actor, "prices", args.id ? "price_updated" : "price_added", item.name);
    return null;
  },
});

export const archivePrice = mutation({
  args: { id: v.string() },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const actor = await admin(ctx);
    const item = await ctx.db
      .query("service_items")
      .withIndex("by_legacy_id", (q) => q.eq("id", id))
      .unique();
    if (item) {
      const used = await ctx.db
        .query("bill_items")
        .withIndex("by_service_item_id", (q) => q.eq("service_item_id", id))
        .first();
      if (used) await ctx.db.patch(item._id, { active: false, updated_at: now() });
      else await ctx.db.delete(item._id);
      await audit(ctx, actor, "prices", "price_removed", item.name);
    }
    return null;
  },
});

const publicProduct = v.object({
  id: v.string(),
  name: v.string(),
  category: v.string(),
  price: v.number(),
  image_url: v.string(),
  description: v.string(),
  in_stock: v.boolean(),
});
export const publicProducts = query({
  args: {},
  returns: v.array(publicProduct),
  handler: async (ctx) => {
    const items = await ctx.db
      .query("products")
      .withIndex("by_active_and_show_on_site", (q) => q.eq("active", true).eq("show_on_site", true))
      .take(300);
    return items.map(({ id, name, category, price, image_url, description, stock }) => ({
      id,
      name,
      category,
      price,
      image_url,
      description,
      in_stock: stock > 0,
    }));
  },
});

export const products = query({
  args: {},
  returns: v.array(v.object(productsFields)),
  handler: async (ctx) => {
    await admin(ctx);
    return (await ctx.db.query("products").withIndex("by_category_and_name").take(1000)).map(row);
  },
});

export const lowStock = query({
  args: {},
  returns: v.array(v.object(productsFields)),
  handler: async (ctx) => {
    await admin(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_active_and_stock", (q) => q.eq("active", true))
      .take(300);
    return products.filter((product) => product.stock <= product.low_stock_level).map(row);
  },
});

export const searchProducts = query({
  args: { term: v.string() },
  returns: v.array(v.object(productsFields)),
  handler: async (ctx, { term }) => {
    await staff(ctx);
    const search = term.trim().slice(0, 100);
    if (!search) return [];
    return (
      await ctx.db
        .query("products")
        .withSearchIndex("search_name", (q) => q.search("name", search).eq("active", true))
        .take(8)
    ).map(row);
  },
});

export async function moveStock(
  ctx: MutationCtx,
  product: Doc<"products">,
  actor: Staff,
  change: number,
  reason: string,
) {
  const stock = int(product.stock + change, 0, 1_000_000);
  await ctx.db.patch(product._id, { stock, updated_at: now() });
  await ctx.db.insert("stock_movements", {
    id: id(),
    product_id: product.id,
    change,
    reason,
    by_id: actor.id,
    by_name: actor.name,
    created_at: now(),
  });
}

const productInput = v.object({
  name: v.string(),
  category: v.string(),
  price: v.number(),
  low_stock_level: v.number(),
  image_url: v.string(),
  description: v.string(),
  show_on_site: v.boolean(),
  active: v.boolean(),
});
export const saveProduct = mutation({
  args: { id: v.optional(v.string()), product: productInput, openingStock: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    const product = {
      ...args.product,
      name: text(args.product.name, 150, 1),
      category: text(args.product.category, 60, 1),
      price: int(args.product.price, 0, 1_000_000_000),
      low_stock_level: int(args.product.low_stock_level, 0, 1_000_000),
      image_url: imageUrl(args.product.image_url),
      description: text(args.product.description, 3000),
    };
    if (args.id) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_legacy_id", (q) => q.eq("id", args.id!))
        .unique();
      if (!existing) return fail("Product not found.");
      await ctx.db.patch(existing._id, { ...product, updated_at: now() });
    } else {
      const stamp = now();
      const productId = await ctx.db.insert("products", {
        ...product,
        id: id(),
        stock: 0,
        created_at: stamp,
        updated_at: stamp,
      });
      const openingStock = int(args.openingStock ?? 0, 0, 1_000_000);
      if (openingStock)
        await moveStock(ctx, (await ctx.db.get(productId))!, actor, openingStock, "Opening stock");
    }
    await audit(ctx, actor, "prices", args.id ? "product_updated" : "product_added", product.name);
    return null;
  },
});

export const stockIn = mutation({
  args: { id: v.string(), quantity: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    const product = await ctx.db
      .query("products")
      .withIndex("by_legacy_id", (q) => q.eq("id", args.id))
      .unique();
    if (!product) return fail("Product not found.");
    const quantity = int(args.quantity, -1_000_000, 1_000_000);
    if (!quantity) fail("Quantity required.");
    await moveStock(ctx, product, actor, quantity, text(args.reason, 250, 1));
    await audit(ctx, actor, "prices", "stock_adjusted", product.name);
    return null;
  },
});

export const archiveProduct = mutation({
  args: { id: v.string() },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const actor = await admin(ctx);
    const product = await ctx.db
      .query("products")
      .withIndex("by_legacy_id", (q) => q.eq("id", id))
      .unique();
    if (product) {
      await ctx.db.patch(product._id, { active: false, show_on_site: false, updated_at: now() });
      await audit(ctx, actor, "prices", "product_archived", product.name);
    }
    return null;
  },
});

export const activity = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      category: v.string(),
      actor_name: v.string(),
      action: v.string(),
      details: v.string(),
      created_at: v.string(),
      appointments: v.union(
        v.null(),
        v.object({ reference: v.string(), patient_name: v.string() }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await admin(ctx);
    const rows = await ctx.db
      .query("activity_log")
      .withIndex("by_created_at")
      .order("desc")
      .take(500);
    return Promise.all(
      rows.map(
        async ({ id, category, actor_name, action, details, created_at, appointment_id }) => {
          const a = appointment_id
            ? await ctx.db
                .query("appointments")
                .withIndex("by_legacy_id", (q) => q.eq("id", appointment_id))
                .unique()
            : null;
          return {
            id,
            category,
            actor_name,
            action,
            details,
            created_at,
            appointments: a ? { reference: a.reference, patient_name: a.patient_name } : null,
          };
        },
      ),
    );
  },
});
