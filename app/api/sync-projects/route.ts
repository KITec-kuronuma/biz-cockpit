import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Excel「状況」→ detailPhase 変換
const PHASE_MAP: Record<string, string> = {
  企画中: "kikaku",
  見積準備: "mitsumori",
  案議中: "ringi",
  先方社内案議中: "ringi_saki",
  契約手続: "keiyaku",
  開発中: "kaihatsu",
  受入検証: "ukenyu",
  請求中: "seikyu",
  未入金: "miunyou",
  完了: "kanryo",
  社内検討: "shanai",
  見送り: "miokuri",
};

function inferStatusProgress(phase: string | null) {
  switch (phase) {
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

// Excel日付（シリアル値 or 文字列 両対応）
function parseDate(s: unknown): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str || str === "0") return null;
  // Excelシリアル値（例: 46000）
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
    const projectNo = String(row["プロジェクト"] ?? "").trim();
    // PJ- で始まるもののみ対象
    if (!projectNo.startsWith("PJ-")) {
      skipped++;
      continue;
    }

    // 取引先
    const clientName = String(row["取引先略"] ?? "").trim();
    if (!clientName) {
      errors.push(`${projectNo}: 取引先略が空欄のためスキップ`);
      skipped++;
      continue;
    }
    let client = await prisma.client.findFirst({ where: { name: clientName } });
    if (!client) {
      client = await prisma.client.create({ data: { name: clientName } });
    }

    // ステータス変換
    const statusJa = String(row["状況"] ?? "").trim();
    const detailPhase = PHASE_MAP[statusJa] ?? null;
    const { status, progress } = inferStatusProgress(detailPhase);

    // タイトル：見積書件名 → PJ大項目 → projectNo の優先順
    const title =
      String(row["見積書件名"] ?? "").trim() ||
      String(row["PJ大項目"] ?? "").trim() ||
      projectNo;

    // 備考：PJ大項目 + 詳細 を結合
    const noteArr = [
      String(row["PJ大項目"] ?? "").trim(),
      String(row["詳細"] ?? "").trim(),
    ].filter(Boolean);
    const note = noteArr.length > 0 ? noteArr.join("\n") : null;

    const data = {
      clientId: client.id,
      title,
      detailPhase,
      status,
      progress,
      contractAmount: parseAmount(row["金額"]),
      occurredAt: parseDate(row["先注日"] ?? row["登録日"]),
      contractDate: parseDate(row["契約日"]),
      deliveryDate: parseDate(row["納品予定日"]),
      note,
    };

    try {
      const existing = await prisma.project.findFirst({ where: { projectNo } });
      if (existing) {
        await prisma.project.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.project.create({ data: { ...data, projectNo } });
        created++;
      }
    } catch (e) {
      errors.push(`${projectNo}: DB更新失敗 — ${String(e).slice(0, 80)}`);
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
