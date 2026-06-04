import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/types";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">ユーザー管理</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">氏名</th>
              <th className="px-3">メール</th>
              <th className="px-3">部署</th>
              <th className="px-3">ロール</th>
              <th className="px-3">状態</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-medium">{u.name}</td>
                <td className="px-3 text-xs">{u.email}</td>
                <td className="px-3 text-xs">{u.department ?? "—"}</td>
                <td className="px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100">
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-3 text-xs">{u.active ? "有効" : "無効"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
