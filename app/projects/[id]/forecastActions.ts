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

// 月別見込みを追加 or 現状見込みのみ更新
// 期初予想は新規登録時のみ amount と同じ値で記録され、その後変更されない
export async function upsertForecast(formData: FormData) {
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
      initialAmount: data.amount, // 新規時のみセット
      amount: data.amount,
      note: data.note ?? null,
    },
    update: {
      // 期初予想（initialAmount）は変更しない
      amount: data.amount,
      note: data.note ?? null,
    },
  });

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/");
  revalidatePath("/finance");
}

// 期初予想を再設定（運用上のリセット）
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
