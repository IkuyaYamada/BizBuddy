from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz
from ..database import Base

# JSTタイムゾーンを設定
jst = pytz.timezone('Asia/Tokyo')

def get_jst_now():
    return datetime.now(jst)

# メモとタスクの多対多関係のための中間テーブル
memo_task = Table(
    'memo_task',
    Base.metadata,
    Column('memo_id', Integer, ForeignKey('memos.id')),
    Column('task_id', Integer, ForeignKey('tasks.id'))
)

class Memo(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    created_at = Column(DateTime, default=get_jst_now)

    # リレーションシップ
    tasks = relationship("Task", secondary=memo_task, back_populates="memos")