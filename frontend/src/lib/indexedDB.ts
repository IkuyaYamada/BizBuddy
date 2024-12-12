import { HierarchicalTask } from '@/types/hierarchicalTask';

const DB_NAME = 'bizbuddy-db';
const DB_VERSION = 1;
const TASKS_STORE = 'tasks';
const SYNC_QUEUE_STORE = 'sync-queue';

interface SyncQueueItem {
  id: number;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // タスクストア
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const taskStore = db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        taskStore.createIndex('parent_id', 'parent_id', { unique: false });
      }

      // 同期キューストア
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// DBへの接続を取得
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// タスクの取得
export const getTasks = async (): Promise<HierarchicalTask[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TASKS_STORE, 'readonly');
    const store = transaction.objectStore(TASKS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// タスクの保存
export const saveTask = async (task: HierarchicalTask): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TASKS_STORE, 'readwrite');
    const store = transaction.objectStore(TASKS_STORE);
    const request = store.put(task);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // 同期キューに追加
      const syncTransaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
      const syncStore = syncTransaction.objectStore(SYNC_QUEUE_STORE);
      syncStore.add({
        operation: task.id < 0 ? 'create' : 'update',
        data: task,
        timestamp: Date.now()
      });
      resolve();
    };
  });
};

// タスクの削除
export const deleteTask = async (taskId: number): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TASKS_STORE, 'readwrite');
    const store = transaction.objectStore(TASKS_STORE);
    const request = store.delete(taskId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // 同期キューに追加
      const syncTransaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
      const syncStore = syncTransaction.objectStore(SYNC_QUEUE_STORE);
      syncStore.add({
        operation: 'delete',
        data: { id: taskId },
        timestamp: Date.now()
      });
      resolve();
    };
  });
};

// 同期キューの取得
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 同期キューのクリア
export const clearSyncQueue = async (): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}; 