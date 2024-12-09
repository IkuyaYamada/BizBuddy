const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// アクションプラン関連のAPI
export async function getSubTasks(taskId: number) {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/sub-tasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch sub tasks');
  }
  return response.json();
}

export async function createSubTask(taskId: number, data: { title: string; description?: string }) {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/sub-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create sub task');
  }
  return response.json();
}

export async function updateSubTask(subTaskId: number, data: { title: string; description?: string }) {
  const response = await fetch(`${API_BASE_URL}/sub-tasks/${subTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update sub task');
  }
  return response.json();
}

export async function deleteSubTask(subTaskId: number) {
  const response = await fetch(`${API_BASE_URL}/sub-tasks/${subTaskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete sub task');
  }
  return response.json();
}

export async function createLeafTask(subTaskId: number, data: { title: string; description?: string }) {
  const response = await fetch(`${API_BASE_URL}/sub-tasks/${subTaskId}/leaf-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create leaf task');
  }
  return response.json();
}

export async function updateLeafTask(leafTaskId: number, data: { title: string; description?: string }) {
  const response = await fetch(`${API_BASE_URL}/leaf-tasks/${leafTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update leaf task');
  }
  return response.json();
}

export async function deleteLeafTask(leafTaskId: number) {
  const response = await fetch(`${API_BASE_URL}/leaf-tasks/${leafTaskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete leaf task');
  }
  return response.json();
}

export async function createActionItem(leafTaskId: number, data: { content: string; is_completed?: boolean }) {
  const response = await fetch(`${API_BASE_URL}/leaf-tasks/${leafTaskId}/action-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create action item');
  }
  return response.json();
}

export async function updateActionItem(actionItemId: number, data: { content: string; is_completed: boolean }) {
  const response = await fetch(`${API_BASE_URL}/action-items/${actionItemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update action item');
  }
  return response.json();
}

export async function deleteActionItem(actionItemId: number) {
  const response = await fetch(`${API_BASE_URL}/action-items/${actionItemId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete action item');
  }
  return response.json();
} 