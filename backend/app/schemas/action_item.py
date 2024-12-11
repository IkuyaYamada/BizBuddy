from pydantic import BaseModel
from typing import Optional

class ActionItemBase(BaseModel):
    content: str
    is_completed: bool = False

class ActionItemCreate(ActionItemBase):
    pass

class ActionItemUpdate(BaseModel):
    content: Optional[str] = None
    is_completed: Optional[bool] = None

class ActionItemResponse(ActionItemBase):
    id: int
    leaf_task_id: int

    class Config:
        orm_mode = True 