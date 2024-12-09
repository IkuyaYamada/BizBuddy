from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    is_completed = Column(Boolean, default=False)
    leaf_task_id = Column(Integer, ForeignKey("leaf_tasks.id", ondelete="CASCADE"))

    leaf_task = relationship("LeafTask", back_populates="action_items") 