import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Supabase 無料プランの自動一時停止を防ぐための keepalive エンドポイント
 * vercel.json の crons 設定で毎日 UTC 0:00（JST 9:00）に自動実行される
 */
export async function GET() {
  try {
    const count = await prisma.project.count();
    return NextResponse.json({
      ok: true,
      projects: count,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 200) },
      { status: 500 }
    );
  }
}
