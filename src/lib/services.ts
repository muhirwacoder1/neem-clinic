import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export type Service = FunctionReturnType<typeof api.catalog.services>[number];
const noServices: Service[] = [];

export function useServices(includeInactive = false) {
  const active = useQuery(api.catalog.services, includeInactive ? "skip" : {});
  const all = useQuery(api.catalog.allServices, includeInactive ? {} : "skip");
  return (includeInactive ? all : active) ?? noServices;
}

export function useServiceName() {
  const services = useServices();
  return (id: string) => services.find((service) => service.id === id)?.name ?? id;
}
