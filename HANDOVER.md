# biz-cockpit システム引き継ぎ手引き

このドキュメントは、本システムの管理者が交代する際の手引きです。

## 1. システム構成

```
ユーザー（ブラウザ）
   ↓
Vercel（Next.jsアプリ・https://biz-cockpit.vercel.app）
   ↓
Supabase（PostgreSQL データベース）
   ↑
GitHub（ソースコード）→ push すると Vercel が自動デプロイ
```

## 2. 利用サービスとアカウント

| サービス | 用途 | 現在の管理者 | 月額 |
|---------|------|------------|------|
| GitHub | コード管理 | KITec-kuronuma | 無料 |
| Vercel | ホスティング・自動デプロイ | ryosuke-s-projects2 | 無料 |
| Supabase | データベース | KITec-kuronuma's Org | 無料 |
| Anthropic | （未使用） | — | — |

## 3. 各サービスへのアクセス権引き継ぎ

### 3-1. GitHub
- リポジトリ：https://github.com/KITec-kuronuma/biz-cockpit
- 引き継ぎ手順：
  1. リポジトリの「Settings」→「Collaborators」を開く
  2. 後任者のGitHubアカウントを「Add people」で追加
  3. 権限を「Admin」に設定
  4. 後任者がInvitationを受諾
- リポジトリ自体を移管する場合：Settings → Danger Zone → Transfer ownership

### 3-2. Vercel
- ダッシュボード：https://vercel.com/dashboard
- プロジェクト：biz-cockpit
- 引き継ぎ手順：
  - **Hobbyプラン（無料）の場合**：複数メンバー追加不可。以下の対応が必要：
    - 後任者がVercelアカウント作成
    - 旧管理者がプロジェクトを「Transfer to another account」で移管
    - または、後任者の環境で改めて GitHub と連携してデプロイ
  - **Pro プラン**：Settings → Team → Members で追加可能
- **環境変数（重要）**：
  - `DATABASE_URL` … Supabase 接続文字列。次の Supabase 引き継ぎを参照。

### 3-3. Supabase
- ダッシュボード：https://supabase.com/dashboard
- プロジェクト：biz-cockpit
- 引き継ぎ手順：
  1. Organization Settings → Members
  2. 後任者をメールアドレスでInvite（Owner権限を推奨）
  3. 後任者がInvitationを受諾
  4. データベースパスワードを後任者と共有（または再生成）
- 接続文字列の取得：
  - Project Settings → Database → Connection string → Transaction pooler の URI
  - パスワードを置き換えて Vercel の `DATABASE_URL` 環境変数に設定

## 4. ローカル開発環境セットアップ

新しい開発者がローカルで動かす場合：

```bash
# 1. リポジトリをクローン
git clone https://github.com/KITec-kuronuma/biz-cockpit.git
cd biz-cockpit

# 2. 依存パッケージインストール
npm install

# 3. .env ファイル作成
cp .env.example .env
# .env を編集して DATABASE_URL に Supabase の接続文字列を設定

# 4. Prisma クライアント生成
npx prisma generate

# 5. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

## 5. デプロイの仕組み

- GitHub の `main` ブランチに push すると Vercel が自動的にビルド＆デプロイ
- 失敗した場合は Vercel ダッシュボードで「Deployments」→ ログを確認
- ロールバック：Deployments で過去の成功デプロイを「Promote」

## 6. データのバックアップ

- Supabase Free プランは **日次自動バックアップ**（7日分保持）
- 手動エクスポート：Supabase ダッシュボード → Database → Backups
- データ消失時：Supabase サポートに復元依頼可能

## 7. よくあるトラブル

### 「This page couldn't load」エラー
- 多くは `DATABASE_URL` の問題
- パスワードに特殊文字が含まれる場合はURLエンコード（`?` → `%3F` 等）
- Vercel の Logs で確認

### デプロイがブロックされる
- コミット作者と Vercel アカウントが不一致だと Hobby プランでは弾かれる
- 対応：`git config user.email` を Vercel アカウントと同じメールアドレスに合わせる
- またはリポジトリを Public にする

### Supabase 接続エラー
- Connection Pooler（6543）と Direct（5432）の使い分けに注意
- Vercel 上は Transaction Pooler（6543）を使用
- マイグレーション（`prisma db push`）は Session Pooler（5432）を使用

## 8. 主要ファイル

| ファイル | 役割 |
|---------|------|
| `prisma/schema.prisma` | データベース定義 |
| `app/page.tsx` | ダッシュボード |
| `app/projects/` | 案件管理 |
| `app/clients/` | 取引先管理 |
| `app/contracts/` | ライセンス契約管理 |
| `app/finance/` | 財務（PL/CF）|
| `app/import/` | Excelインポート |
| `lib/prisma.ts` | DB接続 |
| `lib/domain/` | 計算ロジック |

## 9. 推奨：将来的な移管プラン

短期：
- [ ] 後任者を全サービスにコラボレーターとして追加
- [ ] 引き継ぎドキュメント（このファイル）を共有

中期：
- [ ] **会社用メアド**（例：`cockpit@会社ドメイン`）でアカウントを新規作成
- [ ] GitHub・Vercel・Supabase のリソースを会社用アカウントに移管
- [ ] 個人アカウントを削除

長期：
- [ ] **GitHub Organization** に移管（無料・複数メンバー管理可）
- [ ] **Vercel Team プラン**を導入（規模拡大時）
- [ ] Supabase Pro プランで本格運用

## 10. 連絡先

- 開発者：（必要時に追記）
- システム関連の質問：（必要時に追記）
