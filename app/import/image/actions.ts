"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  extractFromImage,
  matchExistingClient,
  ExtractionResult,
  ExtractedContact,
} from "@/lib/import/vision";

export interface ExtractActionResult {
  ok: boolean;
  result?: ExtractionResult & { matchedClientId: string | null; matchedClientName?: string };
  error?: string;
}

export async function extractImage(formData: FormData): Promise<ExtractActionResult> {
  try {
    const file = formData.get("image") as File | null;
    const hint = (formData.get("hint") as string) || undefined;
    if (!file) return { ok: false, error: "画像が選択されていません" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = file.type || "image/png";

    const result = await extractFromImage(base64, mediaType, hint);

    // 既存取引先と簡易マッチング
    const allClients = await prisma.client.findMany({ select: { id: true, name: true } });
    const matchedClientId = matchExistingClient(result.client, allClients);
    const matchedClient = matchedClientId
      ? allClients.find((c) => c.id === matchedClientId)
      : null;

    return {
      ok: true,
      result: {
        ...result,
        matchedClientId,
        matchedClientName: matchedClient?.name,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface SaveExtractionInput {
  targetClientId: string | null; // null なら新規取引先として登録
  clientData?: {
    name?: string;
    address?: string;
    phone?: string;
    fax?: string;
    website?: string;
    industry?: string;
  };
  contacts: ExtractedContact[];
}

export async function saveExtraction(
  input: SaveExtractionInput
): Promise<{ ok: boolean; clientId?: string; addedContacts?: number; error?: string }> {
  try {
    let clientId = input.targetClientId;

    if (!clientId) {
      // 新規取引先として登録
      if (!input.clientData?.name) {
        return { ok: false, error: "新規取引先として登録するには会社名が必要です" };
      }
      const created = await prisma.client.create({
        data: {
          name: input.clientData.name,
          address: input.clientData.address || null,
          phone: input.clientData.phone || null,
          fax: input.clientData.fax || null,
          website: input.clientData.website || null,
          industry: input.clientData.industry || null,
        },
      });
      clientId = created.id;
    } else if (input.clientData) {
      // 既存取引先の情報を補完（空欄なら追加）
      const existing = await prisma.client.findUnique({ where: { id: clientId } });
      if (existing) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            address: existing.address ?? input.clientData.address ?? null,
            phone: existing.phone ?? input.clientData.phone ?? null,
            fax: existing.fax ?? input.clientData.fax ?? null,
            website: existing.website ?? input.clientData.website ?? null,
            industry: existing.industry ?? input.clientData.industry ?? null,
          },
        });
      }
    }

    let addedContacts = 0;
    for (const c of input.contacts) {
      if (!c.name) continue;
      // 同名担当者があれば更新、なければ追加
      const existing = await prisma.contact.findFirst({
        where: { clientId: clientId!, name: c.name },
      });
      const flagStr =
        c.sendFlags && c.sendFlags.length > 0 ? c.sendFlags.join(",") : null;
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            role: c.role ?? existing.role,
            email: c.email ?? existing.email,
            phone: c.phone ?? existing.phone,
            sendFlags: flagStr ?? existing.sendFlags,
          },
        });
      } else {
        await prisma.contact.create({
          data: {
            clientId: clientId!,
            name: c.name,
            role: c.role || null,
            email: c.email || null,
            phone: c.phone || null,
            sendFlags: flagStr,
          },
        });
        addedContacts++;
      }
    }

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    revalidatePath("/contacts");

    return { ok: true, clientId: clientId!, addedContacts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getClientsForSelection() {
  return prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
