"use client";

import { useState } from "react";
import {
  STATUS_LABELS,
  PROGRESS_LABELS,
  DETAIL_PHASE_LABELS,
  LICENSE_CYCLE_LABELS,
} from "@/lib/types";

type Client = { id: string; name: string };
type ProjectInitial = {
  clientId: string;
  title: string;
  contractDate: string;
  deliveryDate: string;
  contractAmount: number;
  taxRate: number;
  licenseFee?: number | null;
  licenseStartDate: string;
  licenseCycle?: string | null;
  status: string;
  progress: string;
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

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      await action(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
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
            <option value="" disabled>選択してください</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="契約状況">
          <select
            name="status"
            defaultValue={initial?.status ?? "LEAD"}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="進捗">
          <select
            name="progress"
            defaultValue={initial?.progress ?? "NOT_STARTED"}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            {Object.entries(PROGRESS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="詳細フェーズ（補助）">
          <select
            name="detailPhase"
            defaultValue={initial?.detailPhase ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {Object.entries(DETAIL_PHASE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>

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
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {submitLabel}
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
