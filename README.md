# BizBuddy - タスク管理アプリケーション

## 機能一覧

### コア機能
- タスク管理（CRUD）
  - タスクの作成、編集、削除
  - 優先度とモチベーションの設定（0-100）
  - ステータス管理（未着手、進行中、完了）
  - 期限設定と残り時間表示
  - 作成日時の記録
  - タスクの説明文にマークダウン対応
  - タスク一覧の自動ソート（ステータス・優先度順）

### メモ機能
- クイックメモの作成と管理
- メモからタスクの作業ログへの変換
- タスクとメモの関連付け
- マークダウン形式対応

### 作業ログ機能
- タスクごとの作業ログ記録
- 作業開始・終了時刻の管理
- 作業内容のマークダウン記録
- 新しい順での表示

### UI/UX
- タブベースのインターフェース
- キーボードショートカット対応（Ctrl/Cmd + Enter）
- レスポンシブデザイン
- 直感的な操作性

## 技術スタック

### バックエンド
- Python
- FastAPI
- SQLite
- SQLAlchemy

### フロントエンド
- Next.js
- TypeScript
- Tailwind CSS
- HeadlessUI

## セットアップ

### バックエンド
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### フロントエンド
```bash
cd frontend
npm install
npm run dev
```

## 開発状況

現在の実装状況：
- ✅ 基本的なタスク管理機能（CRUD）
- ✅ デモ機能
- ✅ 作業ログ機能
- ✅ マークダウン対応
- ✅ キーボードショートカット
- ✅ タスクの自動ソート

今後の実装予定：
- ドラッグアンドドロップでの並び替え
- カテゴリ機能
- 時計/ストップウォッチ機能
- マインドマップ機能
- タスクの統合/分割機能
- プロトタイプ機能
