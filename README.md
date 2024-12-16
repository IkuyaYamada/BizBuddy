# BizBuddy

ビジネスパーソンのための階層型タスク管理アプリケーション

## 最近の更新

### フォーカスモードの追加 (2024-01-XX)
- タスクに集中するためのフォーカスモード機能を追加
- ポモドーロタイマー機能の統合
- キーボードショートカットのサポート
  - ESC: フォーカスモード終了
  - Ctrl/Cmd + ←/→ または j/k: タスク切り替え
  - Ctrl + Enter: メモ保存
- メモと作業ログの表示機能
- リサイズ可能なメモエリア

## 主な機能
- 階層型タスク管理
- デイリータスクスケジューラー
- フォーカスモード
- ポモドーロタイマー
- 作業ログ記録
- キーボードショートカット

## 技術スタック
- フロントエンド: Next.js, TypeScript, TailwindCSS
- バックエンド: FastAPI, Python
- データベース: SQLite

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
