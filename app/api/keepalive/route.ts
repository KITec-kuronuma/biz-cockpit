import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Supabase 無料プランの自動一時停止を防ぐための keepalive エンドポイント
 * Vercel Cron Job から毎朝9時（JST）に呼び出される
 * vercel.json の crons 設定で自動実行
 */
export async function GET(req: Request) {
  // Vercel Cron からの呼び出し検証（本番環境のみ）
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 最軽量のクエリでDB接続を維持
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
