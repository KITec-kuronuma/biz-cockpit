"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const forecastSchema = z.object({
  projectId: z.string(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式で入力"),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export async function addForecast(formData: FormData) {
  const data = forecastSchema.parse({
    projectId: formData.get("projectId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });

  await prisma.projectMonthlyForecast.upsert({
    where: { projectId_yearMonth: { projectId: data.projectId, yearMonth: data.yearMonth } },
    create: {
      projectId: data.projectId,
      yearMonth: data.yearMonth,
      amount: data.amount,
      note: data.note ?? null,
    },
    update: {
      amount: data.amount,
      note: data.note ?? null,
    },
  });

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function deleteForecast(forecastId: string, projectId: string) {
  await prisma.projectMonthlyForecast.delete({ where: { id: forecastId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}
