# Loto6 Auto Update (Cloud Run)

ロト6の最新当選番号を自動取得してデータベースに格納する、Google Cloud Run 向けの軽量バックエンドプロジェクトです。

## 概要

このプロジェクトは、メインアプリ（フロントエンド）とは分離された軽量なバックエンドサービスです。

### 機能

- ✅ ロト6公式サイトから最新の当選番号をスクレイピング（Puppeteer使用）
- ✅ Neonデータベースへの自動格納
- ✅ Cloudflare Workers版アプリ（D1）へのデータ自動同期
- ✅ cron.job.orgによるスケジュール実行（毎週火曜・金曜の朝）
- ✅ APIキー認証によるセキュリティ

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│  Google Cloud Run (loto6-auto-update)   │
│  └─ /api/loto6/auto-update             │
│     └─ Puppeteerスクレイピング           │
│        ├─ Neon DBに格納                 │
│        └─ Cloudflare Workersに同期      │
└─────────────────────────────────────────┘
            ↓ 共有              ↓ POST同期
┌──────────────────────┐  ┌──────────────────────────┐
│  Neon PostgreSQL DB  │  │  Cloudflare Workers      │
│  └─ winning_numbers  │  │  (loto6-check-cloudflare)│
└──────────────────────┘  │  └─ D1 Database          │
            ↑ 読み取り     └──────────────────────────┘
┌──────────────────────┐
│  Vercel (loto6-check)│
│  └─ フロントエンド    │
└──────────────────────┘
```

## セットアップ

**Cloud Run へのデプロイ手順は [CLOUD_RUN_SETUP.md](./CLOUD_RUN_SETUP.md) を参照してください。** ワンステップずつ記載しています。

### 必要な環境変数（Cloud Run で設定）

```env
# 必須
DATABASE_URL=your_neon_database_connection_string
AUTO_UPDATE_API_KEY=your-secure-random-api-key

# Cloudflare Workers連携（任意）
CLOUDFLARE_APP_URL=https://your-cloudflare-workers-app.pages.dev
CLOUDFLARE_API_KEY=your-cloudflare-api-key
```

- Cloud Runではコンテナー内にChromiumを含むため、`CHROMIUM_REMOTE_EXEC_PATH`は不要です。
- `CLOUDFLARE_APP_URL`と`CLOUDFLARE_API_KEY`を設定すると、スクレイピング後にCloudflare Workers版アプリの`/api/loto6/import`にもデータを自動同期します。未設定の場合はスキップされます。

## プロジェクト構造

```
loto6-auto-update/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── loto6/
│   │           └── auto-update/
│   │               └── route.ts      # メインAPIエンドポイント
│   └── lib/
│       ├── neon.ts                   # データベース接続
│       └── loto6/
│           └── scraper.ts            # スクレイピングロジック
├── package.json
├── tsconfig.json
└── README.md
```

## 依存関係

最小限の依存関係のみを含んでいます：

- `next`: Next.js（APIルート用）
- `puppeteer-core`: Puppeteer（サーバーレス環境用）
- `@sparticuz/chromium`: Chromiumバイナリ
- `cheerio`: HTMLパース
- `@neondatabase/serverless`: Neonデータベース接続

## 動作確認

### ローカルでのテスト

```bash
npm install
npm run dev
```

以下のURLに `x-api-key` ヘッダーを付けてリクエストを送る（ブラウザではなく curl 等で確認）：

```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/api/loto6/auto-update
```

### Cloud Run でのテスト

デプロイ後、`x-api-key` ヘッダーを付けてリクエストを送る：

```bash
curl -H "x-api-key: YOUR_API_KEY" https://[your-cloud-run-url]/api/loto6/auto-update
```

**期待されるレスポンス：**

```json
{
  "success": true,
  "message": "自動更新完了: 新規1件、更新0件",
  "count": 1,
  "updated": 0,
  "total": 1,
  "cloudflareSync": "success: 1件インポートしました"
}
```

## 注意事項

### コスト最適化

このプロジェクトは軽量に設計されており、Cloud Run の無料枠内で動作することを想定しています：

- ✅ フロントエンド不要（APIルートのみ）
- ✅ 必要時のみ実行（cronスケジュール・週2回）で従量課金が抑えられる
- ✅ Puppeteerはリクエスト時のみ起動

### データベース

このプロジェクトは、メインアプリ（Vercel）と同じNeonデータベースを使用します。

**重要**: データベーススキーマは、メインプロジェクトと同じである必要があります。

```sql
-- winning_numbers テーブルの定義
CREATE TABLE IF NOT EXISTS winning_numbers (
    draw_date DATE PRIMARY KEY,
    main_numbers INTEGER[] NOT NULL,
    bonus_number INTEGER NOT NULL,
    draw_number INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## トラブルシューティング

### Chromiumのエラー（Cloud Run）

エラー: Chromium が起動しない

**解決策**: 
- Cloud Run の Docker イメージにはシステム Chromium が含まれています。メモリを 1GB 以上に設定してください。
- ローカルや Railway 利用時は `CHROMIUM_REMOTE_EXEC_PATH` 等を設定してください。

### データベース接続エラー

エラー: `Connection failed`

**解決策**:
- `DATABASE_URL`環境変数が正しく設定されているか確認
- Neonダッシュボードで接続が有効か確認

### API認証エラー

エラー: `Unauthorized`

**解決策**:
- `AUTO_UPDATE_API_KEY` 環境変数が Cloud Run に設定されているか確認
- cron.job.org の Headers に `x-api-key: YOUR_API_KEY` が設定されているか確認
- URLに `?apiKey=` を含めても認証されない（ヘッダーのみ有効）

## 関連プロジェクト

- **メインアプリ**: [loto6-check](../loto6-check) (Vercel + Neon)
- **Cloudflare版アプリ**: [loto6-check-cloudflare](../loto6-check-cloudflare) (Cloudflare Workers + D1)
- **データベース**: Neon PostgreSQL（Vercel版と共有）、Cloudflare D1（Workers版）

## ライセンス

このプロジェクトはプライベートプロジェクトです。
