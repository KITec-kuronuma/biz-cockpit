"use client";

import { useState, useMemo } from "react";

type Contact = {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
  email: string | null;
  clientName: string;
};

type SendResult = { email: string; name: string; ok: boolean; error?: string };

export function SendEmailForm({ contacts }: { contacts: Contact[] }) {
  const withEmail = contacts.filter((c) => c.email);

  // フィルター
  const [filterCompany, setFilterCompany] = useState("");
  const companies = useMemo(
    () => [...new Set(withEmail.map((c) => c.clientName))].sort(),
    [withEmail]
  );

  // 送信先選択
  const [selected, setSelected] = useState<Set<string>>(new Set(withEmail.map((c) => c.id)));

  const filtered = useMemo(
    () => (filterCompany ? withEmail.filter((c) => c.clientName === filterCompany) : withEmail),
    [withEmail, filterCompany]
  );

  function toggleAll() {
    const filteredIds = filtered.map((c) => c.id);
    const allSelected = filteredIds.every((id) => selected.has(id));
    const next = new Set(selected);
    if (allSelected) filteredIds.forEach((id) => next.delete(id));
    else filteredIds.forEach((id) => next.add(id));
    setSelected(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // メール内容
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // 送信状態
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedContacts = withEmail.filter((c) => selected.has(c.id));

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setSendError("件名と本文を入力してください");
      return;
    }
    if (selectedContacts.length === 0) {
      setSendError("送信先を1件以上選択してください");
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedContacts.map((c) => ({ name: c.name, email: c.email! })),
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "送信に失敗しました");
      } else {
        setResults(data.results);
      }
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  }

  const filteredAllSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  if (results) {
    const ok = results.filter((r) => r.ok);
    const ng = results.filter((r) => !r.ok);
    return (
      <div className="space-y-4">
        <div className={`rounded-lg p-4 ${ok.length > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <p className="font-bold text-sm mb-1">
            {ok.length > 0 ? `✅ ${ok.length}件 送信完了` : ""}
            {ng.length > 0 ? `　⚠️ ${ng.length}件 失敗` : ""}
          </p>
          {ng.length > 0 && (
            <ul className="text-xs text-red-700 mt-2 space-y-1">
              {ng.map((r) => (
                <li key={r.email}>{r.name}（{r.email}）: {r.error}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => setResults(null)}
          className="px-4 py-2 bg-slate-200 rounded text-sm hover:bg-slate-300"
        >
          ← 送信画面に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 左：送信先選択 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-800">送信先を選択</h2>
          <span className="text-xs text-slate-500">{selectedContacts.length}名選択中</span>
        </div>

        {/* 会社フィルター */}
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs mb-2"
        >
          <option value="">— すべての取引先 —</option>
          {companies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* 全選択 */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 rounded mb-1">
          <input
            type="checkbox"
            checked={filteredAllSelected}
            onChange={toggleAll}
            className="w-3.5 h-3.5"
          />
          <span className="text-xs font-semibold text-slate-700">
            {filterCompany ? `${filterCompany}（${filtered.length}名）` : `全員（${filtered.length}名）`}を選択
          </span>
        </div>

        {/* 担当者リスト */}
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[480px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400 text-center">メールアドレス登録済みの担当者がいません</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className={`flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-slate-100 hover:bg-blue-50 ${selected.has(c.id) ? "bg-blue-50/50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="mt-0.5 w-3.5 h-3.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {c.clientName}{c.department ? ` ／ ${c.department}` : ""}
                  </p>
                  <p className="text-[10px] text-blue-600 truncate">{c.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* 右：メール内容 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-slate-800">メール内容</h2>

        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
          💡 本文中に <code className="bg-white px-1 rounded">&#123;&#123;氏名&#125;&#125;</code> と書くと、送信時に各担当者の名前に自動置換されます
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">件名</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例：お世話になっております"
            className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">本文</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder={`{{氏名}} 様\n\nお世話になっております。\n…`}
            className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono resize-none"
          />
        </div>

        {sendError && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
            {sendError}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || selectedContacts.length === 0 || !subject || !body}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? `送信中…（${selectedContacts.length}名）` : `✉️ ${selectedContacts.length}名に送信する`}
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          Microsoft 365 SMTP 経由で送信されます。送信前にテスト送信することをおすすめします。
        </p>
      </div>
    </div>
  );
}
