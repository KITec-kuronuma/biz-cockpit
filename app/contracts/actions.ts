"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const licenseSchema = z.object({
  clientId: z.string().min(1, "取引先は必須です"),
  projectId: z.string().optional(),
  productName: z.string().min(1, "製品名は必須です"),
  planName: z.string().optional(),
  monthlyAmount: z.coerce.number().int().min(0),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
  startDate: z.string().min(1, "契約開始日は必須です"),
  endDate: z.string().optional(),
  nextRenewalDate: z.string().optional(),
  renewalType: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
  status: z.enum(["ACTIVE", "SCHEDULED_CANCEL", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
  note: z.string().optional(),
  effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  return new Date(s + "T00:00:00Z");
}

function toYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function createLicense(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = licenseSchema.parse(raw);
  const startDate = parseDate(data.startDate)!;
  const startMonth = toYearMonth(startDate);

  // 新規作成：期初予想 = 計上予定 を同値でセット
  await prisma.licenseContract.create({
    data: {
      clientId: data.clientId,
      projectId: data.projectId || null,
      productName: data.productName,
      planName: data.planName || null,
      initialMonthlyAmount: data.monthlyAmount,
      monthlyAmount: data.monthlyAmount,
      billingCycle: data.billingCycle,
      startDate: startDate,
      endDate: parseDate(data.endDate),
      nextRenewalDate: parseDate(data.nextRenewalDate),
      renewalType: data.renewalType,
      status: data.status,
      note: data.note || null,
      // 開始月に初期スケジュールを登録（履歴の起点）
      schedules: {
        create: { effectiveMonth: startMonth, amount: data.monthlyAmount, note: "期初登録" },
      },
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts");
}

export async function updateLicense(licenseId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = licenseSchema.parse(raw);

  const existing = await prisma.licenseContract.findUnique({ where: { id: licenseId } });
  if (!existing) throw new Error("ライセンスが見つかりません");

  // 月額が変更された場合、適用開始月で新スケジュールを記録
  const amountChanged = data.monthlyAmount !== existing.monthlyAmount;
  const effectiveMonth = data.effectiveMonth ?? toYearMonth(new Date());

  await prisma.licenseContract.update({
    where: { id: licenseId },
    data: {
      clientId: data.clientId,
      projectId: data.projectId || null,
      productName: data.productName,
      planName: data.planName || null,
      // initialMonthlyAmount は変更しない
      monthlyAmount: data.monthlyAmount,
      billingCycle: data.billingCycle,
      startDate: parseDate(data.startDate)!,
      endDate: parseDate(data.endDate),
      nextRenewalDate: parseDate(data.nextRenewalDate),
      renewalType: data.renewalType,
      status: data.status,
      note: data.note || null,
      ...(amountChanged && {
        schedules: {
          create: {
            effectiveMonth,
            amount: data.monthlyAmount,
            note: "計上予定変更",
          },
        },
      }),
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts");
}

export async function deleteLicense(licenseId: string) {
  await prisma.licenseContract.delete({ where: { id: licenseId } });
  revalidatePath("/contracts");
  revalidatePath("/");
}

// ===== 月次実績 =====

const actualSchema = z.object({
  licenseId: z.string(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式"),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export async function upsertLicenseActual(formData: FormData) {
  const data = actualSchema.parse({
    licenseId: formData.get("licenseId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });

  await prisma.licenseMonthlyActual.upsert({
    where: { licenseId_yearMonth: { licenseId: data.licenseId, yearMonth: data.yearMonth } },
    create: {
      licenseId: data.licenseId,
      yearMonth: data.yearMonth,
      amount: data.amount,
      note: data.note ?? null,
    },
    update: {
      amount: data.amount,
      note: data.note ?? null,
    },
  });

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${data.licenseId}`);
  revalidatePath("/");
}

export async function deleteLicenseActual(actualId: string, licenseId: string) {
  await prisma.licenseMonthlyActual.delete({ where: { id: actualId } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${licenseId}`);
  revalidatePath("/");
}
