# Cloud Run デプロイ手順（ワンステップずつ）

このドキュメントでは、loto6-auto-update を Google Cloud Run にデプロイする手順を、**あなたが行う作業**をワンステップずつ記載します。

---

## 前提

- Google Cloud を利用したことがある
- プロジェクトのコードはすでに Cloud Run 用に修正済み（Dockerfile 等）
- 環境変数 `DATABASE_URL`（Neon）と `AUTO_UPDATE_API_KEY` を用意する

---

## ステップ 1: Google Cloud プロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/) にログインする。
2. 既存のプロジェクトを使うか、**新しいプロジェクトを作成**する。
3. 画面上部のプロジェクト選択で、使用するプロジェクトを選ぶ。
4. **課金が有効**になっているか確認する（Cloud Run は課金を有効にしないとデプロイできない。無料枠内なら 0 円になる想定）。

**あなたがすること**: プロジェクトを選ぶ（または作成する）。課金を有効にする。

---

## ステップ 2: 必要な API の有効化

1. コンソールで **「API とサービス」→「ライブラリ」** を開く。
2. 次の API を検索して **有効化** する（未有効の場合のみ）：
   - **Cloud Run API**
   - **Artifact Registry API**（または Container Registry API。利用するリージョンに応じて）

**あなたがすること**: 上記 2 つの API を有効化する。

---

## ステップ 3: ローカルで Docker イメージをビルドする

**やることの意味**: あなたの PC 上で、このアプリを「Cloud Run で動かせる形のパッケージ（Docker イメージ）」にまとめます。そのパッケージを、次のステップで Google のサーバーに送ります。

### 3-1. Docker を動かす

