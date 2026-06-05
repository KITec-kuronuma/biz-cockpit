"use client";

import { useState, useTransition } from "react";
import {
  extractImage,
  saveExtraction,
  ExtractActionResult,
} from "./actions";
import type { ExtractedContact } from "@/lib/import/vision";

const SEND_FLAG_LABELS: Record<string, string> = {
  quote: "見積",
  invoice: "請求書",
  contract: "契約書",
  decision: "意思決定",
};

export function ImageImportForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [extracted, setExtracted] = useState<
    NonNullable<ExtractActionResult["result"]> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [targetClientId, setTargetClientId] = useState<string>("");
  const [clientForm, setClientForm] = useState({
    name: "",
    address: "",
    phone: "",
    fax: "",
    website: "",
    industry: "",
  });
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleExtract(formData: FormData) {
    setError(null);
    setExtracted(null);
    setSaveResult(null);
    startTransition(async () => {
      const res = await extractImage(formData);
      if (!res.ok || !res.result) {
        setError(res.error ?? "抽出失敗");
        return;
      }
      setExtracted(res.result);
      setTargetClientId(res.result.matchedClientId ?? "");
      setClientForm({
        name: res.result.client.name ?? "",
        address: res.result.client.address ?? "",
        phone: res.result.client.phone ?? "",
        fax: res.result.client.fax ?? "",
        website: res.result.client.website ?? "",
        industry: res.result.client.industry ?? "",
      });
      setContacts(res.result.contacts);
    });
  }

  function updateContact(idx: number, field: keyof ExtractedContact, value: string | string[]) {
    setContacts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function toggleFlag(idx: number, flag: string) {
    setContacts((prev) => {
      const next = [...prev];
      const flags = next[idx].sendFlags ?? [];
      next[idx] = {
        ...next[idx],
        sendFlags: flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag],
      };
      return next;
    });
  }

  function removeContact(idx: number) {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: "" }]);
  }

  async function handleSave() {
    setError(null);
    setSaveResult(null);
    startTransition(async () => {
      const res = await saveExtraction({
        targetClientId: targetClientId || null,
        clientData: targetClientId ? clientForm : clientForm,
        contacts: contacts.filter((c) => c.name?.trim()),
      });
      if (res.ok) {
        setSaveResult({
          ok: true,
          msg: `✅ 保存完了：担当者 ${res.addedContacts ?? 0}名を追加しました`,
        });
        setExtracted(null);
        setContacts([]);
      } else {
        setSaveResult({ ok: false, msg: res.error ?? "保存失敗" });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* アップロード */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">📸 画像アップロード</h2>
        <form action={handleExtract} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              画像ファイル（名刺・スクショ・写真等）
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              required
              className="block w-full text-sm border border-slate-200 rounded px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              ヒント（任意）
            </label>
            <input
              type="text"
              name="hint"
              placeholder="例：株式会社山田商事のメール署名"
              className="block w-full text-sm border border-slate-200 rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? "AI解析中..." : "🤖 AIで情報抽出"}
          </button>
        </form>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-xs">
            {error}
          </div>
        )}
      </div>

      {/* 抽出結果 */}
      {extracted && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold">✏️ 抽出結果（編集可）</h2>
            {extracted.matchedClientId && extracted.matchedClientName && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded">
                既存取引先「{extracted.matchedClientName}」に自動マッチング
              </span>
            )}
          </div>

          {/* ターゲット取引先選択 */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              登録先取引先
            </label>
            <select
              value={targetClientId}
              onChange={(e) => setTargetClientId(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            >
              <option value="">— 新規取引先として登録 —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 取引先情報 */}
          <div className="bg-slate-50 rounded-lg p-4 mb-4">
            <h3 className="text-xs font-semibold mb-2 text-slate-600">🏢 取引先情報</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="会社名"
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <input
                placeholder="業種"
                value={clientForm.industry}
                onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <input
                placeholder="代表住所"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <input
                placeholder="代表電話"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <input
                placeholder="FAX"
                value={clientForm.fax}
                onChange={(e) => setClientForm({ ...clientForm, fax: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
              <input
                placeholder="ウェブサイト"
                value={clientForm.website}
                onChange={(e) => setClientForm({ ...clientForm, website: e.target.value })}
                className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm"
              />
            </div>
            {targetClientId && (
              <p className="text-[11px] text-slate-500 mt-2">
                ※ 既存取引先には、空欄の項目だけ補完されます（既に値があれば上書きしません）
              </p>
            )}
          </div>

          {/* 担当者一覧 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-slate-600">
                👤 担当者（{contacts.length}名）
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="text-xs text-blue-600 hover:underline"
              >
                ＋ 手動で追加
              </button>
            </div>
            <div className="space-y-3">
              {contacts.map((c, idx) => (
                <div key={idx} className="border border-slate-200 rounded p-3 relative">
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="absolute top-1 right-2 text-xs text-red-500"
                  >
                    ✕
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="氏名 *"
                      value={c.name}
                      onChange={(e) => updateContact(idx, "name", e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="役職"
                      value={c.role ?? ""}
                      onChange={(e) => updateContact(idx, "role", e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="部署"
                      value={c.department ?? ""}
                      onChange={(e) => updateContact(idx, "department", e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="メール"
                      value={c.email ?? ""}
                      onChange={(e) => updateContact(idx, "email", e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="電話"
                      value={c.phone ?? ""}
                      onChange={(e) => updateContact(idx, "phone", e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-3 mt-2 text-[11px]">
                    <span className="text-slate-500">送付区分:</span>
                    {Object.entries(SEND_FLAG_LABELS).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={(c.sendFlags ?? []).includes(k)}
                          onChange={() => toggleFlag(idx, k)}
                          className="scale-90"
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {contacts.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-4">
                  担当者が抽出されませんでした。「＋ 手動で追加」から登録できます。
                </div>
              )}
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="mt-5 pt-4 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="px-4 py-2 border border-slate-300 rounded text-sm"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "保存中..." : "💾 確認して保存"}
            </button>
          </div>
        </div>
      )}

      {saveResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            saveResult.ok
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {saveResult.msg}
        </div>
      )}
    </div>
  );
}
