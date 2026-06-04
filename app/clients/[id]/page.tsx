import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { STATUS_LABELS, SEND_FLAG_LABELS } from "@/lib/types";
import { addContact, deleteContact, updateClient, deleteClient } from "../actions";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import Link from "next/link";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      projects: {
        include: { invoices: { include: { payments: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!client) return notFound();

  // 集計
  const totalContract = client.projects.reduce((s, p) => s + p.contractAmount, 0);
  const totalInvoiced = client.projects.reduce(
    (s, p) => s + p.invoices.reduce((ss, i) => ss + i.amount, 0),
    0
  );
  const totalPaid = client.projects.reduce(
    (s, p) =>
      s + p.invoices.reduce((ss, i) => ss + i.payments.reduce((sss, x) => sss + x.amount, 0), 0),
    0
  );
  const wonCount = client.projects.filter((p) => p.status === "WON").length;

  const updateBound = updateClient.bind(null, id);

  return (
    <div className="p-6 max-w-[1400px]">
      <Link href="/clients" className="text-xs text-blue-600 hover:underline mb-3 inline-block">
        ← 取引先一覧に戻る
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-lg font-bold">取引先情報</h1>
          <DeleteClientButton
            action={deleteClient.bind(null, client.id)}
            projectCount={client.projects.length}
          />
        </div>

        <form action={updateBound} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 block mb-1">会社名 *</label>
            <input
              type="text"
              name="name"
              defaultValue={client.name}
              required
              className="w-full border border-slate-200 rounded px-3 py-2 text-base font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">業種</label>
            <input
              type="text"
              name="industry"
              defaultValue={client.industry ?? ""}
              placeholder="製造業 / 小売業 等"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">ウェブサイト</label>
            <input
              type="text"
              name="website"
              defaultValue={client.website ?? ""}
              placeholder="https://example.co.jp"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 block mb-1">代表住所</label>
            <input
              type="text"
              name="address"
              defaultValue={client.address ?? ""}
              placeholder="東京都千代田区..."
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">代表電話番号</label>
            <input
              type="text"
              name="phone"
              defaultValue={client.phone ?? ""}
              placeholder="03-1234-5678"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">FAX</label>
            <input
              type="text"
              name="fax"
              defaultValue={client.fax ?? ""}
              placeholder="03-1234-5679"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-500 block mb-1">備考</label>
            <textarea
              name="note"
              defaultValue={client.note ?? ""}
              rows={2}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
              💾 更新
            </button>
          </div>
        </form>

        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-200">
          <Info label="累計契約額" value={formatCurrencyFull(totalContract)} highlight />
          <Info label="請求合計" value={formatCurrencyFull(totalInvoiced)} />
          <Info label="入金済" value={formatCurrencyFull(totalPaid)} />
          <Info label="受注案件" value={`${wonCount}件 / ${client.projects.length}件中`} />
        </div>
      </div>

      {/* 担当者 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">👤 担当者 ({client.contacts.length}名)</h2>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">氏名</th>
              <th>役職</th>
              <th>メール</th>
              <th>電話</th>
              <th>送付区分</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {client.contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-slate-400">
                  担当者はまだ登録されていません
                </td>
              </tr>
            )}
            {client.contacts.map((c) => {
              const flags = c.sendFlags?.split(",").filter(Boolean) ?? [];
              return (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="text-xs text-slate-600">{c.role ?? "—"}</td>
                  <td className="text-xs">{c.email ?? "—"}</td>
                  <td className="text-xs">{c.phone ?? "—"}</td>
                  <td>
                    {flags.length === 0 ? (
                      <span className="text-[11px] text-slate-300">—</span>
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
                  <td>
                    <form action={deleteContact.bind(null, c.id, client.id)}>
                      <button className="text-[11px] text-red-600 hover:underline">削除</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 担当者追加フォーム */}
        <details className="border-t pt-3">
          <summary className="text-xs text-blue-600 cursor-pointer mb-2">＋ 担当者を追加</summary>
          <form action={addContact} className="grid grid-cols-12 gap-2 items-end">
            <input type="hidden" name="clientId" value={client.id} />
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 block">氏名 *</label>
              <input
                type="text"
                name="name"
                required
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 block">役職</label>
              <input
                type="text"
                name="role"
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 block">メール</label>
              <input
                type="email"
                name="email"
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 block">電話</label>
              <input
                type="text"
                name="phone"
                className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] text-slate-500 block">送付区分</label>
              <div className="flex gap-2 text-[11px]">
                {Object.entries(SEND_FLAG_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1">
                    <input type="checkbox" name="sendFlags" value={k} className="scale-90" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-1">
              <button className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs">追加</button>
            </div>
          </form>
        </details>
      </div>

      {/* 案件 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold mb-3">💼 案件 ({client.projects.length}件)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">案件名</th>
              <th>契約状況</th>
              <th className="text-right">契約金額</th>
              <th>契約日</th>
              <th>納品日</th>
            </tr>
          </thead>
          <tbody>
            {client.projects.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-slate-400">
                  案件はまだありません
                </td>
              </tr>
            )}
            {client.projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 font-medium">
                  <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="text-right">{formatCurrencyFull(p.contractAmount)}</td>
                <td className="text-xs">{formatDate(p.contractDate)}</td>
                <td className="text-xs">{formatDate(p.deliveryDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold mt-1 ${highlight ? "text-blue-600" : ""}`}>{value}</div>
    </div>
  );
}
