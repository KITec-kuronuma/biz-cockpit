# biz-cockpit

業務管理ダッシュボード（案件・契約・請求・入金・原価を一元管理）

## 技術スタック

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Prisma 7** + **PostgreSQL**（本番）/ **SQLite**（ローカル開発）
- **Vercel**（ホスティング）+ **Supabase**（DB）

## ローカル開発

`.env` に Supabase の `DATABASE_URL` を設定後：

```bash
npm install
npx prisma generate
npx prisma db push       # スキーマからテーブル作成
npx tsx prisma/seed.ts   # サンプルデータ投入
npm run dev
```

http://localhost:3000 で起動します。

---

## 本番デプロイ手順（Vercel + Supabase）

### 1. Supabase でデータベース作成

1. https://supabase.com にサインアップ
2. **New Project** → Project 名・パスワードを設定（リージョンは **Northeast Asia (Tokyo)** 推奨）
3. プロジェクト作成後、**Project Settings → Database → Connection string → URI** をコピー
4. パスワード部分を実際のパスワードに置換しておく

### 2. GitHub にコードをプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[YOUR-USER]/biz-cockpit.git
git push -u origin main
```

### 3. Vercel にデプロイ

1. https://vercel.com にサインアップ（GitHubでログイン推奨）
2. **Add New → Project** → GitHubリポジトリを選択
3. **Environment Variables** に以下を追加：
   - `DATABASE_URL` = Supabaseで取得したURI
4. **Deploy** をクリック

### 4. データベース初期化・シード

ローカル環境の `.env` に Supabase の `DATABASE_URL` を設定し：

```bash
npx prisma db push      # テーブル作成
npx tsx prisma/seed.ts  # 初期データ投入
```

### 5. 動作確認

Vercel が発行した URL（例: `https://biz-cockpit.vercel.app`）にアクセス。

---

## 主な画面

| URL | 内容 |
|-----|------|
| `/` | ダッシュボード（KPI・契約ファネル・年間タイムライン） |
| `/projects` | 案件一覧 |
| `/projects/[id]` | 案件詳細（請求・入金・原価編集） |
| `/clients` | 取引先一覧 |
| `/clients/[id]` | 取引先詳細（担当者編集） |
| `/finance` | 月次PL / キャッシュフロー |
| `/settings` | 設定 |
| `/contacts` | 担当者一覧 |
| `/forecast` | 売上見込タイムライン |
| `/contracts` | ライセンス契約一覧 |
| `/activities` | 活動履歴 |
| `/users` | ユーザー管理 |

## データモデル

- **Client** 取引先企業
- **Contact** 担当者（送付区分フラグ付き）
- **Project** 案件（中核）
- **Invoice** 請求（1案件 1:多）
- **Payment** 入金（1請求 1:多）
- **CostMonthly** 月次原価
- **Setting** アプリ設定
- **User** ユーザー（権限管理）
- **Activity** 活動履歴
