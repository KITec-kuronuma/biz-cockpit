"use client";

import { useState } from "react";

const BILLING_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "月額",
  YEARLY: "年額",
  ONE_TIME: "一括",
};

const RENEWAL_TYPE_LABELS: Record<string, string> = {
  AUTO: "自動更新",
  MANUAL: "手動更新",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "有効",
  SCHEDULED_CANCEL: "解約予定",
  CANCELLED: "解約済",
  EXPIRED: "失効",
};

type Client = { id: string; name: string };
type Project = { id: string; title: string; clientId: string };

type Initial = {
  clientId?: string;
  projectId?: string | null;
  productName?: string;
  planName?: string | null;
  monthlyAmount?: number;
  billingCycle?: string;
  startDate?: string;
  endDate?: string;
  nextRenewalDate?: string;
  renewalType?: string;
  status?: string;
  note?: string | null;
};

export function LicenseForm({
  clients,
  projects,
  initial,
  action,
  submitLabel = "登録する",
}: {
  clients: Client[];
  projects: Project[];
  initial?: Initial;
  action: (formData: FormData) => Promise<void> | void;
  submitLabel?: string;
}) {
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      setSubmitting(true);
      await action(formData);
    } catch (e) {
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
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
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
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
        <Field label="関連案件（任意）">
          <select
            name="projectId"
            defaultValue={initial?.projectId ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="">なし（独立契約）</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="製品名" required>
          <input
            type="text"
            name="productName"
            defaultValue={initial?.productName ?? ""}
            required
            placeholder="CRM基本パック"
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="プラン名（任意）">
          <input
            type="text"
            name="planName"
            defaultValue={initial?.planName ?? ""}
            placeholder="Pro / Enterprise 等"
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="月額（円・税抜）" required>
          <input
            type="number"
            name="monthlyAmount"
            min="0"
            required
            defaultValue={initial?.monthlyAmount ?? 0}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="課金周期">
          <select
            name="billingCycle"
            defaultValue={initial?.billingCycle ?? "MONTHLY"}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="更新タイプ">
          <select
            name="renewalType"
            defaultValue={initial?.renewalType ?? "MANUAL"}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          >
            {Object.entries(RENEWAL_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="契約開始日" required>
          <input
            type="date"
            name="startDate"
            defaultValue={initial?.startDate ?? ""}
            required
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="契約終了日（任意）">
          <input
            type="date"
            name="endDate"
            defaultValue={initial?.endDate ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="次回更新日">
          <input
            type="date"
            name="nextRenewalDate"
            defaultValue={initial?.nextRenewalDate ?? ""}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <Field label="ステータス">
        <select
          name="status"
          defaultValue={initial?.status ?? "ACTIVE"}
          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm max-w-xs"
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      <Field label="備考">
        <textarea
          name="note"
          rows={2}
          defaultValue={initial?.note ?? ""}
          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
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
