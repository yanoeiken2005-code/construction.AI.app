# 建設ナレッジAI セットアップ手順

このアプリには **2 種類のセットアップ** があります。

- **【A】管理者(あなた)が最初の 1 回だけ行うセットアップ** … 下記「管理者向け」
- **【B】利用者(社長・社員)が普段アプリを使う方法** … 下記「利用者向け」

> **重要:** 利用者は Anthropic / Claude / OpenAI / Claude Code などの AI アカウントは **一切不要** です。AI の呼び出しはすべて管理者が用意したサーバー側で行うため、利用者は管理者から発行されたメールアドレスとパスワードでログインするだけで使えます。

---

# 【A】管理者向けセットアップ(1 回のみ)

## A-0. 必要なもの(管理者)

- Node.js 18 以上
- Supabase アカウント(無料)
- Anthropic API キー(Claude 用)
- OpenAI API キー(埋め込み生成用)

これら 3 つの API キーは **管理者(あなた)だけが保有** します。利用者には共有しません。

---

## A-1. Supabase プロジェクト作成

1. https://supabase.com にアクセスしてアカウント作成
2. 「New project」でプロジェクトを作成
3. プロジェクトの **Settings > API** から以下を控える:
   - `Project URL`
   - `anon / public` キー
   - `service_role` キー(Secret セクション)

---

## A-2. Supabase データベース設定

Supabase の **SQL Editor** を開き、以下を**この順番で**実行します:

1. `supabase/schema.sql` (基本テーブル: documents / chat_messages)
2. `supabase/admin-schema.sql` (public.users + RLS + is_admin関数)
3. `supabase/companies-schema.sql` (companies テーブル + ユーザー紐付け)

### 管理者ユーザーの設定

```sql
update public.users set role = 'admin' where email = 'あなたのメール@example.com';
```

このユーザーが `/admin` にアクセスして会社・ユーザーを管理できます。

### プラン上限

| プラン | 最大ユーザー数 | 月間AI質問回数 |
|---|---|---|
| スモール | 5名 | 100回 |
| スタンダード | 20名 | 1000回 |

上限は `types/index.ts` の `PLAN_LIMITS` で調整できます。月間質問数は毎月1日にリセットされ、会社単位で集計されます。

---

## A-3. 環境変数ファイルを作成

プロジェクトルートに `.env.local` ファイルを作成し、以下を記入:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

> `ANTHROPIC_API_KEY` と `OPENAI_API_KEY` は **サーバー側でしか使われません**。ブラウザには送信されないので、利用者には漏れません。

---

## A-4. 利用者アカウントを作成

1. Supabase の **Authentication > Users** を開く
2. 「Add user」→ **Auto Confirm User を ON** にしてメールアドレスとパスワードを設定
3. 社長・社員分のアカウントを作成
4. 発行したメールアドレスとパスワードを利用者に共有

---

## A-5. ローカルで動作確認

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス → ログイン画面が表示されます。

---

## A-6. Vercel にデプロイ(本番運用)

1. https://vercel.com でアカウント作成
2. このフォルダを GitHub にプッシュ
3. Vercel で「New Project」→ GitHub リポジトリを選択
4. **Environment Variables** に `.env.local` の内容をすべて設定
5. デプロイ完了 → 公開 URL が発行される
6. その URL を利用者に共有(例: `https://your-app.vercel.app`)

---

## A-7. ランニングコストの目安(管理者負担)

| 項目 | 目安 |
|---|---|
| Supabase | 無料枠で十分(500MB DB / 1GB Storage) |
| Vercel | 無料枠で十分(Hobby プラン) |
| Anthropic Claude | 質問数に応じた従量課金(月 $5〜) |
| OpenAI Embeddings | 非常に安価(月 $1 以下が大半) |

利用者が増えても **AI 料金は管理者の Anthropic / OpenAI アカウントに請求** されます。

---

# 【B】利用者(社長・社員)向け使い方

## B-1. 必要なもの

- スマホまたはパソコン(ブラウザがあれば OK)
- 管理者から渡された **メールアドレス + パスワード**

**Anthropic アカウントや OpenAI アカウント、Claude Code などは一切不要です。**

---

## B-2. ログイン

1. 管理者から渡された URL を開く(例: `https://your-app.vercel.app`)
2. メールアドレスとパスワードを入力してログイン

---

## B-2.5. スマホのホーム画面に追加(おすすめ)

ホーム画面にアイコンを追加すると、毎回 URL を入力せずに 1 タップで開けます。Wi-Fi がなくてもモバイル回線(4G/5G)があればどこからでも使えます。

### iPhone(Safari)
1. Safari でアプリの URL を開く
2. 下部の **共有ボタン(□↑)** をタップ
3. 「**ホーム画面に追加**」を選択 → 「追加」
4. ホーム画面の「建設AI」アイコンをタップで起動

### Android(Chrome)
1. Chrome でアプリの URL を開く
2. 右上の **︙メニュー** をタップ
3. 「**ホーム画面に追加**」または「**アプリをインストール**」を選択
4. ホーム画面のアイコンをタップで起動

> **ポイント:** ホーム画面から開くとアドレスバーが消え、ネイティブアプリのような表示になります。

---

## B-3. ファイルをアップロードする

1. 「ファイル追加」をクリック
2. PDF・Excel・Word・画像をドラッグ&ドロップ
3. 工事名とカテゴリを入力して「アップロード」

## B-4. AI に質問する

1. 「AI 検索」をクリック
2. チャット欄に質問を入力(例:「去年の騒音クレームの対応は?」)
3. AI が関連書類を参照しながら回答

---

# トラブルシューティング

**ログインできない(利用者)**
→ 管理者に「Auto Confirm User」が ON でアカウントが作成されているか確認してもらう

**AI の回答が「参照できる資料がない」と出る**
→ まずファイルをアップロードしてください

**ファイルアップロードに失敗する**
→ 管理者向け: `supabase/schema.sql` の Storage 設定が実行されているか確認

**「Anthropic API のクレジット残高が不足しています」と表示される**
→ 管理者向け: https://console.anthropic.com/settings/billing でクレジットを追加
