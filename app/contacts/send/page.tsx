import { prisma } from "@/lib/prisma";
import { SendEmailForm } from "./SendEmailForm";
import Link from "next/link";

export default async function SendEmailPage() {
  const contacts = await prisma.contact.findMany({
    include: { client: { select: { name: true } } },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });

  const data = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    department: c.department,
    role: c.role,
    email: c.email,
    clientName: c.client.name,
  }));

  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/contacts" className="text-xs text-blue-600 hover:underline">← 担当者一覧</Link>
        <h1 className="text-xl font-bold">✉️ メール一括送信</h1>
      </div>

      {!smtpConfigured && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-800 mb-2">⚙️ SMTP設定が必要です</p>
          <p className="text-xs text-amber-700 mb-3">
            メール送信を使うには、Microsoft 365 のアプリパスワードを環境変数に設定してください。
          </p>
          <div className="bg-white rounded border border-amber-200 p-3 text-xs font-mono text-slate-700 space-y-1">
            <p># .env.local に追記（Vercel の場合は Environment Variables に追加）</p>
            <p>SMTP_USER=あなたのメールアドレス@kitec.jp</p>
            <p>SMTP_PASS=アプリパスワード（16文字）</p>
            <p>SMTP_FROM_NAME=会社名や送信者名（省略可）</p>
          </div>
          <p className="text-[11px] text-amber-600 mt-2">
            アプリパスワードは Microsoft アカウント（myaccount.microsoft.com）→ セキュリティ情報 → アプリパスワードの追加 から取得できます。
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <SendEmailForm contacts={data} />
      </div>
    </div>
  );
}
