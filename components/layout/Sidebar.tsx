"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const MAIN_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/projects", label: "案件一覧", icon: "💼" },
  { href: "/clients", label: "取引先", icon: "🏢" },
  { href: "/finance", label: "財務（PL / CF）", icon: "💹" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

const SUB_ITEMS = [
  { href: "/contacts", label: "担当者一覧", icon: "👤" },
  { href: "/forecast", label: "売上見込タイムライン", icon: "📅" },
  { href: "/contracts", label: "ライセンス契約一覧", icon: "🔄" },
  { href: "/activities", label: "活動履歴", icon: "📝" },
  { href: "/users", label: "ユーザー管理", icon: "👥" },
  { href: "/import", label: "Excelインポート", icon: "📥" },
];

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
      }`}
    >
      <span className="w-4 text-center text-sm">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  // ログインページではサイドバーを非表示
  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="w-60 min-w-60 bg-slate-800 flex flex-col overflow-y-auto">
      <div className="px-6 py-5 border-b border-slate-700 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          BC
        </div>
        <span className="text-white text-sm font-semibold">biz-cockpit</span>
      </div>

      <div className="px-3 pt-4 pb-1">
        <div className="px-3 text-[10px] text-slate-600 uppercase tracking-wider mb-1">メイン</div>
        <div className="flex flex-col gap-0.5">
          {MAIN_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
            />
          ))}
        </div>
      </div>

      <div className="px-3 pt-4 pb-1">
        <div className="px-3 text-[10px] text-slate-600 uppercase tracking-wider mb-1">補助機能</div>
        <div className="flex flex-col gap-0.5">
          {SUB_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-slate-700">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {userEmail?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-200 text-xs font-medium truncate" title={userEmail}>
              {userEmail ?? "未ログイン"}
            </div>
            <div className="text-slate-500 text-[11px]">ログイン中</div>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs"
          >
            ログアウト
          </button>
        </form>
      </div>
    </nav>
  );
}
