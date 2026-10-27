"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// 前進できるフェーズ順（miokuri/shanai は手動設定の終端状態なので自動遷移しない）
const PHASE_ORDER = [
  "kikaku", "mitsumori", "ringi", "ringi_saki",
  "keiyaku", "kaihatsu", "ukenyu", "seikyu", "miunyou", "kanryo",
];

// detailPhase から status/progress を解決（actions.ts の inferStatusProgress と同じ内容）
function phaseToStatusProgress(detailPhase: string): { status: string; progress: string } {
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
    case "seikyu":
    case "miunyou":
      return { status: "WON", progress: "DELIVERED" };
    case "kanryo":
      return { status: "WON", progress: "COMPLETED" };
    default:
      return { status: "LEAD", progress: "NOT_STARTED" };
  }
}

// 案件フェーズを自動的に targetPhase へ進める（後退・miokuri/shanai は対象外）
async function advanceProjectPhase(projectId: string, targetPhase: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { detailPhase: true },
  });
  if (!project) return;

  const currentPhase = project.detailPhase ?? "";
  // miokuri/shanai は手動設定の状態なので自動変更しない
  if (currentPhase === "miokuri" || currentPhase === "shanai") return;

  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);

  // 現在のフェーズより前の段階にしか進まない（後退なし）
  if (targetIndex <= currentIndex) return;

  const { status, progress } = phaseToStatusProgress(targetPhase);
  await prisma.project.update({
    where: { id: projectId },
    data: { detailPhase: targetPhase, status, progress },
  });
}

const invoiceSchema = z.object({
  projectId: z.string(),
  invoiceDate: z.string().min(1),
  amount: z.coerce.number().int().min(0),
  dueDate: z.string().optional(),
});

export async function addInvoice(formData: FormData) {
  const data = invoiceSchema.parse({
    projectId: formData.get("projectId"),
    invoiceDate: formData.get("invoiceDate"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate") || undefined,
  });
  await prisma.invoice.create({
    data: {
      projectId: data.projectId,
      invoiceDate: new Date(data.invoiceDate + "T00:00:00Z"),
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate + "T00:00:00Z") : null,
      status: "ISSUED",
    },
  });
  // 請求入力 → 案件を「請求中（seikyu）」へ自動遷移
  await advanceProjectPhase(data.projectId, "seikyu");
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteInvoice(invoiceId: string, projectId: string) {
  await prisma.invoice.delete({ where: { id: invoiceId } });
  revalidatePath(`/projects/${projectId}`);
}

const paymentSchema = z.object({
  invoiceId: z.string(),
  projectId: z.string(),
  paymentDate: z.string().min(1),
  amount: z.coerce.number().int().min(0),
});

export async function addPayment(formData: FormData) {
  const data = paymentSchema.parse({
    invoiceId: formData.get("invoiceId"),
    projectId: formData.get("projectId"),
    paymentDate: formData.get("paymentDate"),
    amount: formData.get("amount"),
  });
  await prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      paymentDate: new Date(data.paymentDate + "T00:00:00Z"),
      amount: data.amount,
    },
  });
  // 入金合計が請求額以上なら請求書を PAID へ
  const inv = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: { payments: true },
  });
  if (inv) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    if (paid >= inv.amount) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: "PAID" } });
    }
  }
  // 案件の全請求書が PAID なら「完了（kanryo）」へ自動遷移
  const allInvoices = await prisma.invoice.findMany({
    where: { projectId: data.projectId },
    include: { payments: true },
  });
  const allPaid =
    allInvoices.length > 0 &&
    allInvoices.every((i) => {
      const totalPaid = i.payments.reduce((s, p) => s + p.amount, 0);
      return totalPaid >= i.amount;
    });
  if (allPaid) {
    await advanceProjectPhase(data.projectId, "kanryo");
  }
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

const costSchema = z.object({
  projectId: z.string(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.coerce.number().int().min(0),
  category: z.string().optional(),
});

export async function addCost(formData: FormData) {
  const data = costSchema.parse({
    projectId: formData.get("projectId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    category: formData.get("category") || undefined,
  });
  await prisma.costMonthly.create({
    data: {
      projectId: data.projectId,
      yearMonth: data.yearMonth,
      amount: data.amount,
      category: data.category,
    },
  });
  revalidatePath(`/projects/${data.projectId}`);
}

export async function deleteCost(costId: string, projectId: string) {
  await prisma.costMonthly.delete({ where: { id: costId } });
  revalidatePath(`/projects/${projectId}`);
}
