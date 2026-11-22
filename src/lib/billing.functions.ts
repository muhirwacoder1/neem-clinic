import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "../../convex/_generated/api";

const receiptInput = z.object({ token: z.string().regex(/^[a-f0-9]{36}$/) });

export const getReceiptByToken = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => receiptInput.parse(value))
  .handler(async ({ data }: { data: z.output<typeof receiptInput> }) => {
    const { clinicServer } = await import("@/integrations/convex/server");
    return clinicServer().query(api.billing.receiptByToken, data);
  });
