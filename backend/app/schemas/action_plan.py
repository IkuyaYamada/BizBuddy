from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ActionItemBase(BaseModel):
    content: str
    is_completed: bool = False

class ActionItemCreate(ActionItemBase):
    pass

class ActionItem(ActionItemBase):
    id: int
    leaf_task_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LeafTaskBase(BaseModel):
    title: str
    description: Optional[str] = None

class LeafTaskCreate(LeafTaskBase):
    pass

class LeafTask(LeafTaskBase):
    id: int
    sub_task_id: int
    action_items: List[ActionItem] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SubTaskBase(BaseModel):
    title: str
    description: Optional[str] = None

class SubTaskCreate(SubTaskBase):
    pass

class SubTask(SubTaskBase):
    id: int
    task_id: int
    leaf_tasks: List[LeafTask] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 