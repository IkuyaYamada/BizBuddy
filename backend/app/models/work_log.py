from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import pytz
from ..database import Base

# JSTタイムゾーンを設定
jst = pytz.timezone('Asia/Tokyo')

def get_jst_now():
    return datetime.now(jst)

class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    started_at = Column(DateTime)
    created_at = Column(DateTime, default=get_jst_now)
    task_id = Column(Integer, ForeignKey("tasks.id"))

    # リレーションシップ
    task = relationship("Task", back_populates="work_logs") 