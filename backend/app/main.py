from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import List
from .models import Base, Task as TaskModel, Memo as MemoModel, WorkLog as WorkLogModel
from .schemas.task import Task, TaskCreate
from .schemas.memo import Memo, MemoCreate
from .schemas.work_log import WorkLog, WorkLogCreate
from .database import engine, get_db
from datetime import datetime
import logging

# ロガーの設定
logger = logging.getLogger("bizbuddy")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="BizBuddy API")

# CORSの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def validation_exception_handler(request, exc):
    logger.error(f"Error processing request: {exc}")
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({
            "detail": str(exc),
            "body": request.body() if hasattr(request, "body") else None
        })
    )

@app.get("/")
def read_root():
    return {"message": "Welcome to BizBuddy API"}

@app.post("/tasks/", response_model=Task)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    logger.debug(f"Creating task with data: {task.dict()}")
    db_task = TaskModel(
        **task.dict(),
        priority_score=task.priority,
        motivation_score=task.motivation
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=List[Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(TaskModel).offset(skip).limit(limit).all()
    return tasks

@app.get("/tasks/{task_id}", response_model=Task)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task.dict().items():
        setattr(db_task, key, value)
    
    db_task.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

@app.post("/memos/", response_model=Memo)
def create_memo(memo: MemoCreate, db: Session = Depends(get_db)):
    db_memo = MemoModel(content=memo.content)
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo

@app.get("/memos/", response_model=List[Memo])
def read_memos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    memos = db.query(MemoModel).order_by(MemoModel.created_at.desc()).offset(skip).limit(limit).all()
    return memos

@app.get("/memos/{memo_id}", response_model=Memo)
def read_memo(memo_id: int, db: Session = Depends(get_db)):
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if memo is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo

@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, memo: MemoCreate, db: Session = Depends(get_db)):
    print(f"Updating memo {memo_id} with data: {memo.dict()}")  # デバッグ用
    db_memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not db_memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    
    db_memo.content = memo.content
    
    # タスクの関連付けを更新
    if memo.task_ids:
        # 既存のタスクをクリア
        db_memo.tasks = []
        db.flush()
        
        # 新しいタスクを関連付け
        tasks = db.query(TaskModel).filter(TaskModel.id.in_(memo.task_ids)).all()
        print(f"Found tasks: {[t.id for t in tasks]}")  # デバッグ用
        for task in tasks:
            db_memo.tasks.append(task)
    else:
        db_memo.tasks = []
    
    try:
        db.commit()
        db.refresh(db_memo)
        print(f"Updated memo tasks: {[t.id for t in db_memo.tasks]}")  # デバッグ用
        return db_memo
    except Exception as e:
        print(f"Error updating memo: {str(e)}")  # デバッグ用
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memos/{memo_id}")
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    db_memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not db_memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    
    db.delete(db_memo)
    db.commit()
    return {"message": "Memo deleted successfully"}

@app.get("/tasks/{task_id}/memos/", response_model=List[Memo])
def read_task_memos(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.memos

@app.get("/tasks/{task_id}/work-logs/", response_model=List[WorkLog])
def get_work_logs(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.work_logs

@app.post("/tasks/{task_id}/work-logs/", response_model=WorkLog)
def create_work_log(task_id: int, work_log: WorkLogCreate, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_work_log = WorkLogModel(**work_log.dict(), task_id=task_id)
    db.add(db_work_log)
    db.commit()
    db.refresh(db_work_log)
    return db_work_log

@app.put("/tasks/{task_id}/work-logs/{work_log_id}", response_model=WorkLog)
def update_work_log(
    task_id: int,
    work_log_id: int,
    work_log_update: WorkLogCreate,
    db: Session = Depends(get_db)
):
    db_work_log = db.query(WorkLogModel).filter(
        WorkLogModel.id == work_log_id,
        WorkLogModel.task_id == task_id
    ).first()
    
    if not db_work_log:
        raise HTTPException(status_code=404, detail="Work log not found")
    
    for key, value in work_log_update.dict().items():
        setattr(db_work_log, key, value)
    
    db.commit()
    db.refresh(db_work_log)
    return db_work_log

@app.delete("/tasks/{task_id}/work-logs/{work_log_id}")
def delete_work_log(task_id: int, work_log_id: int, db: Session = Depends(get_db)):
    db_work_log = db.query(WorkLogModel).filter(
        WorkLogModel.id == work_log_id,
        WorkLogModel.task_id == task_id
    ).first()
    
    if not db_work_log:
        raise HTTPException(status_code=404, detail="Work log not found")
    
    db.delete(db_work_log)
    db.commit()
    return {"message": "Work log deleted successfully"} 