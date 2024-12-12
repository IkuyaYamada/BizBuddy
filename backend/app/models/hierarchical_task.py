from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.database import Base

class HierarchicalTaskBase(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ActionItem(HierarchicalTaskBase):
    leaf_task_id: int
    content: str
    is_completed: bool = False

class LeafTask(HierarchicalTaskBase):
    sub_task_id: int
    action_items: Optional[List[ActionItem]] = None

class SubTask(HierarchicalTaskBase):
    task_id: int
    leaf_tasks: Optional[List[LeafTask]] = None

class HierarchicalTask(HierarchicalTaskBase):
    model_config = ConfigDict(from_attributes=True)
    
    parent_id: Optional[int] = None
    children: Optional[List["HierarchicalTask"]] = None
    sub_tasks: Optional[List[SubTask]] = None

    def dict(self, *args, **kwargs):
        # 循環参照を防ぐためのカスタムdict実装
        data = super().dict(*args, **kwargs)
        if self.children:
            data["children"] = [child.dict(*args, **kwargs) for child in self.children]
        return data 