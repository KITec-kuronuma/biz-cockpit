import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";

export default async function ActivitiesPage() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: "desc" },
  });

  // Get related clients/projects for display
  const clientIds = [...new Set(activities.map((a) => a.clientId).filter(Boolean))] as string[];
  const projectIds = [...new Set(activities.map((a) => a.projectId).filter(Boolean))] as string[];
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: clientIds } } }),
    prisma.project.findMany({ where: { id: { in: projectIds } } }),
  ]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.title]));

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">活動履歴</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">日時</th>
              <th className="px-3">種別</th>
              <th className="px-3">取引先</th>
              <th className="px-3">関連案件</th>
              <th className="px-3">内容</th>
              <th className="px-3">次回アクション</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDate(a.date)}</td>
                <td className="px-3 text-xs">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</td>
                <td className="px-3 text-xs">{a.clientId ? clientMap[a.clientId] : "—"}</td>
                <td className="px-3 text-xs">
                  {a.projectId ? (
                    <a href="/projects" className="text-blue-600 hover:underline">
                      {projectMap[a.projectId]} →
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 text-xs">{a.content}</td>
                <td className="px-3 text-xs text-slate-500">{a.nextAction ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
