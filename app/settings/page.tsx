import { prisma } from "@/lib/prisma";
import { REVENUE_BASIS_LABELS } from "@/lib/types";
import { updateSetting } from "./actions";
import {
  createFiscalYear,
  updateFiscalYear,
  deleteFiscalYear,
  setCurrentFiscalYear,
} from "./fiscalActions";

export default async function SettingsPage() {
  const [setting, fiscalYears] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.fiscalYear.findMany({ orderBy: { startYM: "asc" } }),
  ]);

  const s = setting ?? {
    id: "singleton",
    fiscalStartMonth: 4,
    targetContractAmount: 100_000_000,
    targetContractCount: 5,
    defaultRevenueBasis: "DELIVERY",
    annualBudgetRevenue: 120_000_000,
    taxRate: 10,
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      {/* 会計年度管理 */}
      <div className="bg-white rounded-xl border border-slate-300 p-5 mb-6">
        <h2 className="text-base font-bold mb-3 text-slate-900">📅 会計年度</h2>
        <p className="text-xs text-slate-700 mb-3">
          年度ごとに開始月・終了月を柔軟に設定できます。「現在の年度」がダッシュボード・財務画面で使用されます。
        </p>

        <table className="w-full text-sm mb-4">
          <thead className="bg-slate-100">
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="px-2 py-2 text-slate-800 font-bold">ラベル</th>
              <th className="px-2 text-slate-800 font-bold">開始</th>
              <th className="px-2 text-slate-800 font-bold">終了</th>
              <th className="px-2 text-slate-800 font-bold">月数</th>
              <th className="px-2 text-slate-800 font-bold">備考</th>
              <th className="px-2 text-slate-800 font-bold">現在</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fiscalYears.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-xs text-slate-500">
                  下のフォームから会計年度を登録してください
                </td>
              </tr>
            )}
            {fiscalYears.map((fy) => {
              const months = monthsCount(fy.startYM, fy.endYM);
              return (
                <tr key={fy.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-2 py-2 font-semibold">{fy.label}</td>
                  <td className="px-2 text-xs">{fy.startYM}</td>
                  <td className="px-2 text-xs">{fy.endYM}</td>
                  <td className="px-2 text-xs">{months}ヶ月</td>
                  <td className="px-2 text-xs text-slate-700">{fy.note ?? "—"}</td>
                  <td className="px-2">
                    {fy.isCurrent ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ 現在
                      </span>
                    ) : (
                      <form action={setCurrentFiscalYear.bind(null, fy.id)} className="inline">
                        <button className="text-[11px] text-blue-600 hover:underline">
                          現在にする
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-2">
                    <form action={deleteFiscalYear.bind(null, fy.id)} className="inline">
                      <button className="text-[11px] text-red-600 hover:underline">削除</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 追加フォーム */}
        <form
          action={createFiscalYear}
          className="border-t-2 border-slate-200 pt-3 grid grid-cols-6 gap-2 items-end"
        >
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">ラベル *</label>
            <input
              type="text"
              name="label"
              required
              placeholder="2027年度"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">開始 (YYYY-MM)</label>
            <input
              type="month"
              name="startYM"
              required
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block">終了 (YYYY-MM)</label>
            <input
              type="month"
              name="endYM"
              required
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-700 font-semibold block">備考</label>
            <input
              type="text"
              name="note"
              placeholder="変則 9ヶ月 等"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-700 font-semibold flex items-center gap-1">
              <input type="checkbox" name="isCurrent" value="on" /> 現在にする
            </label>
          </div>
          <div className="col-span-6 flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
            >
              ＋ 会計年度を追加
            </button>
          </div>
        </form>
      </div>

      {/* 既存の設定 */}
      <form action={updateSetting} className="grid grid-cols-2 gap-4">
        <Card title="🎯 年間目標（参考値）">
          <NumberField
            name="targetContractAmount"
            label="目標契約額"
            defaultValue={s.targetContractAmount}
            suffix="円"
          />
          <NumberField
            name="targetContractCount"
            label="目標契約件数"
            defaultValue={s.targetContractCount}
            suffix="件"
          />
          <NumberField
            name="annualBudgetRevenue"
            label="年間予算売上"
            defaultValue={s.annualBudgetRevenue}
            suffix="円"
          />
        </Card>

        <Card title="📐 売上計上基準">
          <div>
            <label className="text-[10px] text-slate-700 font-semibold block mb-1">既定基準</label>
            <select
              name="defaultRevenueBasis"
              defaultValue={s.defaultRevenueBasis}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              {Object.entries(REVENUE_BASIS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-600 mt-1">月次PLでデフォルト適用</p>
          </div>
          <NumberField
            name="taxRate"
            label="消費税率"
            defaultValue={s.taxRate}
            min={0}
            max={100}
            suffix="%"
          />
          <NumberField
            name="fiscalStartMonth"
            label="（旧）会計年度開始月"
            defaultValue={s.fiscalStartMonth}
            min={1}
            max={12}
            suffix="月"
          />
        </Card>

        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            💾 設定を保存
          </button>
        </div>
      </form>

      <div className="mt-6 px-4 py-3 bg-blue-50 rounded-lg text-xs text-slate-700">
        💡 保存するとダッシュボードと財務画面に即座に反映されます
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 p-5">
      <h2 className="text-base font-bold mb-3 text-slate-900">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
  suffix,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-700 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          min={min}
          max={max}
          className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm text-right"
        />
        {suffix && <span className="text-xs text-slate-700 font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function monthsCount(startYM: string, endYM: string): number {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}
