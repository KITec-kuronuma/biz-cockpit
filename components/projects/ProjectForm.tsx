"use client";

import { useState } from "react";
import { DETAIL_PHASE_LABELS, LICENSE_CYCLE_LABELS } from "@/lib/types";

type Client = { id: string; name: string };
type ProjectInitial = {
  clientId: string;
  projectNo: number | null;
  title: string;
  occurredAt: string;
  quotedAt: string;
  undatedForecast: number;
  forecastTiming: string;
  contractDate: string;
  deliveryDate: string;
  contractAmount: number;
  taxRate: number;
  licenseFee?: number | null;
  licenseStartDate: string;
  licenseCycle?: string | null;
  detailPhase?: string | null;
  initialForecast?: string | null;
  note?: string | null;
};

export function ProjectForm({
  clients,
  initial,
  action,
  submitLabel = "保存",
}: {
  clients: Client[];
  initial?: Partial<ProjectInitial>;
  action: (formData: FormData) => Promise<void> | void;
  submitLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      setSubmitting(true);
      await action(formData);
    } catch (e) {
      // redirect() は NEXT_REDIRECT エラーを投げる（正常動作）
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) {
        throw e;
      }
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="取引先" required>
          <select
            name="clientId"
            required
            defaultValue={initial?.clientId ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              選択してください
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="案件名" required>
          <input
            type="text"
            name="title"
            required
            defaultValue={initial?.title ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <Field label="プロジェクトNo">
        <input
          type="number"
          name="projectNo"
          min="1"
          defaultValue={initial?.projectNo ?? ""}
          placeholder="例：101"
          className="w-48 border border-slate-200 rounded px-2 py-1.5 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="案件発生日">
          <input
            type="date"
            name="occurredAt"
            defaultValue={initial?.occurredAt ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="見積提出日">
          <input
            type="date"
            name="quotedAt"
            defaultValue={initial?.quotedAt ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="時期未定見込み額（円・税抜）">
          <input
            type="number"
            name="undatedForecast"
            min="0"
            defaultValue={initial?.undatedForecast ?? 0}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
          <p className="text-[10px] text-slate-400 mt-1">月別予定を登録すると自動でクリアされます</p>
        </Field>
        <Field label="見込み区分">
          <select
            name="forecastTiming"
            defaultValue={initial?.forecastTiming ?? "UNDECIDED"}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="UNDECIDED">完全未定（年度も不明）</option>
            <option value="THIS_FY">当期内（月は未定）</option>
            <option value="NEXT_FY">来期以降（月は未定）</option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1">着地見込みには「当期内」のみ加算</p>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="契約日">
          <input
            type="date"
            name="contractDate"
            defaultValue={initial?.contractDate ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="納品日">
          <input
            type="date"
            name="deliveryDate"
            defaultValue={initial?.deliveryDate ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="期初予想納品月（YYYY-MM）">
          <input
            type="text"
            name="initialForecast"
            placeholder="2026-07"
            pattern="\d{4}-\d{2}"
            defaultValue={initial?.initialForecast ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="契約金額（円・税抜）" required>
          <input
            type="number"
            name="contractAmount"
            min="0"
            required
            defaultValue={initial?.contractAmount ?? 0}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="税率（%）">
          <input
            type="number"
            name="taxRate"
            min="0"
            max="100"
            defaultValue={initial?.taxRate ?? 10}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="ライセンス費用（任意）">
          <input
            type="number"
            name="licenseFee"
            min="0"
            defaultValue={initial?.licenseFee ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ライセンス開始日">
          <input
            type="date"
            name="licenseStartDate"
            defaultValue={initial?.licenseStartDate ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="課金周期">
          <select
            name="licenseCycle"
            defaultValue={initial?.licenseCycle ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {Object.entries(LICENSE_CYCLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="詳細フェーズ（案件の現在の状況）">
        <select
          name="detailPhase"
          defaultValue={initial?.detailPhase ?? ""}
          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          {Object.entries(DETAIL_PHASE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-400 mt-1">
          ※ 詳細フェーズから「契約状況」「進捗」は自動的に設定されます。
        </p>
      </Field>

      <Field label="備考">
        <textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "保存中..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