- **Windows / Mac**: **Docker Desktop** をインストール済みなら、**起動**しておく（タスクバーやメニューバーに Docker のアイコンが出る状態）。
- Docker がまだ入っていない場合は、[Docker Desktop のダウンロード](https://www.docker.com/products/docker-desktop/) からインストールし、起動する。

### 3-2. ターミナル（コマンドを打つ場所）を開く

1. エクスプローラーで **このプロジェクトのフォルダ**（`loto6-auto-update` の中）を開く。
2. そのフォルダの中で、**アドレスバーに `cmd` と入力して Enter** するか、  
   または **Shift + 右クリック** → **「パワーシェルでウィンドウを開く」** を選ぶ。  
   すると、そのフォルダが「カレントディレクトリ」になった状態でターミナルが開きます。

（VS Code や Cursor を使っている場合は、メニューから **「ターミナル」→「新しいターミナル」** で開き、表示されているフォルダが `loto6-auto-update` になっていることを確認してください。）

### 3-3. ビルドコマンドを実行する

ターミナルに次の **1行** をコピー＆ペーストして Enter を押します。

```bash
docker build -t loto6-auto-update .
```

- **意味**: `Dockerfile` の手順に従って、このフォルダの中身から「loto6-auto-update」という名前の Docker イメージを作る、という指示です。
- **最後の `.`（ピリオド）**: 「今いるフォルダ（loto6-auto-update）を基準にビルドする」という意味で、**必ず付けます**。

### 3-4. 完了まで待つ

- 初回は数分〜十数分かかることがあります（Node や Chromium のダウンロードなど）。
- 最後に `Successfully built ...` や `Successfully tagged loto6-auto-update:latest` のような表示が出れば **ステップ 3 は完了**です。

**エラーが出た場合**:
- Docker Desktop が起動しているか確認する。
- ターミナルを開いたフォルダが、`Dockerfile` がある **loto6-auto-update の直下**か確認する（`cd` で移動: `cd C:\Users\itonl\Desktop\01_Frontend\loto6-auto-update` など）。

---

## ステップ 4: イメージを Artifact Registry にプッシュする

1. **Artifact Registry にリポジトリを作成**する（まだない場合）:
   - コンソールで **「Artifact Registry」→「リポジトリを作成」**。
   - リポジトリ ID 例: `loto6`
   - 形式: **Docker**。
   - リージョン例: `us-central1`（無料枠を意識する場合はドキュメントで対象リージョンを確認）。

2. **gcloud で Docker を認証**する:

   **なぜ必要か**: あなたの PC 上で `docker push` でイメージを Google に送るとき、「この Google アカウントで送ってよい」と一度だけ許可する設定です。

   **どこでやるか**: ステップ 3 で `docker build` を実行したのと同じ **ターミナル（コマンドプロンプトや PowerShell）** で行います。ブラウザのコンソールではなく、**あなたの PC のターミナル**です。

   **何をするか**: 次のコマンドを 1 行ずつ実行します。東京リージョンなら:

```bash
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

   実行すると「Docker がこのホストにアクセスすることを許可しますか？」のようなメッセージが出たら **Y** で Enter。

   - まだ **Google Cloud のコマンドラインツール（gcloud）** をインストールしていない場合は、[gcloud のインストール](https://cloud.google.com/sdk/docs/install) を先に行ってください。
   - リージョンが東京以外なら `[REGION]-docker.pkg.dev` の部分を変えます（例: 米国なら `us-central1-docker.pkg.dev`）。

3. **イメージにタグを付けてプッシュ**する（`[PROJECT_ID]` と `[REGION]` は自分の値に置き換える）:

```bash
docker tag loto6-auto-update [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO_ID]/loto6-auto-update:latest
docker push [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO_ID]/loto6-auto-update:latest
```

例:

```bash
docker tag loto6-auto-update us-central1-docker.pkg.dev/my-project-123/loto6/loto6-auto-update:latest
docker push us-central1-docker.pkg.dev/my-project-123/loto6/loto6-auto-update:latest
```

**あなたがすること**: プロジェクト ID・リージョン・リポジトリ ID を決め、上記 2 つのコマンドを実行する。

---

## ステップ 5: Cloud Run にサービスを作成する

1. コンソールで **「Cloud Run」→「サービスを作成」** を開く。
2. **「コンテナイメージの選択」** で、ステップ 4 でプッシュしたイメージ（`[REGION]-docker.pkg.dev/.../loto6-auto-update:latest`）を選ぶ。
3. **サービス名** を入力する（例: `loto6-auto-update`）。
4. **リージョン** を選ぶ（無料枠を使う場合は例: `us-central1` など、公式の無料枠対象リージョンを確認する）。
5. **認証**: 「未認証の呼び出しを許可」を **許可** にする（cron.job.org から API キー付きで呼ぶため）。
6. **コンテナの設定** を開く:
   - **メモリ**: 最低 **1 GiB**（Puppeteer 用。2 GiB 推奨）。
   - **CPU**: 1 で可。
   - **ポート**: **8080** のまま（Dockerfile で 8080 を使用しているため）。
7. **「変数とシークレット」** で次の環境変数を追加する:
   - `DATABASE_URL`: Neon の接続文字列。
   - `AUTO_UPDATE_API_KEY`: あなたが決めた API キー（cron で使う）。
8. **「作成」** でサービスを作成する。

**あなたがすること**: 上記のとおりコンソールで設定し、サービスを作成する。

---

## ステップ 6: サービスの URL を確認する

1. Cloud Run のサービス詳細画面で **「URL」** をコピーする。  
   例: `https://loto6-auto-update-xxxxx-uc.a.run.app`
2. 動作確認用の URL は次の形式になる:
   - `https://[あなたのURL]/api/loto6/auto-update?apiKey=[AUTO_UPDATE_API_KEY]`

**あなたがすること**: URL をメモする。ブラウザで上記 URL を開き、JSON が返れば OK。

---

## ステップ 7: cron.job.org の設定を更新する

1. [cron.job.org](https://cron-job.org/) にログインする。
2. 既存の「Loto6 Auto Update」ジョブを **編集** する（または新規作成）。
3. **URL** を、ステップ 6 の Cloud Run の URL に変更する:
   - `https://[あなたのCloud RunのURL]/api/loto6/auto-update?apiKey=[AUTO_UPDATE_API_KEY]`
4. **Schedule** はそのまま（例: 毎週火曜・金曜の `0 9 * * 2,5` など）。
5. **Method**: GET。
6. 保存する。

**あなたがすること**: cron.job.org の URL を Cloud Run の URL に更新し、保存する。

---

## ステップ 8: 動作確認

1. cron.job.org で **「今すぐ実行」**（Run now）を押す。
2. Cloud Run の **「ログ」** でリクエストとアプリのログを確認する。
3. 成功時は API が `success: true` とメッセージを返す。Neon の DB に当選番号が入っているかも確認する。

**あなたがすること**: 上記で 1 回手動実行し、ログと DB で結果を確認する。

---

## まとめチェックリスト

- [ ] プロジェクトを選択（または作成）し、課金を有効にした
- [ ] Cloud Run API と Artifact Registry API を有効にした
- [ ] `docker build -t loto6-auto-update .` でイメージをビルドした
- [ ] Artifact Registry にリポジトリを作成し、イメージをプッシュした
- [ ] Cloud Run でサービスを作成し、メモリ 1GiB 以上・環境変数（DATABASE_URL, AUTO_UPDATE_API_KEY）を設定した
- [ ] サービスの URL を確認し、ブラウザで API を叩いて動作確認した
- [ ] cron.job.org の URL を Cloud Run の URL に更新した
- [ ] 「今すぐ実行」で 1 回テストし、ログと DB で確認した

---

## トラブルシューティング

- **502 Bad Gateway**: コンテナの起動に失敗している可能性。Cloud Run のログでエラーを確認。メモリを 2 GiB に増やすと改善することがある。
- **Chromium が動かない**: メモリを 1 GiB 以上（推奨 2 GiB）に設定する。
- **DATABASE_URL エラー**: Cloud Run の「変数とシークレット」で値が正しく設定されているか確認。Neon の接続文字列に `?sslmode=require` が含まれているか確認する。

以上で、Railway から Cloud Run への移行が完了です。
