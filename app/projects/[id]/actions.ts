"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  revalidatePath(`/projects/${data.projectId}`);
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
  // 入金合計が請求額以上なら PAID へ
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
  revalidatePath(`/projects/${data.projectId}`);
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
