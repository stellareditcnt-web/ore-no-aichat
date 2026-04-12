# 俺のAIChat: ローカル環境 & Ollama 連携ガイド

このドキュメントでは、本アプリケーションの構造と、ローカル環境で動作する AI (Ollama) を組み込んで完全無料で運用する方法について解説します。

---

## 1. アプリケーションの構造

本アプリは **React (フロントエンド)** と **Express (バックエンド)** が統合されたフルスタック構成です。

### フロントエンド (src/App.tsx)
- **フレームワーク**: React 19 + Vite
- **スタイリング**: Tailwind CSS 4 (ユーティリティクラスによるモダンなデザイン)
- **アニメーション**: Motion (framer-motion) による滑らかなUI遷移
- **状態管理**: 
  - `localStorage` を使用したセーブスロット機能
  - 主人公設定、世界設定、登場キャラクターのステータスを永続化
- **プロンプト制御**: 
  - `WORLD_SETTING_PROMPT`: 世界観構築のサポート
  - `ADVENTURE_PROMPT`: ゲームマスターとして物語を進行（10ステップ構成、描写の【】囲み、世界観の反映などを厳密に指示）

### バックエンド (server.ts)
- **サーバー**: Express
- **AI 連携ロジック**:
  - `/api/chat` エンドポイントが AI との通信を仲介
  - **ハイブリッド設計**: 環境変数に応じて「OpenRouter (クラウド)」と「Ollama (ローカル)」を自動で切り替え
  - **OpenAI 互換 API**: Ollama の `/v1/chat/completions` エンドポイントを利用することで、標準的なライブラリで通信可能

---

## 2. ローカル環境 (Ollama) の組み込み方法

Ollama を使用することで、API クレジットを消費せずに無制限に物語を楽しむことができます。

### ステップ 1: Ollama の準備
1. [Ollama 公式サイト](https://ollama.com/) からインストールします。
2. 必要なモデル（例: `llama3`, `mistral`, `gemma2` など）をダウンロードします。
   ```bash
   ollama pull llama3
   ```

### ステップ 2: Ollama の外部アクセス許可 (CORS設定)
クラウド上のアプリからローカルの Ollama に接続するには、セキュリティ制限を解除して起動する必要があります。

- **Windows (PowerShell)**:
  ```powershell
  $env:OLLAMA_HOST="0.0.0.0"
  $env:OLLAMA_ORIGINS="*"
  ollama serve
  ```
- **Mac / Linux**:
  ```bash
  OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS="*" ollama serve
  ```

### ステップ 3: トンネリングツールの使用 (ngrok)
アプリが Cloud Run 等の外部サーバーで動いている場合、ローカルの `localhost:11434` に直接アクセスできません。ngrok を使って公開URLを作成します。

1. ngrok をインストールし、以下を実行します。
   ```bash
   ngrok http 11434
   ```
2. 発行された `https://xxxx.ngrok-free.app` のような URL をコピーします。

### ステップ 4: アプリケーションの設定 (環境変数)
AI Studio の **Secrets** またはローカルの `.env` ファイルに以下を設定します。

- `LOCAL_AI_BASE_URL`: ステップ 3 で取得した ngrok の URL
- `LOCAL_AI_MODEL`: 使用するモデル名 (例: `llama3`)

---

## 3. 動作の仕組み

`server.ts` 内の `/api/chat` は以下のように動作します：

1. `LOCAL_AI_BASE_URL` が設定されているか確認。
2. **設定されている場合**:
   - 接続先を `LOCAL_AI_BASE_URL/v1/chat/completions` に変更。
   - モデル名を `LOCAL_AI_MODEL` に変更。
   - 認証ヘッダーをダミー（`Bearer ollama`）に変更。
3. **設定されていない場合**:
   - `OPENROUTER_API_KEY` を使用して OpenRouter に接続。

これにより、ユーザーは環境変数を書き換えるだけで、シームレスにローカル AI とクラウド AI を使い分けることができます。

---

## 4. 注意事項
- **スペック**: ローカル AI の速度は PC の GPU 性能に依存します。
- **URL の更新**: ngrok の無料版は再起動のたびに URL が変わるため、その都度アプリ側の設定を更新してください。
- **モデルの選択**: 日本語の情緒的な表現には、Llama 3 ベースの日本語微調整モデル（例: `elyza:8b` など）を Ollama に取り込んで使用するのがおすすめです。
