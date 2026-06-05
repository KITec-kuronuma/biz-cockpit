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
});

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  return new Date(s + "T00:00:00Z");
}

function buildData(d: z.infer<typeof licenseSchema>) {
  return {
    clientId: d.clientId,
    projectId: d.projectId || null,
    productName: d.productName,
    planName: d.planName || null,
    monthlyAmount: d.monthlyAmount,
    billingCycle: d.billingCycle,
    startDate: parseDate(d.startDate)!,
    endDate: parseDate(d.endDate),
    nextRenewalDate: parseDate(d.nextRenewalDate),
    renewalType: d.renewalType,
    status: d.status,
    note: d.note || null,
  };
}

export async function createLicense(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = licenseSchema.parse(raw);
  await prisma.licenseContract.create({ data: buildData(data) });
  revalidatePath("/contracts");
  revalidatePath("/");
  redirect("/contracts");
}

export async function updateLicense(licenseId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = licenseSchema.parse(raw);
  await prisma.licenseContract.update({
    where: { id: licenseId },
    data: buildData(data),
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
