import { login } from "./actions";

type SearchParams = Promise<{ error?: string; redirectedFrom?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = params.error;
  const redirectTo = params.redirectedFrom ?? "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            BC
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">biz-cockpit</h1>
            <p className="text-xs text-slate-500">業務管理ダッシュボード</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-slate-900 mb-4">ログイン</h2>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            ⚠️ {error}
          </div>
        )}

        <form action={login} className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-700">メールアドレス</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-700">パスワード</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <button
            type="submit"
            className="mt-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            ログイン
          </button>
        </form>

        <p className="mt-6 text-[11px] text-slate-500 leading-relaxed">
          アカウントは管理者が手動で作成します。ログインできない場合は管理者にご連絡ください。
        </p>
      </div>
    </div>
  );
}
