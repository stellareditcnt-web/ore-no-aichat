# デプロイ手順

## 環境
- ホスティング: [Railway](https://railway.app)
- リポジトリ: https://github.com/stellareditcnt-web/ore-no-aichat
- 公開URL: https://triumphant-celebration-production.up.railway.app

---

## アップデートのデプロイ手順

### 通常の更新（コード修正後）

```bash
# 1. 変更をコミット
git add <変更ファイル>
git commit -m "変更内容のメモ"

# 2. GitHubにpush
git push origin main

# 3. Railwayに再デプロイ
railway up --detach --service c966d0c7-663b-4198-af01-c85009db401d
```

### デプロイ確認

ビルドログはRailwayダッシュボードで確認:
https://railway.com/project/1f5b2123-fa87-44e2-a59b-7f16bf71004c

---

## 初回セットアップ（環境を作り直す場合）

```bash
# Railway CLIインストール
npm install -g @railway/cli

# ログイン
railway login

# プロジェクト初期化（プロジェクトディレクトリで）
railway init

# デプロイ
railway up --detach

# 公開URLを発行
railway domain
```

---

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `GEMINI_API_KEY` | GeminiのAPIキー | 任意（UIからも設定可） |
| `PORT` | ポート番号 | Railwayが自動設定 |

環境変数の設定:
```bash
railway variables --set "GEMINI_API_KEY=your_key_here"
```
