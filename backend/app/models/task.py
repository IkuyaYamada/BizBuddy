from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz
from ..database import Base
from .memo import memo_task

# JSTタイムゾーンを設定
jst = pytz.timezone('Asia/Tokyo')

def get_jst_now():
    return datetime.now(jst)

# タスクとカテゴリの多対多関係のための中間テーブル
task_category = Table(
    'task_category',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id')),
    Column('category_id', Integer, ForeignKey('categories.id'))
)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    motivation = Column(Integer)
    priority = Column(Integer)
    deadline = Column(DateTime, nullable=True)
    estimated_time = Column(Float, nullable=True)
    priority_score = Column(Float)
    motivation_score = Column(Float)
    created_at = Column(DateTime, default=get_jst_now)
    last_updated = Column(DateTime, default=get_jst_now, onupdate=get_jst_now)
    status = Column(String, default="未着手")  # 未着手, 進行中, 完了

    # リレーションシップ
    categories = relationship("Category", secondary=task_category, back_populates="tasks")
    work_logs = relationship("WorkLog", back_populates="task", cascade="all, delete-orphan")
    memos = relationship("Memo", secondary=memo_task, back_populates="tasks")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)  # major, minor, cross
    tasks = relationship("Task", secondary=task_category, back_populates="categories")

class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    description = Column(String)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    
    task = relationship("Task", back_populates="work_logs")