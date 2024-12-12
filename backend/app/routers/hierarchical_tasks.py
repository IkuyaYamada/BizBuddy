from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import get_db
from app.models.hierarchical_task import HierarchicalTask
from app.schemas.hierarchical_task import (
    HierarchicalTaskResponse,
    HierarchicalTaskCreate
)

router = APIRouter()

@router.post("/hierarchical-tasks/", response_model=HierarchicalTaskResponse)
async def create_hierarchical_task(task: HierarchicalTaskCreate, db: Session = Depends(get_db)):
    # 既存の最大IDを取得
    max_id = db.query(func.max(HierarchicalTask.id)).scalar() or 0
    
    # 階層型タスク用のIDオフセット（例：10000）を追加
    HIERARCHICAL_TASK_ID_OFFSET = 10000
    next_id = max(max_id + 1, HIERARCHICAL_TASK_ID_OFFSET)
    
    # タスクの作成
    db_task = HierarchicalTask(
        id=next_id,
        **task.model_dump(exclude={'id'})
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/hierarchical-tasks/", response_model=List[HierarchicalTaskResponse])
async def get_hierarchical_tasks(db: Session = Depends(get_db)):
    tasks = db.query(HierarchicalTask).all()
    return tasks

@router.get("/hierarchical-tasks/{task_id}", response_model=HierarchicalTaskResponse)
async def get_hierarchical_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/hierarchical-tasks/{task_id}", response_model=HierarchicalTaskResponse)
async def update_hierarchical_task(
    task_id: int,
    task: HierarchicalTaskCreate,
    db: Session = Depends(get_db)
):
    db_task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task.model_dump().items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/hierarchical-tasks/{task_id}")
async def delete_hierarchical_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 子タスクも削除
    db.query(HierarchicalTask).filter(HierarchicalTask.parent_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}