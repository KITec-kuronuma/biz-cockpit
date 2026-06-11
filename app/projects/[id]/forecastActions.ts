"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const forecastSchema = z.object({
  projectId: z.string(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式で入力"),
  amount: z.coerce.number().int().min(0),
  initialAmount: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
});

// 月別見込みを追加 or 現状見込みのみ更新
// 期初予想は新規登録時のみ amount と同じ値で記録される（既存月への再登録では現状見込みのみ更新）
export async function upsertForecast(formData: FormData) {
  const initialRaw = formData.get("initialAmount");
  const data = forecastSchema.parse({
    projectId: formData.get("projectId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    initialAmount: initialRaw !== null && initialRaw !== "" ? initialRaw : undefined,
    note: formData.get("note") || undefined,
  });

  await prisma.projectMonthlyForecast.upsert({
    where: { projectId_yearMonth: { projectId: data.projectId, yearMonth: data.yearMonth } },
    create: {
      projectId: data.projectId,
      yearMonth: data.yearMonth,
      initialAmount: data.initialAmount ?? data.amount,
      amount: data.amount,
      note: data.note ?? null,
    },
    update: {
      amount: data.amount,
      // 期初予想額は明示的に渡された場合のみ更新（誤入力訂正等）
      ...(data.initialAmount !== undefined && { initialAmount: data.initialAmount }),
      note: data.note ?? null,
    },
  });

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

// 期初予想額を任意の値に更新（個別レコード）
export async function updateInitialForecast(formData: FormData) {
  const forecastId = String(formData.get("forecastId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const initialAmount = Number(formData.get("initialAmount") ?? 0);
  if (!forecastId || !projectId) return;
  await prisma.projectMonthlyForecast.update({
    where: { id: forecastId },
    data: { initialAmount: Math.max(0, Math.round(initialAmount)) },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

// 期初予想を現状見込みに揃える（リセット）
export async function resetInitialForecast(forecastId: string, projectId: string) {
  const f = await prisma.projectMonthlyForecast.findUnique({ where: { id: forecastId } });
  if (!f) return;
  await prisma.projectMonthlyForecast.update({
    where: { id: forecastId },
    data: { initialAmount: f.amount },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function deleteForecast(forecastId: string, projectId: string) {
  await prisma.projectMonthlyForecast.delete({ where: { id: forecastId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

// 旧コード互換のためのエイリアス（既存呼び出し箇所のため）
export const addForecast = upsertForecast;
