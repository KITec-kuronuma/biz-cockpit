import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LicenseForm } from "@/components/contracts/LicenseForm";
import {
  updateLicense,
  deleteLicense,
  addLicenseSchedule,
  deleteLicenseSchedule,
  addLicenseInitialSchedule,
  deleteLicenseInitialSchedule,
} from "../../actions";
import { formatCurrencyFull } from "@/lib/format";
import Link from "next/link";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditLicensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [license, clients, projects, schedules, initialSchedules] = await Promise.all([
    prisma.licenseContract.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, clientId: true },
    }),
    prisma.licenseMonthlySchedule.findMany({
      where: { licenseId: id },
      orderBy: { effectiveMonth: "asc" },
    }),
    prisma.licenseInitialSchedule.findMany({
      where: { licenseId: id },
      orderBy: { effectiveMonth: "asc" },
    }),
  ]);
  if (!license) return notFound();

  const initial = {
    clientId: license.clientId,
    projectId: license.projectId,
    productName: license.productName,
    planName: license.planName,
    serviceType: license.serviceType,
    initialMonthlyAmount: license.initialMonthlyAmount,
    monthlyAmount: license.monthlyAmount,
    billingCycle: license.billingCycle,
    startDate: toInputDate(license.startDate),
    endDate: toInputDate(license.endDate),
    nextRenewalDate: toInputDate(license.nextRenewalDate),
    renewalType: license.renewalType,
    status: license.status,
    licenseAgreement: license.licenseAgreement,
    memorandum: license.memorandum,
    quoteSentMonth: license.quoteSentMonth,
    note: license.note,
  };

  const bound = updateLicense.bind(null, id);

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/contracts"
        className="text-xs text-blue-600 hover:underline mb-3 inline-block"
      >
        ← ライセンス契約一覧に戻る
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">ライセンス契約 編集</h1>
        <form action={deleteLicense.bind(null, id)}>
          <button
            type="submit"
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
          >
            🗑 削除
          </button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <LicenseForm
          clients={clients}
          projects={projects}
          initial={initial}
          action={bound}
          submitLabel="更新する"
        />
      </div>

      {/* 期初予算スケジュール（月別変則予算対応） */}
      <div className="bg-white rounded-xl border border-amber-300 p-6 mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">
          🎯 期初予算スケジュール（{initialSchedules.length}件）
        </h2>
        <p className="text-xs text-slate-700 mb-4">
          期初予算が月によって異なる場合（例：最初3ヶ月だけ¥50K予算・以降¥100K予算）に複数登録します。
          <br />
          未登録の場合は <code className="bg-slate-100 px-1.5 rounded">期初予想額（¥{license.initialMonthlyAmount.toLocaleString()}）</code>{" "}
          が全月に適用されます。
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-xs text-slate-700">
          <strong>例：期初予算が「4-6月 ¥50,000」「7月以降 ¥100,000」</strong>
          <div className="mt-1.5 ml-4">
            <div>① 適用開始月: <code className="bg-white px-1.5 rounded">2026-04</code>　金額: ¥50,000　メモ: 期初プロモ予算</div>
            <div>② 適用開始月: <code className="bg-white px-1.5 rounded">2026-07</code>　金額: ¥100,000　メモ: 通常予算</div>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead className="bg-slate-100">
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="px-3 py-2 text-slate-800 font-bold">適用開始月</th>
              <th className="px-3 text-right text-slate-800 font-bold">期初予算額</th>
              <th className="px-3 text-slate-800 font-bold">メモ</th>
              <th className="px-3 text-slate-800 font-bold">登録日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initialSchedules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                  月別予算は未登録（期初予想額が全月に適用されます）
                </td>
              </tr>
            )}
            {initialSchedules.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 hover:bg-amber-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{s.effectiveMonth}</td>
                <td className="px-3 text-right font-semibold text-amber-700">
                  {formatCurrencyFull(s.amount)}
                </td>
                <td className="px-3 text-xs text-slate-700">{s.note ?? "—"}</td>
                <td className="px-3 text-xs text-slate-600">
                  {s.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3">
                  <form action={deleteLicenseInitialSchedule.bind(null, s.id, id)} className="inline">
                    <button className="text-xs text-red-600 hover:underline">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form
          action={addLicenseInitialSchedule}
          className="flex gap-2 items-end border-t pt-4 flex-wrap"
        >
          <input type="hidden" name="licenseId" value={id} />
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">
              適用開始月（YYYY-MM）
            </label>
            <input
              type="month"
              name="effectiveMonth"
              required
              className="border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">期初予算（月額）</label>
            <input
              type="number"
              name="amount"
              required
              min="0"
              placeholder="50000"
              className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-[10px] text-slate-700 font-semibold block">メモ（任意）</label>
            <input
              type="text"
              name="note"
              placeholder="期初プロモ予算 / 通常予算 等"
              className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
            />
          </div>
          <button className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold">
            ＋ 期初予算スケジュール追加
          </button>
        </form>
      </div>

      {/* 計上予定スケジュール（複数登録可・段階課金/プロモ価格対応） */}
      <div className="bg-white rounded-xl border border-slate-300 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">
          📊 計上予定スケジュール（{schedules.length}件）
        </h2>
        <p className="text-xs text-slate-700 mb-4">
          月ごとに金額が変わる契約（プロモ価格・段階課金など）はここで複数登録できます。
          <br />
          各エントリーは「<strong>適用開始月以降、次のエントリーまで</strong>」その金額が適用されます。
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-xs text-slate-700">
          <strong>例：最初3ヶ月だけ ¥50,000、4ヶ月目から ¥100,000（2026-04開始）</strong>
          <div className="mt-1.5 ml-4">
            <div>① 適用開始月: <code className="bg-white px-1.5 rounded">2026-04</code>　金額: ¥50,000　メモ: プロモ期間</div>
            <div>② 適用開始月: <code className="bg-white px-1.5 rounded">2026-07</code>　金額: ¥100,000　メモ: 通常価格</div>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead className="bg-slate-100">
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="px-3 py-2 text-slate-800 font-bold">適用開始月</th>
              <th className="px-3 text-right text-slate-800 font-bold">金額</th>
              <th className="px-3 text-slate-800 font-bold">メモ</th>
              <th className="px-3 text-slate-800 font-bold">登録日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                  スケジュールはまだありません
                </td>
              </tr>
            )}
            {schedules.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{s.effectiveMonth}</td>
                <td className="px-3 text-right font-semibold text-blue-700">
                  {formatCurrencyFull(s.amount)}
                </td>
                <td className="px-3 text-xs text-slate-700">{s.note ?? "—"}</td>
                <td className="px-3 text-xs text-slate-600">
                  {s.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3">
                  <form action={deleteLicenseSchedule.bind(null, s.id, id)} className="inline">
                    <button className="text-xs text-red-600 hover:underline">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={addLicenseSchedule} className="flex gap-2 items-end border-t pt-4 flex-wrap">
          <input type="hidden" name="licenseId" value={id} />
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">
              適用開始月（YYYY-MM）
            </label>
            <input
              type="month"
              name="effectiveMonth"
              required
              className="border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">金額（月額）</label>
            <input
              type="number"
              name="amount"
              required
              min="0"
              placeholder="50000"
              className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-[10px] text-slate-700 font-semibold block">メモ（任意）</label>
            <input
              type="text"
              name="note"
              placeholder="プロモ期間 / 通常価格 等"
              className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
            />
          </div>
          <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold">
            ＋ スケジュール追加
          </button>
        </form>

        <div className="mt-3 px-3 py-2 bg-blue-50 rounded text-[11px] text-slate-700">
          💡 ダッシュボード・財務画面では、各月でこのスケジュールから自動的に金額が選択されます。
          実績との差分は「ライセンス契約一覧」で確認できます。
        </div>
      </div>
    </div>
  );
}
