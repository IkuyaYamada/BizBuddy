from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class LeafTask(Base):
    __tablename__ = "leaf_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    sub_task_id = Column(Integer, ForeignKey("sub_tasks.id", ondelete="CASCADE"))

    sub_task = relationship("SubTask", back_populates="leaf_tasks")
    action_items = relationship("ActionItem", back_populates="leaf_task", cascade="all, delete-orphan") 