import { getClientsForSelection } from "./actions";
import { ImageImportForm } from "./ImageImportForm";
import Link from "next/link";

export default async function ImageImportPage() {
  const clients = await getClientsForSelection();
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/import" className="text-xs text-blue-600 hover:underline mb-3 inline-block">
        ← Excelインポートに戻る
      </Link>
      <h1 className="text-xl font-bold mb-2">🖼️ 画像から情報取り込み（AI）</h1>
      <p className="text-sm text-slate-500 mb-6">
        名刺・メール署名・会社案内のスクショなどから、取引先・担当者情報を自動抽出します
      </p>

      {!apiKeySet && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-sm mb-2 text-amber-900">
            ⚠️ APIキーが未設定です
          </h2>
          <p className="text-xs text-amber-800 mb-3">
            この機能を使うには Anthropic API キーを設定する必要があります。
          </p>
          <ol className="text-xs space-y-1 list-decimal list-inside text-amber-900">
            <li>
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener" className="underline">
                Anthropic Console
              </a>
              でアカウント作成 → クレジットカード登録 → API Key を発行（無料$5クレジット付与）
            </li>
            <li>
              Vercel管理画面 → biz-cockpit → Settings → Environment Variables
            </li>
            <li>
              <strong>Key: ANTHROPIC_API_KEY</strong> / <strong>Value: 取得したキー</strong>
              を追加して Save
            </li>
            <li>Deployments で Redeploy を実行</li>
          </ol>
          <p className="text-xs text-amber-800 mt-3">
            💰 想定コスト：画像10枚あたり約 $0.5〜$2（無料クレジット$5で200〜500枚処理可能）
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm mb-3">💡 使い方</h2>
        <ol className="text-sm space-y-1.5 list-decimal list-inside text-slate-700">
          <li>名刺・メール署名・会社案内の画像をアップロード</li>
          <li>AIが取引先と担当者の情報を構造化抽出</li>
          <li>既存取引先に自動マッチング（社名一致時）</li>
          <li>抽出内容を確認・編集</li>
          <li>「確認して保存」で取引先・担当者として登録</li>
        </ol>
      </div>

      <ImageImportForm clients={clients} />
    </div>
  );
}
