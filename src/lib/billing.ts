import type { Service } from "./services";

export const PAYMENT_METHODS = [
  { id: "cash", name: "Cash" },
  { id: "mobile_money", name: "Mobile Money" },
  { id: "card", name: "Card" },
  { id: "insurance", name: "Insurance" },
] as const;

export const paymentName = (id: string | null) => PAYMENT_METHODS.find((m) => m.id === id)?.name ?? "—";

export const formatRWF = (n: number) => `${new Intl.NumberFormat("en-US").format(n)} RWF`;

/** MTN MoMo merchant pay code shown to patients. */
export const PAY_CODE = "*182*8*1*2088293#";
export const PAY_HREF = "tel:" + PAY_CODE.replace(/#/g, "%23");

/** Departments a staff member may bill from. */
export function allowedDepartments(role: string, service: string | null, services: Service[]): string[] {
  if (role === "super_admin") return services.map((d) => d.id);
  if (role === "checkin") return ["reception"];
  return service ? [service] : services.filter((d) => d.id !== "reception").map((d) => d.id);
}
