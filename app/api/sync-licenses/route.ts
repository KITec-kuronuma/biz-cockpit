import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BILLING_CYCLE_MAP: Record<string, string> = {
  毎月: "MONTHLY",
  月次: "MONTHLY",
  毎年: "YEARLY",
  年次: "YEARLY",
  一括: "ONE_TIME",
  自動更新: "MONTHLY",
};

function parseDate(s: unknown): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str || str === "0") return null;
  if (/^\d{4,5}$/.test(str)) {
    const d = new Date((Number(str) - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str.replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(s: unknown): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[¥￥,\s]/g, ""));
  return isNaN(n) || n < 0 ? 0 : Math.round(n);
}

// YYYY/MM → YYYY-MM 正規化
function parseYearMonth(s: unknown): string | null {
  if (!s) return null;
  const str = String(s).trim().replace(/\//g, "-");
  return /^\d{4}-\d{2}$/.test(str) ? str : null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.SYNC_API_KEY;
  const auth = req.headers.get("Authorization") ?? "";
  if (!apiKey || auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rows: Record<string, unknown>[];
  try {
    const body = await req.json();
    rows = Array.isArray(body.rows) ? body.rows : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const licenseAgreement = String(row["使用許諾契約書"] ?? "").trim();
    if (!licenseAgreement) {
      skipped++;
      continue;
    }

    const clientName = String(row["クライアント"] ?? "").trim();
    if (!clientName) {
      errors.push(`${licenseAgreement}: クライアントが空欄のためスキップ`);
      skipped++;
      continue;
    }

    const startDate = parseDate(row["開始"]);
    if (!startDate) {
      errors.push(`${licenseAgreement}: 開始日が不正のためスキップ`);
      skipped++;
      continue;
    }

    let client = await prisma.client.findFirst({ where: { name: clientName } });
    if (!client) {
      client = await prisma.client.create({ data: { name: clientName } });
    }

    const billingCycleRaw = String(row["請求月"] ?? "").trim();
    const billingCycle = BILLING_CYCLE_MAP[billingCycleRaw] ?? "MONTHLY";

    const data = {
      clientId: client.id,
      productName: String(row["内容"] ?? "").trim() || licenseAgreement,
      serviceType: String(row["サービス区分"] ?? "LICENSE").trim(),
      licenseAgreement,
      memorandum: String(row["覚書"] ?? "").trim() || null,
      startDate,
      endDate: parseDate(row["終了"]),
      monthlyAmount: parseAmount(row["金額（税抜）"] ?? row["金額"]),
      billingCycle,
      quoteSentMonth: parseYearMonth(row["見積書送付月"]),
      note: String(row["備考"] ?? "").trim() || null,
      status: "ACTIVE",
    };

    try {
      const existing = await prisma.licenseContract.findFirst({
        where: { licenseAgreement },
      });
      if (existing) {
        await prisma.licenseContract.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.licenseContract.create({ data });
        created++;
      }
    } catch (e) {
      errors.push(`${licenseAgreement}: DB更新失敗 — ${String(e).slice(0, 80)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    errors,
    syncedAt: new Date().toISOString(),
  });
}
