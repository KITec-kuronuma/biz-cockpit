import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { getScheduledAmount, isPendingBilling } from "@/lib/domain/license";
import { PendingBillingWidget, PendingItem } from "@/components/dashboard/PendingBillingWidget";
import Link from "next/link";

const SERVICE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  LICENSE: { label: "ライセンス", color: "bg-blue-100 text-blue-800" },
  MAINTENANCE: { label: "保守", color: "bg-purple-100 text-purple-800" },
};

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
    include: { client: true, project: true, schedules: true, actuals: true, initialSchedules: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  // 当月の請求待ちライセンス（月額・未請求）
  const today = new Date();
  const thisMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const pendingItems: PendingItem[] = [];
  for (const l of licenses) {
    if (isPendingBilling(l, thisMonth, thisMonth)) {
      pendingItems.push({
        id: l.id,
        clientName: l.client.name,
        productName: l.productName,
        planName: l.planName,
        yearMonth: thisMonth,
        amount: getScheduledAmount(l, thisMonth),
      });
    }
  }

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

      {/* 今月の請求待ちライセンス（トグル開閉） */}
      <PendingBillingWidget items={pendingItems} />

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">ライセンス契約一覧</h1>
        <Link
          href="/contracts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          ＋ ライセンス契約追加
        </Link>
      </div>
      <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700">
        💡 <strong>予算計上ルール</strong>：ステータスが「有効」の契約は、契約終了日を過ぎても <strong>次年度の更新前提で予算・計上予定が継続</strong> されます。
        更新しない場合はステータスを「解約予定」「解約済」「失効」に変更してください。
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2">取引先</th>
              <th className="px-3">区分</th>
              <th className="px-3">製品 / プラン</th>
              <th className="px-3 text-right">期初予想</th>
              <th className="px-3 text-right">計上予定</th>
              <th className="px-3 text-right">差分</th>
              <th className="px-3">課金</th>
              <th className="px-3">開始日</th>
              <th className="px-3">見積送付月</th>
              <th className="px-3">次回更新</th>
              <th className="px-3">ステータス</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {licenses.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-xs text-slate-400">
                  ライセンス契約はまだ登録されていません。<br />
                  右上の「＋ ライセンス契約追加」から、既存・新規どちらの契約も登録できます。
                </td>
              </tr>
            )}
            {licenses.map((l) => {
              const statusInfo = STATUS_LABELS[l.status] ?? { label: l.status, color: "" };
              const svcInfo = SERVICE_TYPE_LABELS[l.serviceType] ?? { label: l.serviceType, color: "" };
              const diff = l.monthlyAmount - l.initialMonthlyAmount;
              return (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{l.client.name}</td>
                  <td className="px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${svcInfo.color}`}>
                      {svcInfo.label}
                    </span>
                  </td>
                  <td className="px-3">
                    <div className="font-medium">{l.productName}</div>
                    {l.planName && (
                      <div className="text-[11px] text-slate-500">{l.planName}</div>
                    )}
                  </td>
                  <td className="px-3 text-right text-slate-600">
                    {formatCurrencyFull(l.initialMonthlyAmount)}
                  </td>
                  <td className="px-3 text-right font-semibold text-blue-700">
                    {formatCurrencyFull(l.monthlyAmount)}
                  </td>
                  <td
                    className={`px-3 text-right text-xs ${
                      diff > 0
                        ? "text-emerald-600"
                        : diff < 0
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {diff === 0 ? "—" : (diff > 0 ? "+" : "") + formatCurrencyFull(diff)}
                  </td>
                  <td className="px-3 text-xs">{BILLING_CYCLE_LABELS[l.billingCycle]}</td>
                  <td className="px-3 text-xs">{formatDate(l.startDate)}</td>
                  <td className="px-3 text-xs">{l.quoteSentMonth ?? "—"}</td>
                  <td className="px-3 text-xs">{formatDate(l.nextRenewalDate)}</td>
                  <td className="px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
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
