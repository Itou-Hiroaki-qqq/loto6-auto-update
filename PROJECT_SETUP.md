# Railwayプロジェクトセットアップガイド

このドキュメントでは、この軽量バックエンドプロジェクトをRailwayにデプロイする手順を説明します。

## 前提条件

- Railwayアカウント（[railway.app](https://railway.app)）
- Neonデータベースアカウント（[neon.tech](https://neon.tech)）
- GitHubアカウント
- cron.job.orgアカウント（[cron-job.org](https://cron-job.org/)）

## ステップ1: GitHubリポジトリの作成

1. GitHubで新しいリポジトリを作成（例: `loto6-auto-update`）
2. このプロジェクトをプッシュ：

```bash
cd loto6-auto-update
git init
git add .
git commit -m "Initial commit: Railway lightweight backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/loto6-auto-update.git
git push -u origin main
```

## ステップ2: Railwayプロジェクトの作成

1. [Railwayダッシュボード](https://railway.app/dashboard)にログイン
2. **New Project** をクリック
3. **Deploy from GitHub repo** を選択
4. `loto6-auto-update` リポジトリを選択
5. 自動的にデプロイが開始されます

## ステップ3: 環境変数の設定

1. Railwayプロジェクトの **Variables** タブを開く
2. 以下の環境変数を追加：

### 必須の環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | Neonデータベースの接続文字列 | `postgresql://user:pass@host/db?sslmode=require` |
| `AUTO_UPDATE_API_KEY` | APIキー（セキュアなランダム文字列） | `3b8d7b4e9b4afa3a4ae3f5ee3aac17c834468032fc8a8de882435b6c5d4f99b7` |

### 推奨の環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `CHROMIUM_REMOTE_EXEC_PATH` | ChromiumバイナリのURL | `https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar.br` |

### APIキーの生成方法

```bash
# Mac/Linux
openssl rand -hex 32

# Windows (PowerShell)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## ステップ4: Railway URLの確認

1. Railwayプロジェクトの **Settings** タブを開く
2. **Networking** セクションで **Generate Domain** をクリック
3. 生成されたURLをコピー（例: `https://loto6-auto-update-production.up.railway.app`）

## ステップ5: cron.job.orgの設定

1. [cron.job.org](https://cron-job.org/)にログイン
2. **Create cronjob** をクリック
3. 以下の情報を入力：

### 基本設定

- **Title**: `Loto6 Auto Update`
- **URL**: `https://[your-railway-url]/api/loto6/auto-update?apiKey=[YOUR_API_KEY]`
  - 例: `https://loto6-auto-update-production.up.railway.app/api/loto6/auto-update?apiKey=3b8d7b4e9b4afa3a4ae3f5ee3aac17c834468032fc8a8de882435b6c5d4f99b7`
- **Schedule**: `0 9 * * 2,5`
  - これは毎週火曜（2）と金曜（5）の9時（UTC）を意味します
  - JSTの場合、UTC+9なので、実際の実行時間は18時（午後6時）になります
- **Method**: `GET`
- **Enable job**: ✅ チェックを入れる

### スケジュールのカスタマイズ

JSTの朝9時に実行したい場合：
- JST 9:00 = UTC 0:00（夏時間の場合）
- スケジュール: `0 0 * * 2,5`

JSTの午前9時に実行したい場合（標準時間）：
- JST 9:00 = UTC 0:00
- スケジュール: `0 0 * * 2,5`

## ステップ6: 動作確認

### 1. 手動でテスト実行

ブラウザまたはcurlで以下のURLにアクセス：

```bash
curl "https://[your-railway-url]/api/loto6/auto-update?apiKey=[YOUR_API_KEY]"
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

### 2. cron.job.orgからテスト実行

1. cron.job.orgのダッシュボードで、作成したcronジョブを開く
2. **Run now** または **Test** ボタンをクリック
3. 実行ログを確認

### 3. Railwayのログを確認

1. Railwayダッシュボードでプロジェクトを開く
2. **Deployments** タブで最新のデプロイをクリック
3. **View Logs** をクリック
4. APIが呼び出された際のログを確認

## トラブルシューティング

### デプロイが失敗する場合

1. **ログを確認**: Railwayのログでエラーメッセージを確認
2. **環境変数を確認**: すべての必須環境変数が設定されているか確認
3. **Node.jsバージョン**: `package.json`の`engines`フィールドで`node >= 20.0.0`を指定

### Puppeteerが動作しない場合

1. **ChromiumのURLを確認**: `CHROMIUM_REMOTE_EXEC_PATH`が正しいか確認
2. **最新のURLを確認**: [GitHubリリースページ](https://github.com/Sparticuz/chromium/releases)から最新のv143系のURLを確認
3. **メモリ制限**: Railwayのメモリ制限を確認（必要に応じて増やす）

### APIが401エラーを返す場合

- `AUTO_UPDATE_API_KEY`環境変数が設定されているか確認
- cron.job.orgのURLに正しいAPIキーが含まれているか確認
- 環境変数の値を再確認（余分なスペースや改行がないか）

### データベース接続エラー

- `DATABASE_URL`環境変数が正しく設定されているか確認
- Neonダッシュボードで接続が有効か確認
- SSLモードが`require`になっているか確認

## コスト管理

Railwayの無料プラン（$5クレジット/月）で動作することを想定しています。

### コスト削減のポイント

1. ✅ **軽量なプロジェクト**: フロントエンド不要、最小限の依存関係
2. ✅ **必要時のみ実行**: cronスケジュールで実行（毎週2回のみ）
3. ✅ **サーバーレス**: 実行時のみリソースを使用

### 使用量の確認

1. Railwayダッシュボードで **Usage** タブを開く
2. メモリ、CPU、ネットワーク使用量を確認
3. 必要に応じてリソースを調整

## 次のステップ

1. ✅ Railwayでのデプロイが完了
2. ✅ cron.job.orgの設定が完了
3. ✅ 動作確認が完了

これで、自動更新機能が正常に動作するはずです！

## 参考リンク

- [Railway公式ドキュメント](https://docs.railway.app/)
- [Neon公式ドキュメント](https://neon.tech/docs)
- [cron.job.org公式ドキュメント](https://cron-job.org/en/documentation/)
