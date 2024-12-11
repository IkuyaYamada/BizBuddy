from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class HierarchicalTask(Base):
    __tablename__ = "hierarchical_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    parent_id = Column(Integer, ForeignKey("hierarchical_tasks.id"), nullable=True)
    level = Column(Integer, default=0)
    deadline = Column(DateTime, nullable=True)
    priority = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 親子関係
    parent = relationship("HierarchicalTask", remote_side=[id], backref="children") 