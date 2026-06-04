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

// 詳細フェーズから 契約状況・進捗 を自動推定（運用簡素化）
function inferStatusProgress(detailPhase: string | undefined): {
  status: string;
  progress: string;
} {
  switch (detailPhase) {
    case "kikaku":
    case "mitsumori":
      return { status: "LEAD", progress: "NOT_STARTED" };
    case "ringi":
    case "ringi_saki":
      return { status: "NEGOTIATING", progress: "NOT_STARTED" };
    case "keiyaku":
      return { status: "WON", progress: "NOT_STARTED" };
    case "kaihatsu":
      return { status: "WON", progress: "IN_PROGRESS" };
    case "ukenyu":
      return { status: "WON", progress: "DELIVERED" };
    case "seikyu":
    case "miunyou":
      return { status: "WON", progress: "DELIVERED" };
    case "kanryo":
      return { status: "WON", progress: "COMPLETED" };
    case "shanai":
      return { status: "ON_HOLD", progress: "NOT_STARTED" };
    case "miokuri":
      return { status: "LOST", progress: "NOT_STARTED" };
    default:
      return { status: "LEAD", progress: "NOT_STARTED" };
  }
}

function buildData(d: z.infer<typeof projectSchema>) {
  const inferred = inferStatusProgress(d.detailPhase);
  return {
    clientId: d.clientId,
    title: d.title,
    contractDate: parseDate(d.contractDate),
    deliveryDate: parseDate(d.deliveryDate),
    contractAmount: d.contractAmount,
    taxRate: d.taxRate,
    licenseFee: d.licenseFee ?? null,
    licenseStartDate: parseDate(d.licenseStartDate),
    licenseCycle: d.licenseCycle || null,
    status: inferred.status,
    progress: inferred.progress,
    detailPhase: d.detailPhase || null,
    initialForecast: d.initialForecast || null,
    note: d.note || null,
  };
}

export async function createProject(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = projectSchema.parse({
    ...raw,
    licenseFee: raw.licenseFee || undefined,
  });

  const created = await prisma.project.create({ data: buildData(data) });

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
    data: buildData(data),
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  // 更新後は詳細画面に戻る（保存完了が分かりやすいよう）
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/projects");
}
