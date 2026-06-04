import { createClient } from "../actions";
import Link from "next/link";

export default function NewClientPage() {
  return (
    <div className="p-6 max-w-3xl">
      <Link href="/clients" className="text-xs text-blue-600 hover:underline mb-3 inline-block">
        ← 取引先一覧に戻る
      </Link>
      <h1 className="text-xl font-bold mb-6">取引先 新規登録</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form action={createClient} className="space-y-4">
          <Field label="会社名" name="name" required />
          <div className="grid grid-cols-2 gap-4">
            <Field label="業種" name="industry" placeholder="製造業 / 小売業 等" />
            <Field label="ウェブサイト" name="website" placeholder="https://example.co.jp" />
          </div>
          <Field label="代表住所" name="address" placeholder="東京都千代田区..." />
          <div className="grid grid-cols-2 gap-4">
            <Field label="代表電話番号" name="phone" placeholder="03-1234-5678" />
            <Field label="FAX" name="fax" placeholder="03-1234-5679" />
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

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
