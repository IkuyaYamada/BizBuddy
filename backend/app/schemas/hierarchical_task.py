from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class HierarchicalTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_completed: bool = False
    level: int = 0
    deadline: Optional[datetime] = None
    priority: Optional[int] = None

class HierarchicalTaskCreate(HierarchicalTaskBase):
    parent_id: Optional[int] = None

class HierarchicalTaskResponse(HierarchicalTaskBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    children: Optional[List["HierarchicalTaskResponse"]] = None

# 循環参照の解決
HierarchicalTaskResponse.model_rebuild() 