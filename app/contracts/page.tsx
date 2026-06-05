import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import Link from "next/link";

const BILLING_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "月額",
  YEARLY: "年額",
  ONE_TIME: "一括",
};

const RENEWAL_TYPE_LABELS: Record<string, string> = {
  AUTO: "自動",
  MANUAL: "手動",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "有効", color: "bg-emerald-100 text-emerald-800" },
  SCHEDULED_CANCEL: { label: "解約予定", color: "bg-amber-100 text-amber-800" },
  CANCELLED: { label: "解約済", color: "bg-red-100 text-red-800" },
  EXPIRED: { label: "失効", color: "bg-slate-200 text-slate-600" },
};

export default async function LicenseContractsPage() {
  const licenses = await prisma.licenseContract.findMany({
    include: { client: true, project: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  // 集計
  const activeLicenses = licenses.filter((l) => l.status === "ACTIVE");
  const totalMonthly = activeLicenses.reduce((s, l) => {
    if (l.billingCycle === "MONTHLY") return s + l.monthlyAmount;
    if (l.billingCycle === "YEARLY") return s + Math.round(l.monthlyAmount / 12);
    return s;
  }, 0);
  const totalAnnual = totalMonthly * 12;
  const scheduledCancelCount = licenses.filter((l) => l.status === "SCHEDULED_CANCEL").length;

  // 60日以内の更新
  const today = new Date();
  const upcoming = licenses.filter((l) => {
    if (l.status !== "ACTIVE" || !l.nextRenewalDate) return false;
    const days = Math.floor((l.nextRenewalDate.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 60;
  }).length;

  return (
    <div className="p-6">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPI
          label="アクティブ契約"
          value={`${activeLicenses.length}件`}
          sub={`月額合計 ${formatCurrencyFull(totalMonthly)}`}
        />
        <KPI
          label="MRR（月次経常収益）"
          value={formatCurrencyFull(totalMonthly)}
          sub="アクティブ契約の月額合計"
          color="blue"
        />
        <KPI
          label="ARR（年次経常収益）"
          value={formatCurrencyFull(totalAnnual)}
          sub="MRR × 12"
          color="green"
        />
        <KPI
          label="60日以内更新"
          value={`${upcoming}件`}
          sub={scheduledCancelCount > 0 ? `解約予定 ${scheduledCancelCount}件` : "事前アクション要"}
          color={upcoming > 0 ? "amber" : "slate"}
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">ライセンス契約一覧</h1>
        <Link
          href="/contracts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          ＋ ライセンス契約追加
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">取引先</th>
              <th className="px-3">製品 / プラン</th>
              <th className="px-3 text-right">月額</th>
              <th className="px-3">課金</th>
              <th className="px-3">開始日</th>
              <th className="px-3">次回更新</th>
              <th className="px-3">更新</th>
              <th className="px-3">ステータス</th>
              <th className="px-3">関連案件</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {licenses.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-xs text-slate-400">
                  ライセンス契約はまだ登録されていません。<br />
                  右上の「＋ ライセンス契約追加」から、既存・新規どちらの契約も登録できます。
                </td>
              </tr>
            )}
            {licenses.map((l) => {
              const statusInfo = STATUS_LABELS[l.status] ?? { label: l.status, color: "" };
              return (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{l.client.name}</td>
                  <td className="px-3">
                    <div className="font-medium">{l.productName}</div>
                    {l.planName && (
                      <div className="text-[11px] text-slate-500">{l.planName}</div>
                    )}
                  </td>
                  <td className="px-3 text-right font-semibold">
                    {formatCurrencyFull(l.monthlyAmount)}
                  </td>
                  <td className="px-3 text-xs">{BILLING_CYCLE_LABELS[l.billingCycle]}</td>
                  <td className="px-3 text-xs">{formatDate(l.startDate)}</td>
                  <td className="px-3 text-xs">{formatDate(l.nextRenewalDate)}</td>
                  <td className="px-3 text-xs">{RENEWAL_TYPE_LABELS[l.renewalType]}</td>
                  <td className="px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-3 text-xs">
                    {l.project ? (
                      <Link
                        href={`/projects/${l.project.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {l.project.title}
                      </Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3">
                    <Link
                      href={`/contracts/${l.id}/edit`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      編集
                    </Link>
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

function KPI({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "green" | "amber" | "slate";
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    slate: "text-slate-900",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
