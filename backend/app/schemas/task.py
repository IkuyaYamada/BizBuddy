from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

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

class CategoryBase(BaseModel):
    name: str
    type: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: str
    motivation: int
    priority: int
    deadline: Optional[datetime] = None
    estimated_time: Optional[float] = None
    status: str = "未着手"

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    priority_score: float
    motivation_score: float
    created_at: datetime
    last_updated: datetime
    categories: List[Category] = []
    work_logs: List[WorkLog] = []

    class Config:
        from_attributes = True 