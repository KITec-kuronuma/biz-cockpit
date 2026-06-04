"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  note: z.string().optional(),
});

function toData(d: z.infer<typeof clientSchema>) {
  return {
    name: d.name,
    address: d.address || null,
    phone: d.phone || null,
    fax: d.fax || null,
    website: d.website || null,
    industry: d.industry || null,
    note: d.note || null,
  };
}

export async function createClient(formData: FormData) {
  const data = clientSchema.parse(Object.fromEntries(formData.entries()));
  const created = await prisma.client.create({ data: toData(data) });
  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const data = clientSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.client.update({ where: { id: clientId }, data: toData(data) });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function deleteClient(clientId: string) {
  // 関連案件があれば削除拒否
  const projectCount = await prisma.project.count({ where: { clientId } });
  if (projectCount > 0) {
    throw new Error(
      `この取引先には ${projectCount}件の案件が紐づいているため削除できません。先に案件を削除または別の取引先に移動してください。`
    );
  }
  // 担当者は CASCADE で自動削除される
  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/clients");
  redirect("/clients");
}

const contactSchema = z.object({
  clientId: z.string(),
  name: z.string().min(1, "氏名は必須です"),
  role: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  sendFlags: z.array(z.string()).optional(),
});

export async function addContact(formData: FormData) {
  const flags = formData.getAll("sendFlags") as string[];
  const data = contactSchema.parse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    role: formData.get("role") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    sendFlags: flags,
  });
  await prisma.contact.create({
    data: {
      clientId: data.clientId,
      name: data.name,
      role: data.role ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      sendFlags: data.sendFlags && data.sendFlags.length > 0 ? data.sendFlags.join(",") : null,
    },
  });
  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/contacts");
}

export async function updateContactFlags(contactId: string, clientId: string, formData: FormData) {
  const flags = formData.getAll("sendFlags") as string[];
  await prisma.contact.update({
    where: { id: contactId },
    data: { sendFlags: flags.length > 0 ? flags.join(",") : null },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/contacts");
}

export async function deleteContact(contactId: string, clientId: string) {
  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/contacts");
}
