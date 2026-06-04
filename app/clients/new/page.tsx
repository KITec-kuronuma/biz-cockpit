import { createClient } from "../actions";
import Link from "next/link";

export default function NewClientPage() {
  return (
    <div className="p-6 max-w-xl">
      <Link href="/clients" className="text-xs text-blue-600 hover:underline mb-3 inline-block">
        ← 取引先一覧に戻る
      </Link>
      <h1 className="text-xl font-bold mb-6">取引先 新規登録</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form action={createClient} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              会社名<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">備考</label>
            <textarea
              name="note"
              rows={3}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              登録する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
