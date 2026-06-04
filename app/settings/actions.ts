"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const settingSchema = z.object({
  fiscalStartMonth: z.coerce.number().int().min(1).max(12),
  targetContractAmount: z.coerce.number().int().min(0),
  targetContractCount: z.coerce.number().int().min(0),
  defaultRevenueBasis: z.enum(["DELIVERY", "INVOICE", "CONTRACT"]),
  annualBudgetRevenue: z.coerce.number().int().min(0),
  taxRate: z.coerce.number().int().min(0).max(100),
});

export async function updateSetting(formData: FormData) {
  const data = settingSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.setting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/finance");
}
