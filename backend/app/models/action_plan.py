from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime

class SubTask(Base):
    __tablename__ = "sub_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    title = Column(String)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="sub_tasks")
    leaf_tasks = relationship("LeafTask", back_populates="sub_task", cascade="all, delete-orphan")

class LeafTask(Base):
    __tablename__ = "leaf_tasks"

    id = Column(Integer, primary_key=True, index=True)
    sub_task_id = Column(Integer, ForeignKey("sub_tasks.id", ondelete="CASCADE"))
    title = Column(String)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sub_task = relationship("SubTask", back_populates="leaf_tasks")
    action_items = relationship("ActionItem", back_populates="leaf_task", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    leaf_task_id = Column(Integer, ForeignKey("leaf_tasks.id", ondelete="CASCADE"))
    content = Column(String)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leaf_task = relationship("LeafTask", back_populates="action_items") 