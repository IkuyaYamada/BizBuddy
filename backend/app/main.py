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
import pytz
from .schemas.action_plan import SubTask, SubTaskCreate, LeafTask, LeafTaskCreate, ActionItem, ActionItemCreate
from .models.action_plan import SubTask as SubTaskModel, LeafTask as LeafTaskModel, ActionItem as ActionItemModel

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
    
    jst = pytz.timezone('Asia/Tokyo')
    db_task.last_updated = datetime.now(jst)
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
    db_memo = MemoModel(
        content=memo.content,
        created_at=datetime.utcnow()
    )
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
    
    # コンテンツが変更された場合のみ時刻を更新
    if db_memo.content != memo.content:
        db_memo.content = memo.content
        db_memo.created_at = datetime.utcnow()
    
    # タスクの関連付けを更新（時刻は更新しない）
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

# アクションプラン関連のエンドポイント
@app.get("/tasks/{task_id}/sub-tasks", response_model=List[SubTask])
def get_sub_tasks(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.sub_tasks

@app.post("/tasks/{task_id}/sub-tasks", response_model=SubTask)
def create_sub_task(task_id: int, sub_task: SubTaskCreate, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_sub_task = SubTaskModel(**sub_task.dict(), task_id=task_id)
    db.add(db_sub_task)
    db.commit()
    db.refresh(db_sub_task)
    return db_sub_task

@app.put("/sub-tasks/{sub_task_id}", response_model=SubTask)
def update_sub_task(sub_task_id: int, sub_task: SubTaskCreate, db: Session = Depends(get_db)):
    db_sub_task = db.query(SubTaskModel).filter(SubTaskModel.id == sub_task_id).first()
    if not db_sub_task:
        raise HTTPException(status_code=404, detail="Sub task not found")

    for key, value in sub_task.dict().items():
        setattr(db_sub_task, key, value)
    db.commit()
    db.refresh(db_sub_task)
    return db_sub_task

@app.delete("/sub-tasks/{sub_task_id}")
def delete_sub_task(sub_task_id: int, db: Session = Depends(get_db)):
    db_sub_task = db.query(SubTaskModel).filter(SubTaskModel.id == sub_task_id).first()
    if not db_sub_task:
        raise HTTPException(status_code=404, detail="Sub task not found")

    db.delete(db_sub_task)
    db.commit()
    return {"message": "Sub task deleted"}

@app.post("/sub-tasks/{sub_task_id}/leaf-tasks", response_model=LeafTask)
def create_leaf_task(sub_task_id: int, leaf_task: LeafTaskCreate, db: Session = Depends(get_db)):
    db_sub_task = db.query(SubTaskModel).filter(SubTaskModel.id == sub_task_id).first()
    if not db_sub_task:
        raise HTTPException(status_code=404, detail="Sub task not found")

    db_leaf_task = LeafTaskModel(**leaf_task.dict(), sub_task_id=sub_task_id)
    db.add(db_leaf_task)
    db.commit()
    db.refresh(db_leaf_task)
    return db_leaf_task

@app.put("/leaf-tasks/{leaf_task_id}", response_model=LeafTask)
def update_leaf_task(leaf_task_id: int, leaf_task: LeafTaskCreate, db: Session = Depends(get_db)):
    db_leaf_task = db.query(LeafTaskModel).filter(LeafTaskModel.id == leaf_task_id).first()
    if not db_leaf_task:
        raise HTTPException(status_code=404, detail="Leaf task not found")

    for key, value in leaf_task.dict().items():
        setattr(db_leaf_task, key, value)
    db.commit()
    db.refresh(db_leaf_task)
    return db_leaf_task

@app.delete("/leaf-tasks/{leaf_task_id}")
def delete_leaf_task(leaf_task_id: int, db: Session = Depends(get_db)):
    db_leaf_task = db.query(LeafTaskModel).filter(LeafTaskModel.id == leaf_task_id).first()
    if not db_leaf_task:
        raise HTTPException(status_code=404, detail="Leaf task not found")

    db.delete(db_leaf_task)
    db.commit()
    return {"message": "Leaf task deleted"}

@app.post("/leaf-tasks/{leaf_task_id}/action-items", response_model=ActionItem)
def create_action_item(leaf_task_id: int, action_item: ActionItemCreate, db: Session = Depends(get_db)):
    db_leaf_task = db.query(LeafTaskModel).filter(LeafTaskModel.id == leaf_task_id).first()
    if not db_leaf_task:
        raise HTTPException(status_code=404, detail="Leaf task not found")

    db_action_item = ActionItemModel(**action_item.dict(), leaf_task_id=leaf_task_id)
    db.add(db_action_item)
    db.commit()
    db.refresh(db_action_item)
    return db_action_item

@app.put("/action-items/{action_item_id}", response_model=ActionItem)
def update_action_item(action_item_id: int, action_item: ActionItemCreate, db: Session = Depends(get_db)):
    db_action_item = db.query(ActionItemModel).filter(ActionItemModel.id == action_item_id).first()
    if not db_action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    for key, value in action_item.dict().items():
        setattr(db_action_item, key, value)
    db.commit()
    db.refresh(db_action_item)
    return db_action_item

@app.delete("/action-items/{action_item_id}")
def delete_action_item(action_item_id: int, db: Session = Depends(get_db)):
    db_action_item = db.query(ActionItemModel).filter(ActionItemModel.id == action_item_id).first()
    if not db_action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    db.delete(db_action_item)
    db.commit()
    return {"message": "Action item deleted"}

@app.get("/action-items/{action_item_id}", response_model=ActionItem)
def get_action_item(action_item_id: int, db: Session = Depends(get_db)):
    action_item = db.query(ActionItemModel).filter(ActionItemModel.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    # 関連するタスク、サブタスク、リーフタスクの情報を取得
    result = {
        "id": action_item.id,
        "content": action_item.content,
        "is_completed": action_item.is_completed,
        "leaf_task_id": action_item.leaf_task_id,
        "created_at": action_item.created_at,
        "updated_at": action_item.updated_at,
        "task_title": action_item.leaf_task.sub_task.task.title if action_item.leaf_task else "",
        "subtask_title": action_item.leaf_task.sub_task.title if action_item.leaf_task else "",
        "leaf_task_title": action_item.leaf_task.title if action_item.leaf_task else ""
    }
    
    return result 