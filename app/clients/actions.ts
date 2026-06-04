"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  note: z.string().optional(),
});

export async function createClient(formData: FormData) {
  const data = clientSchema.parse({
    name: formData.get("name"),
    note: formData.get("note") || undefined,
  });
  const created = await prisma.client.create({
    data: { name: data.name, note: data.note ?? null },
  });
  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const data = clientSchema.parse({
    name: formData.get("name"),
    note: formData.get("note") || undefined,
  });
  await prisma.client.update({
    where: { id: clientId },
    data: { name: data.name, note: data.note ?? null },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
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
