"use client";

export function DeleteProjectButton({ action }: { action: () => Promise<void> }) {
  async function handleSubmit() {
    if (!confirm("案件を削除しますか？関連する請求・入金・原価もすべて削除されます。")) return;
    await action();
  }
  return (
    <form action={handleSubmit}>
      <button
        type="submit"
        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
      >
        🗑 案件を削除
      </button>
    </form>
  );
}
