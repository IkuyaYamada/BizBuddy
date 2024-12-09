from pydantic import BaseModel, computed_field
from datetime import datetime
from typing import Optional, List
from .task import Task

class MemoBase(BaseModel):
    content: str

class MemoCreate(MemoBase):
    task_ids: List[int] = []

class Memo(MemoBase):
    id: int
    created_at: datetime
    tasks: List[Task] = []

    @computed_field
    @property
    def task_ids(self) -> List[int]:
        return [task.id for task in self.tasks]

    class Config:
        from_attributes = True 