from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.hierarchical_task import HierarchicalTask
from app.schemas.hierarchical_task import HierarchicalTaskCreate, HierarchicalTask as HierarchicalTaskSchema

router = APIRouter()

@router.post("/hierarchical-tasks/", response_model=HierarchicalTaskSchema)
def create_task(task: HierarchicalTaskCreate, db: Session = Depends(get_db)):
    db_task = HierarchicalTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/hierarchical-tasks/", response_model=List[HierarchicalTaskSchema])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(HierarchicalTask).order_by(
        HierarchicalTask.level,
        HierarchicalTask.created_at
    ).all()

@router.get("/hierarchical-tasks/{task_id}", response_model=HierarchicalTaskSchema)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/hierarchical-tasks/{task_id}", response_model=HierarchicalTaskSchema)
def update_task(task_id: int, task: HierarchicalTaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task.model_dump().items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/hierarchical-tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(HierarchicalTask).filter(HierarchicalTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 子タスクも削除
    db.query(HierarchicalTask).filter(HierarchicalTask.parent_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"} 