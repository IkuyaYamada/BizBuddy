import sqlite3
import sys
from pathlib import Path


def confirm_reset():
    print("\n⚠️  警告: この操作は以下のテーブルのデータを完全に削除します:")
    print("- sub_tasks（サブタスク）")
    print("- leaf_tasks（リーフタスク）")
    print("- action_items（アクションアイテム）")
    print("\nメインタスクのデータは保持されます。")
    print("\nこの操作は取り消せません。続行しますか？ [y/N]: ", end="")

    response = input().lower()
    return response in ["y", "yes"]


def reset_hierarchical_tables():
    db_path = Path(__file__).parent.parent / "bizbuddy.db"

    if not db_path.exists():
        print(f"エラー: データベースファイルが見つかりません: {db_path}")
        sys.exit(1)

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # 外部キー制約を有効化
        cursor.execute("PRAGMA foreign_keys = ON")

        # トランザクション開始
        cursor.execute("BEGIN TRANSACTION")

        # テーブルの削除順序を制御（外部キー制約に従う）
        # cursor.execute("DELETE FROM action_items")
        # cursor.execute("DELETE FROM leaf_tasks")
        # cursor.execute("DELETE FROM sub_tasks")
        cursor.execute("DELETE FROM hierarchical_tasks")

        # VACUUMでデータベースを最適化
        cursor.execute("COMMIT")
        cursor.execute("VACUUM")

        print("\n✅ 階層型タスクのテーブルを正常に初期化しました。")

    except sqlite3.Error as e:
        print(f"\n❌ エラーが発生しました: {e}")
        cursor.execute("ROLLBACK")
        sys.exit(1)

    finally:
        conn.close()


if __name__ == "__main__":
    if confirm_reset():
        reset_hierarchical_tables()
    else:
        print("\n操作をキャンセルしました。")
