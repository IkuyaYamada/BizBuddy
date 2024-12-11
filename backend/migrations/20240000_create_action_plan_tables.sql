-- アクションプランのテーブルを作成

-- サブタスクテーブル
CREATE TABLE IF NOT EXISTS sub_tasks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task
        FOREIGN KEY(task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_sub_tasks_task_id ON sub_tasks(task_id);

-- リーフタスクテーブル
CREATE TABLE IF NOT EXISTS leaf_tasks (
    id SERIAL PRIMARY KEY,
    sub_task_id INTEGER NOT NULL REFERENCES sub_tasks(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_task
        FOREIGN KEY(sub_task_id)
        REFERENCES sub_tasks(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_leaf_tasks_sub_task_id ON leaf_tasks(sub_task_id);

-- アクションアイテムテーブル
CREATE TABLE IF NOT EXISTS action_items (
    id SERIAL PRIMARY KEY,
    leaf_task_id INTEGER NOT NULL REFERENCES leaf_tasks(id) ON DELETE CASCADE,
    content VARCHAR NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leaf_task
        FOREIGN KEY(leaf_task_id)
        REFERENCES leaf_tasks(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_action_items_leaf_task_id ON action_items(leaf_task_id);

-- トリガー関数の作成（updated_atの自動更新用）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_sub_tasks_updated_at
    BEFORE UPDATE ON sub_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaf_tasks_updated_at
    BEFORE UPDATE ON leaf_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_items_updated_at
    BEFORE UPDATE ON action_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 