import { ImportForm } from "./ImportForm";

export default function ImportPage() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold mb-2">📥 Excelインポート</h1>
          <p className="text-sm text-slate-500">
            取引先・担当者・案件・ライセンス契約を一括取り込み
          </p>
        </div>
        <a
          href="/import/image"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
        >
          🖼️ 画像から取り込み（AI）→
        </a>
      </div>

      {/* 手順カード */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm mb-3">📋 利用手順</h2>
        <ol className="text-sm space-y-2 list-decimal list-inside text-slate-700">
          <li>
            <strong>テンプレートをダウンロード</strong>（下のボタン）
          </li>
          <li>Excelの各シートに情報を記入</li>
          <li>ファイルをアップロード → 取り込み実行</li>
        </ol>
        <a
          href="/api/import-template"
          download
          className="inline-block mt-4 px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 rounded text-sm font-medium"
        >
          📑 テンプレート（.xlsx）をダウンロード
        </a>
      </div>

      {/* 取り込み仕様 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm mb-3">⚙️ 取り込み仕様</h2>
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-2 py-1.5">シート名</th>
              <th className="px-2">既存判定キー</th>
              <th className="px-2">動作</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-1.5">取引先</td>
              <td className="px-2">会社名</td>
              <td className="px-2">既存があれば空欄以外を上書き / なければ新規作成</td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5">担当者</td>
              <td className="px-2">会社名 + 氏名</td>
              <td className="px-2">既存があれば空欄以外を上書き / なければ新規作成</td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5">案件</td>
              <td className="px-2">会社名 + 案件名</td>
              <td className="px-2">既存があれば空欄以外を上書き / なければ新規作成</td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5">ライセンス</td>
              <td className="px-2">会社名 + 製品名 + 契約開始日</td>
              <td className="px-2">既存があれば上書き（期初予想額は維持） / なければ新規作成</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-slate-700">
          💡 <strong>複数回取り込みOK</strong>：すでに登録済みの情報は重複作成されず、空欄以外の値で上書きされます。
          少しずつ情報を追加していく運用が可能です。
        </div>
      </div>

      {/* アップロードフォーム */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-sm mb-4">📤 ファイルをアップロード</h2>
        <ImportForm />
      </div>
    </div>
  );
}
