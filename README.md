# Loto6 Auto Update (Cloud Run)

ロト6の最新当選番号を自動取得してデータベースに格納する、Google Cloud Run 向けの軽量バックエンドプロジェクトです。

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
│  Google Cloud Run (loto6-auto-update)   │
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

**Cloud Run へのデプロイ手順は [CLOUD_RUN_SETUP.md](./CLOUD_RUN_SETUP.md) を参照してください。** ワンステップずつ記載しています。

### 必要な環境変数（Cloud Run で設定）

```env
# 必須
DATABASE_URL=your_neon_database_connection_string
AUTO_UPDATE_API_KEY=your-secure-random-api-key
```

（Cloud Run ではコンテナ内に Chromium を含むため、`CHROMIUM_REMOTE_EXEC_PATH` は不要です。）

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

### Cloud Run でのテスト

デプロイ後、以下のURLで動作確認：

```
https://[your-cloud-run-url]/api/loto6/auto-update?apiKey=YOUR_API_KEY
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
- `AUTO_UPDATE_API_KEY`環境変数が設定されているか確認
- cron.job.orgのURLに正しいAPIキーが含まれているか確認

## 関連プロジェクト

- **メインアプリ**: [loto6-check](../loto6-check) (Vercel)
- **データベース**: Neon PostgreSQL（共有）

## ライセンス

このプロジェクトはプライベートプロジェクトです。
