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
  serviceType: z.enum(["LICENSE", "MAINTENANCE"]).default("LICENSE"),
  initialMonthlyAmount: z.coerce.number().int().min(0).optional(),
  monthlyAmount: z.coerce.number().int().min(0),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
  startDate: z.string().min(1, "契約開始日は必須です"),
  endDate: z.string().optional(),
  nextRenewalDate: z.string().optional(),
  renewalType: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
  status: z.enum(["ACTIVE", "SCHEDULED_CANCEL", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
  licenseAgreement: z.string().optional(),
  memorandum: z.string().optional(),
  quoteSentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
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
      serviceType: data.serviceType,
      initialMonthlyAmount: data.monthlyAmount,
      monthlyAmount: data.monthlyAmount,
      billingCycle: data.billingCycle,
      startDate: startDate,
      endDate: parseDate(data.endDate),
      nextRenewalDate: parseDate(data.nextRenewalDate),
      renewalType: data.renewalType,
      status: data.status,
      licenseAgreement: data.licenseAgreement || null,
      memorandum: data.memorandum || null,
      quoteSentMonth: data.quoteSentMonth || null,
      note: data.note || null,
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
      serviceType: data.serviceType,
      // 期初予想額：明示的に渡された場合のみ更新（誤訂正対応）
      ...(data.initialMonthlyAmount !== undefined && {
        initialMonthlyAmount: data.initialMonthlyAmount,
      }),
      monthlyAmount: data.monthlyAmount,
      billingCycle: data.billingCycle,
      startDate: parseDate(data.startDate)!,
      endDate: parseDate(data.endDate),
      nextRenewalDate: parseDate(data.nextRenewalDate),
      renewalType: data.renewalType,
      status: data.status,
      licenseAgreement: data.licenseAgreement || null,
      memorandum: data.memorandum || null,
      quoteSentMonth: data.quoteSentMonth || null,
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

// ===== 期初予算スケジュール（月別変則予算・複数登録可） =====

const initialScheduleSchema = z.object({
  licenseId: z.string(),
  effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式"),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export async function addLicenseInitialSchedule(formData: FormData) {
  const data = initialScheduleSchema.parse({
    licenseId: formData.get("licenseId"),
    effectiveMonth: formData.get("effectiveMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  await prisma.licenseInitialSchedule.create({
    data: {
      licenseId: data.licenseId,
      effectiveMonth: data.effectiveMonth,
      amount: data.amount,
      note: data.note ?? null,
    },
  });
  revalidatePath(`/contracts/${data.licenseId}/edit`);
  revalidatePath("/contracts");
  revalidatePath("/");
}

export async function deleteLicenseInitialSchedule(scheduleId: string, licenseId: string) {
  await prisma.licenseInitialSchedule.delete({ where: { id: scheduleId } });
  revalidatePath(`/contracts/${licenseId}/edit`);
  revalidatePath("/contracts");
  revalidatePath("/");
}

// ===== 計上予定スケジュール（適用開始月ベース・複数登録可） =====

const scheduleSchema = z.object({
  licenseId: z.string(),
  effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式"),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export async function addLicenseSchedule(formData: FormData) {
  const data = scheduleSchema.parse({
    licenseId: formData.get("licenseId"),
    effectiveMonth: formData.get("effectiveMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  await prisma.licenseMonthlySchedule.create({
    data: {
      licenseId: data.licenseId,
      effectiveMonth: data.effectiveMonth,
      amount: data.amount,
      note: data.note ?? null,
    },
  });
  // 直近の最新値を monthlyAmount にも反映（ダッシュ用フォールバック）
  const all = await prisma.licenseMonthlySchedule.findMany({
    where: { licenseId: data.licenseId },
    orderBy: { effectiveMonth: "desc" },
    take: 1,
  });
  if (all[0]) {
    await prisma.licenseContract.update({
      where: { id: data.licenseId },
      data: { monthlyAmount: all[0].amount },
    });
  }
  revalidatePath(`/contracts/${data.licenseId}/edit`);
  revalidatePath("/contracts");
  revalidatePath("/");
}

export async function deleteLicenseSchedule(scheduleId: string, licenseId: string) {
  await prisma.licenseMonthlySchedule.delete({ where: { id: scheduleId } });
  // 残スケジュールの最新値を monthlyAmount に反映
  const all = await prisma.licenseMonthlySchedule.findMany({
    where: { licenseId },
    orderBy: { effectiveMonth: "desc" },
    take: 1,
  });
  if (all[0]) {
    await prisma.licenseContract.update({
      where: { id: licenseId },
      data: { monthlyAmount: all[0].amount },
    });
  }
  revalidatePath(`/contracts/${licenseId}/edit`);
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
