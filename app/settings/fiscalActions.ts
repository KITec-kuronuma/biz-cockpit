"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const fySchema = z.object({
  label: z.string().min(1, "ラベルは必須です"),
  startYM: z.string().regex(/^\d{4}-\d{2}$/, "開始年月はYYYY-MM形式"),
  endYM: z.string().regex(/^\d{4}-\d{2}$/, "終了年月はYYYY-MM形式"),
  isCurrent: z.coerce.boolean().default(false),
  note: z.string().optional(),
});

export async function createFiscalYear(formData: FormData) {
  const data = fySchema.parse({
    label: formData.get("label"),
    startYM: formData.get("startYM"),
    endYM: formData.get("endYM"),
    isCurrent: formData.get("isCurrent") === "on" || formData.get("isCurrent") === "true",
    note: formData.get("note") || undefined,
  });

  if (data.startYM > data.endYM) {
    throw new Error("終了年月は開始年月以降である必要があります");
  }

  if (data.isCurrent) {
    await prisma.fiscalYear.updateMany({ data: { isCurrent: false } });
  }

  await prisma.fiscalYear.create({
    data: {
      label: data.label,
      startYM: data.startYM,
      endYM: data.endYM,
      isCurrent: data.isCurrent,
      note: data.note ?? null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function updateFiscalYear(fiscalYearId: string, formData: FormData) {
  const data = fySchema.parse({
    label: formData.get("label"),
    startYM: formData.get("startYM"),
    endYM: formData.get("endYM"),
    isCurrent: formData.get("isCurrent") === "on" || formData.get("isCurrent") === "true",
    note: formData.get("note") || undefined,
  });

  if (data.startYM > data.endYM) {
    throw new Error("終了年月は開始年月以降である必要があります");
  }

  if (data.isCurrent) {
    await prisma.fiscalYear.updateMany({
      where: { id: { not: fiscalYearId } },
      data: { isCurrent: false },
    });
  }

  await prisma.fiscalYear.update({
    where: { id: fiscalYearId },
    data: {
      label: data.label,
      startYM: data.startYM,
      endYM: data.endYM,
      isCurrent: data.isCurrent,
      note: data.note ?? null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function deleteFiscalYear(fiscalYearId: string) {
  await prisma.fiscalYear.delete({ where: { id: fiscalYearId } });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/finance");
}

export async function setCurrentFiscalYear(fiscalYearId: string) {
  await prisma.fiscalYear.updateMany({ data: { isCurrent: false } });
  await prisma.fiscalYear.update({
    where: { id: fiscalYearId },
    data: { isCurrent: true },
  });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/finance");
}
