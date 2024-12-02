from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WorkLogBase(BaseModel):
    description: str
    started_at: datetime
    ended_at: Optional[datetime] = None

class WorkLogCreate(WorkLogBase):
    pass

class WorkLog(WorkLogBase):
    id: int
    task_id: int

    class Config:
        from_attributes = True 