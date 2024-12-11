from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class HierarchicalTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_completed: bool = False
    parent_id: Optional[int] = None
    level: int = 0
    deadline: Optional[datetime] = None
    priority: Optional[int] = None

class HierarchicalTaskCreate(HierarchicalTaskBase):
    pass

class HierarchicalTask(HierarchicalTaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    children: List['HierarchicalTask'] = []

    class Config:
        from_attributes = True

# 循環参照を解決するために必要
HierarchicalTask.model_rebuild() 