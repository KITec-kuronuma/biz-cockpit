"use client";

import { useState, useTransition } from "react";
import { importExcel } from "./actions";
import type { ImportResult } from "@/lib/import/excel";

export function ImportForm() {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setResults(null);
    startTransition(async () => {
      try {
        const res = await importExcel(formData);
        setResults(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "インポート失敗");
      }
    });
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            Excelファイル（.xlsx）を選択
          </label>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            className="block w-full text-sm border border-slate-200 rounded px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "取り込み中..." : "📥 取り込み実行"}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold">📊 取り込み結果</h3>
          {results.map((r) => (
            <div key={r.type} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <strong className="text-sm">{r.type}</strong>
                <div className="text-xs space-x-3">
                  <span className="text-emerald-600">追加 {r.added}</span>
                  <span className="text-blue-600">更新 {r.updated}</span>
                  <span className="text-slate-500">スキップ {r.skipped}</span>
                  {r.errors.length > 0 && (
                    <span className="text-red-600">エラー {r.errors.length}</span>
                  )}
                </div>
              </div>
              {r.errors.length > 0 && (
                <details>
                  <summary className="text-xs text-red-600 cursor-pointer">
                    エラー詳細を表示
                  </summary>
                  <ul className="mt-2 text-xs space-y-1">
                    {r.errors.map((e, idx) => (
                      <li key={idx} className="text-red-700">
                        行 {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
