"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const projectSchema = z
  .object({
    clientId: z.string().min(1, "取引先は必須です"),
    title: z.string().min(1, "案件名は必須です"),
    contractDate: z.string().optional(),
    deliveryDate: z.string().optional(),
    contractAmount: z.coerce.number().int().min(0, "0以上の整数を入力してください"),
    taxRate: z.coerce.number().int().min(0).max(100).default(10),
    licenseFee: z.coerce.number().int().min(0).optional(),
    licenseStartDate: z.string().optional(),
    licenseCycle: z.string().optional(),
    status: z.string().default("LEAD"),
    progress: z.string().default("NOT_STARTED"),
    detailPhase: z.string().optional(),
    initialForecast: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
    note: z.string().optional(),
  })
  .refine(
    (d) => {
      if (d.contractDate && d.deliveryDate) {
        return new Date(d.contractDate) <= new Date(d.deliveryDate);
      }
      return true;
    },
    { message: "契約日は納品日以前である必要があります", path: ["deliveryDate"] }
  );

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  return new Date(s + "T00:00:00Z");
}

export async function createProject(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = projectSchema.parse({
    ...raw,
    licenseFee: raw.licenseFee || undefined,
  });

  const created = await prisma.project.create({
    data: {
      clientId: data.clientId,
      title: data.title,
      contractDate: parseDate(data.contractDate),
      deliveryDate: parseDate(data.deliveryDate),
      contractAmount: data.contractAmount,
      taxRate: data.taxRate,
      licenseFee: data.licenseFee ?? null,
      licenseStartDate: parseDate(data.licenseStartDate),
      licenseCycle: data.licenseCycle || null,
      status: data.status,
      progress: data.progress,
      detailPhase: data.detailPhase || null,
      initialForecast: data.initialForecast || null,
      note: data.note || null,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = projectSchema.parse({
    ...raw,
    licenseFee: raw.licenseFee || undefined,
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      clientId: data.clientId,
      title: data.title,
      contractDate: parseDate(data.contractDate),
      deliveryDate: parseDate(data.deliveryDate),
      contractAmount: data.contractAmount,
      taxRate: data.taxRate,
      licenseFee: data.licenseFee ?? null,
      licenseStartDate: parseDate(data.licenseStartDate),
      licenseCycle: data.licenseCycle || null,
      status: data.status,
      progress: data.progress,
      detailPhase: data.detailPhase || null,
      initialForecast: data.initialForecast || null,
      note: data.note || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteProject(projectId: string) {
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/projects");
}
