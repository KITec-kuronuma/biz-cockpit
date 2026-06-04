import { prisma } from "@/lib/prisma";
import { SEND_FLAG_LABELS } from "@/lib/types";

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    include: { client: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">担当者一覧</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">氏名</th>
              <th className="px-3">取引先</th>
              <th className="px-3">役職</th>
              <th className="px-3">メール</th>
              <th className="px-3">電話</th>
              <th className="px-3">送付区分</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const flags = c.sendFlags?.split(",").filter(Boolean) ?? [];
              return (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 text-slate-600 text-xs">{c.client.name}</td>
                  <td className="px-3 text-xs">{c.role ?? "—"}</td>
                  <td className="px-3 text-xs">{c.email ?? "—"}</td>
                  <td className="px-3 text-xs">{c.phone ?? "—"}</td>
                  <td className="px-3">
                    {flags.length === 0 ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      flags.map((f) => (
                        <span
                          key={f}
                          className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold bg-blue-100 text-blue-800"
                        >
                          {SEND_FLAG_LABELS[f] ?? f}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
