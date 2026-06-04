"use client";

import { useState } from "react";

export function DeleteClientButton({
  action,
  projectCount,
}: {
  action: () => Promise<void>;
  projectCount: number;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (projectCount > 0) {
      setError(
        `この取引先には ${projectCount}件の案件があります。削除する前に、関連案件を別の取引先に移動するか削除してください。`
      );
      return;
    }
    if (
      !confirm(
        "この取引先を削除しますか？\n関連する担当者もすべて削除されます。\nこの操作は取り消せません。"
      )
    ) {
      return;
    }
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  return (
    <>
      <form action={handleSubmit}>
        <button
          type="submit"
          className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
        >
          🗑 取引先を削除
        </button>
      </form>
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-xs">
          {error}
        </div>
      )}
    </>
  );
}
