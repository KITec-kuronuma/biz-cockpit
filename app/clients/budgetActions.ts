"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const budgetSchema = z.object({
  clientId: z.string(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式で入力"),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export async function upsertClientBudget(formData: FormData) {
  const data = budgetSchema.parse({
    clientId: formData.get("clientId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });

  await prisma.clientMonthlyBudget.upsert({
    where: { clientId_yearMonth: { clientId: data.clientId, yearMonth: data.yearMonth } },
    create: {
      clientId: data.clientId,
      yearMonth: data.yearMonth,
      amount: data.amount,
      note: data.note ?? null,
    },
    update: {
      amount: data.amount,
      note: data.note ?? null,
    },
  });

  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function deleteClientBudget(budgetId: string, clientId: string) {
  await prisma.clientMonthlyBudget.delete({ where: { id: budgetId } });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}
