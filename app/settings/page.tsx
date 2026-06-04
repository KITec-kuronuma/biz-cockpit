import { prisma } from "@/lib/prisma";
import { REVENUE_BASIS_LABELS } from "@/lib/types";
import { updateSetting } from "./actions";

export default async function SettingsPage() {
  const setting = (await prisma.setting.findFirst()) ?? {
    id: "singleton",
    fiscalStartMonth: 4,
    targetContractAmount: 100_000_000,
    targetContractCount: 5,
    defaultRevenueBasis: "DELIVERY",
    annualBudgetRevenue: 120_000_000,
    taxRate: 10,
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      <form action={updateSetting} className="grid grid-cols-2 gap-4">
        <Card title="📅 会計年度">
          <NumberField
            name="fiscalStartMonth"
            label="開始月（1〜12）"
            defaultValue={setting.fiscalStartMonth}
            min={1}
            max={12}
            suffix="月"
          />
        </Card>

        <Card title="🎯 年間目標">
          <NumberField
            name="targetContractAmount"
            label="目標契約額"
            defaultValue={setting.targetContractAmount}
            suffix="円"
          />
          <NumberField
            name="targetContractCount"
            label="目標契約件数"
            defaultValue={setting.targetContractCount}
            suffix="件"
          />
          <NumberField
            name="annualBudgetRevenue"
            label="年間予算売上"
            defaultValue={setting.annualBudgetRevenue}
            suffix="円"
          />
        </Card>

        <Card title="📐 売上計上基準">
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">既定基準</label>
            <select
              name="defaultRevenueBasis"
              defaultValue={setting.defaultRevenueBasis}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
            >
              {Object.entries(REVENUE_BASIS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">月次PLでデフォルト適用されます</p>
          </div>
        </Card>

        <Card title="⚙️ その他">
          <NumberField
            name="taxRate"
            label="消費税率"
            defaultValue={setting.taxRate}
            min={0}
            max={100}
            suffix="%"
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

      <div className="mt-6 px-4 py-3 bg-blue-50 rounded-lg text-xs text-slate-600">
        💡 保存するとダッシュボードと財務画面に即座に反映されます
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
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
      <label className="text-[10px] text-slate-500 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          min={min}
          max={max}
          className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm text-right"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}
