import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";

// 全ページ動的レンダリング（DB接続を要するため）
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "biz-cockpit | 業務管理ダッシュボード",
  description: "案件・契約・請求・入金を一元管理",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="ja" className="h-full">
      <body className="h-full">
        <div className="flex h-screen overflow-hidden">
          <Sidebar userEmail={user?.email ?? undefined} />
          <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
        </div>
      </body>
    </html>
  );
}
