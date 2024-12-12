import { getSyncQueue, clearSyncQueue } from './indexedDB';
import * as api from './api';

export const syncTasks = async () => {
  try {
    const queue = await getSyncQueue();
    
    // タイムスタンプでソート
    queue.sort((a, b) => a.timestamp - b.timestamp);

    for (const item of queue) {
      try {
        switch (item.operation) {
          case 'create':
            await api.createHierarchicalTask(item.data);
            break;
          case 'update':
            await api.updateHierarchicalTask(item.data.id, item.data);
            break;
          case 'delete':
            await api.deleteHierarchicalTask(item.data.id);
            break;
        }
      } catch (error) {
        console.error(`Failed to sync operation: ${item.operation}`, error);
        // エラーが発生しても続行
        continue;
      }
    }

    // 同期が完了したらキューをクリア
    await clearSyncQueue();
  } catch (error) {
    console.error('Sync failed:', error);
  }
};

// 定期的な同期処理の開始
export const startPeriodicSync = (intervalMs: number = 5000) => {
  return setInterval(syncTasks, intervalMs);
};

// 画面遷移時の同期処理
export const syncOnVisibilityChange = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncTasks();
    }
  });
}; 