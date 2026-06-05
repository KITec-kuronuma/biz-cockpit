"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  readWorkbook,
  sheetToRows,
  parseExcelDate,
  parseInt0,
  str,
  strOrNull,
  ImportResult,
} from "@/lib/import/excel";

function toYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function importExcel(formData: FormData): Promise<ImportResult[]> {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("ファイルが選択されていません");

  const buffer = await file.arrayBuffer();
  const wb = readWorkbook(buffer);

  const results: ImportResult[] = [];

  // ===== 取引先 =====
  const clientsResult: ImportResult = {
    type: "取引先",
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const clientRows = sheetToRows(wb, "取引先");
  for (let i = 0; i < clientRows.length; i++) {
    const r = clientRows[i];
    try {
      const name = str(r["会社名"]);
      if (!name) {
        clientsResult.skipped++;
        continue;
      }
      const existing = await prisma.client.findFirst({ where: { name } });
      const data = {
        name,
        industry: strOrNull(r["業種"]),
        address: strOrNull(r["代表住所"]),
        phone: strOrNull(r["代表電話"]),
        fax: strOrNull(r["FAX"]),
        website: strOrNull(r["ウェブサイト"]),
        note: strOrNull(r["備考"]),
      };
      if (existing) {
        // 空欄は維持して更新
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            industry: data.industry ?? existing.industry,
            address: data.address ?? existing.address,
            phone: data.phone ?? existing.phone,
            fax: data.fax ?? existing.fax,
            website: data.website ?? existing.website,
            note: data.note ?? existing.note,
          },
        });
        clientsResult.updated++;
      } else {
        await prisma.client.create({ data });
        clientsResult.added++;
      }
    } catch (e) {
      clientsResult.errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  results.push(clientsResult);

  // ===== 担当者 =====
  const contactsResult: ImportResult = {
    type: "担当者",
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const contactRows = sheetToRows(wb, "担当者");
  for (let i = 0; i < contactRows.length; i++) {
    const r = contactRows[i];
    try {
      const companyName = str(r["会社名"]);
      const name = str(r["氏名"]);
      if (!companyName || !name) {
        contactsResult.skipped++;
        continue;
      }
      const client = await prisma.client.findFirst({ where: { name: companyName } });
      if (!client) {
        contactsResult.errors.push({
          row: i + 2,
          message: `取引先「${companyName}」が見つかりません`,
        });
        continue;
      }
      const existing = await prisma.contact.findFirst({
        where: { clientId: client.id, name },
      });
      const data = {
        clientId: client.id,
        name,
        role: strOrNull(r["役職"]),
        email: strOrNull(r["メール"]),
        phone: strOrNull(r["電話"]),
        sendFlags: strOrNull(r["送付区分"]),
      };
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            role: data.role ?? existing.role,
            email: data.email ?? existing.email,
            phone: data.phone ?? existing.phone,
            sendFlags: data.sendFlags ?? existing.sendFlags,
          },
        });
        contactsResult.updated++;
      } else {
        await prisma.contact.create({ data });
        contactsResult.added++;
      }
    } catch (e) {
      contactsResult.errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  results.push(contactsResult);

  // ===== 案件 =====
  const projectsResult: ImportResult = {
    type: "案件",
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const projectRows = sheetToRows(wb, "案件");
  for (let i = 0; i < projectRows.length; i++) {
    const r = projectRows[i];
    try {
      const companyName = str(r["会社名"]);
      const title = str(r["案件名"]);
      if (!companyName || !title) {
        projectsResult.skipped++;
        continue;
      }
      const client = await prisma.client.findFirst({ where: { name: companyName } });
      if (!client) {
        projectsResult.errors.push({
          row: i + 2,
          message: `取引先「${companyName}」が見つかりません`,
        });
        continue;
      }
      const existing = await prisma.project.findFirst({
        where: { clientId: client.id, title },
      });
      const data = {
        clientId: client.id,
        title,
        contractAmount: parseInt0(r["契約金額"]),
        contractDate: parseExcelDate(r["契約日"]),
        deliveryDate: parseExcelDate(r["納品日"]),
        detailPhase: strOrNull(r["詳細フェーズ"]),
        initialForecast: strOrNull(r["期初予想納品月"]),
        note: strOrNull(r["備考"]),
      };
      if (existing) {
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            contractAmount: data.contractAmount || existing.contractAmount,
            contractDate: data.contractDate ?? existing.contractDate,
            deliveryDate: data.deliveryDate ?? existing.deliveryDate,
            detailPhase: data.detailPhase ?? existing.detailPhase,
            initialForecast: data.initialForecast ?? existing.initialForecast,
            note: data.note ?? existing.note,
          },
        });
        projectsResult.updated++;
      } else {
        await prisma.project.create({ data });
        projectsResult.added++;
      }
    } catch (e) {
      projectsResult.errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  results.push(projectsResult);

  // ===== ライセンス =====
  const licensesResult: ImportResult = {
    type: "ライセンス契約",
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const licenseRows = sheetToRows(wb, "ライセンス");
  for (let i = 0; i < licenseRows.length; i++) {
    const r = licenseRows[i];
    try {
      const companyName = str(r["会社名"]);
      const productName = str(r["製品名"]);
      const startDate = parseExcelDate(r["契約開始日"]);
      if (!companyName || !productName || !startDate) {
        licensesResult.skipped++;
        continue;
      }
      const client = await prisma.client.findFirst({ where: { name: companyName } });
      if (!client) {
        licensesResult.errors.push({
          row: i + 2,
          message: `取引先「${companyName}」が見つかりません`,
        });
        continue;
      }
      // 既存判定：会社名 + 製品名 + 契約開始日
      const existing = await prisma.licenseContract.findFirst({
        where: {
          clientId: client.id,
          productName,
          startDate,
        },
      });
      const monthlyAmount = parseInt0(r["月額"]);
      const baseData = {
        clientId: client.id,
        productName,
        planName: strOrNull(r["プラン名"]),
        serviceType: (str(r["サービス区分"]) || "LICENSE").toUpperCase(),
        billingCycle: (str(r["課金周期"]) || "MONTHLY").toUpperCase(),
        startDate,
        endDate: parseExcelDate(r["契約終了日"]),
        nextRenewalDate: parseExcelDate(r["次回更新日"]),
        renewalType: (str(r["更新タイプ"]) || "MANUAL").toUpperCase(),
        status: (str(r["ステータス"]) || "ACTIVE").toUpperCase(),
        licenseAgreement: strOrNull(r["使用許諾書"]),
        memorandum: strOrNull(r["覚書"]),
        quoteSentMonth: strOrNull(r["見積書送付月"]),
        note: strOrNull(r["備考"]),
      };
      if (existing) {
        await prisma.licenseContract.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            // 期初予想額は変更しない
            monthlyAmount: monthlyAmount || existing.monthlyAmount,
          },
        });
        licensesResult.updated++;
      } else {
        await prisma.licenseContract.create({
          data: {
            ...baseData,
            initialMonthlyAmount: monthlyAmount,
            monthlyAmount,
            schedules: {
              create: {
                effectiveMonth: toYearMonth(startDate),
                amount: monthlyAmount,
                note: "Excelインポート",
              },
            },
          },
        });
        licensesResult.added++;
      }
    } catch (e) {
      licensesResult.errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  results.push(licensesResult);

  revalidatePath("/clients");
  revalidatePath("/contacts");
  revalidatePath("/projects");
  revalidatePath("/contracts");
  revalidatePath("/");

  return results;
}

export async function downloadTemplate() {
  // テンプレートはAPIルートでダウンロードさせる
  return null;
}
