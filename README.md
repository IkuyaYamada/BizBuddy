# BizBuddy

タスク管理とメークログ記録のためのWebアプリケーション

## 主な機能

### 階層型タスク管理
- タスクの階層構造による整理
- ドラッグ&ドロップでの並び替え
- タブ切り替え時の編集状態保持

### デイリータスク管理
- 日付ごとのタスク管理
- 見積時間の設定と進捗管理
- クイックタスク追加機能

### フォーカスモード
- ポモドーロタイマー
- タスクごとのメモ機能
- ワークログの記録と表示

### タスク完了時の振り返り
- 任意の感想・振り返りの記録
- 成果物・結果の記録
- 階層構造を考慮したワークログ管理

## 最近の更新

- タスク完了時の感想入力を任意に変更
- 文字化けの修正
- パフォーマンスの改善（ドラッグ&ドロップの最適化）

## 技術スタック

### フロントエンド
- Next.js
- TypeScript
- TailwindCSS
- DND Kit（ドラッグ&ドロップ）

### バックエンド
- FastAPI
- SQLAlchemy
- PostgreSQL

## 開発環境のセットアップ

1. リポジトリのクローン
```bash
git clone [repository-url]
cd BizBuddy
```

2. フロントエンドの依存関係インストール
```bash
cd frontend
npm install
```

3. バックエンドの依存関係インストール
```bash
cd backend
pip install -r requirements.txt
```

4. 開発サーバーの起動
```bash
# フロントエンド
cd frontend
npm run dev

# バックエンド
cd backend
uvicorn main:app --reload
```
