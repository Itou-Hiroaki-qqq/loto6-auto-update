# Loto6 Auto Update (Railway Backend)

ロト6の最新当選番号を自動取得してデータベースに格納する、Railway専用の軽量バックエンドプロジェクトです。

## 概要

このプロジェクトは、メインアプリ（フロントエンド）とは分離された軽量なバックエンドサービスです。

### 機能

- ✅ ロト6公式サイトから最新の当選番号をスクレイピング（Puppeteer使用）
- ✅ Neonデータベースへの自動格納
- ✅ cron.job.orgによるスケジュール実行（毎週火曜・金曜の朝）
- ✅ APIキー認証によるセキュリティ

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│  Railway (loto6-auto-update)           │
│  └─ /api/loto6/auto-update             │
│     └─ Puppeteerスクレイピング           │
│        └─ Neon DBに格納                 │
└─────────────────────────────────────────┘
                  ↓ 共有
┌─────────────────────────────────────────┐
│  Neon PostgreSQL Database               │
│  └─ winning_numbers テーブル             │
└─────────────────────────────────────────┘
                  ↑ 読み取り
┌─────────────────────────────────────────┐
│  Vercel (loto6-check)                  │
│  └─ フロントエンド + その他API           │
└─────────────────────────────────────────┘
```

## セットアップ

### 1. 必要な環境変数

Railwayダッシュボードで以下の環境変数を設定してください：

```env
# 必須
DATABASE_URL=your_neon_database_connection_string
AUTO_UPDATE_API_KEY=your-secure-random-api-key

# 推奨（Puppeteer使用時）
CHROMIUM_REMOTE_EXEC_PATH=https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar.br
```

### 2. APIキーの生成

強力なランダムなAPIキーを生成してください：

```bash
# Mac/Linux
openssl rand -hex 32

# Windows (PowerShell)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Railwayへのデプロイ

1. [Railwayダッシュボード](https://railway.app/dashboard)にログイン
2. **New Project** → **Deploy from GitHub repo** を選択
3. このリポジトリを選択
4. 環境変数を設定（上記参照）
5. デプロイを待つ

### 4. cron.job.orgの設定

1. [cron.job.org](https://cron-job.org/)にログイン
2. **Create cronjob** をクリック
3. 以下の設定を入力：
   - **Title**: Loto6 Auto Update
   - **URL**: `https://[your-railway-url]/api/loto6/auto-update?apiKey=[YOUR_API_KEY]`
   - **Schedule**: `0 9 * * 2,5`（毎週火曜と金曜の9時）
   - **Method**: GET
   - **Enable job**: ✅ チェックを入れる
4. **Create cronjob** をクリック

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

ブラウザで以下のURLにアクセス：

```
http://localhost:3000/api/loto6/auto-update?apiKey=YOUR_API_KEY
```

### Railwayでのテスト

デプロイ後、以下のURLで動作確認：

```
https://[your-railway-url]/api/loto6/auto-update?apiKey=YOUR_API_KEY
```

**期待されるレスポンス：**

```json
{
  "success": true,
  "message": "自動更新完了: 新規1件、更新0件",
  "count": 1,
  "updated": 0,
  "total": 1
}
```

## 注意事項

### コスト最適化

このプロジェクトは軽量に設計されており、Railwayの無料枠内で動作することを想定しています：

- ✅ フロントエンド不要（APIルートのみ）
- ✅ 最小限の依存関係
- ✅ 必要時のみ実行（cronスケジュール）
- ✅ Puppeteerは必要な時だけ起動

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

### Chromiumのエラー

エラー: `Chromium executable path could not be determined`

**解決策**: 
- `CHROMIUM_REMOTE_EXEC_PATH`環境変数を設定
- または、最新のURLを確認: https://github.com/Sparticuz/chromium/releases

### データベース接続エラー

エラー: `Connection failed`

**解決策**:
- `DATABASE_URL`環境変数が正しく設定されているか確認
- Neonダッシュボードで接続が有効か確認

### API認証エラー

エラー: `Unauthorized`

**解決策**:
- `AUTO_UPDATE_API_KEY`環境変数が設定されているか確認
- cron.job.orgのURLに正しいAPIキーが含まれているか確認

## 関連プロジェクト

- **メインアプリ**: [loto6-check](../loto6-check) (Vercel)
- **データベース**: Neon PostgreSQL（共有）

## ライセンス

このプロジェクトはプライベートプロジェクトです。
