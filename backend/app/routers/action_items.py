from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.action_item import ActionItem
from ..schemas.action_item import ActionItemCreate, ActionItemUpdate, ActionItemResponse

router = APIRouter()

@router.post("/leaf-tasks/{leaf_task_id}/action-items", response_model=ActionItemResponse)
def create_action_item(
    leaf_task_id: int,
    action_item: ActionItemCreate,
    db: Session = Depends(get_db)
):
    db_action_item = ActionItem(
        content=action_item.content,
        is_completed=False,
        leaf_task_id=leaf_task_id
    )
    db.add(db_action_item)
    db.commit()
    db.refresh(db_action_item)
    return db_action_item

@router.put("/action-items/{action_item_id}", response_model=ActionItemResponse)
def update_action_item(
    action_item_id: int,
    action_item: ActionItemUpdate,
    db: Session = Depends(get_db)
):
    db_action_item = db.query(ActionItem).filter(ActionItem.id == action_item_id).first()
    if not db_action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    for key, value in action_item.dict(exclude_unset=True).items():
        setattr(db_action_item, key, value)
    
    db.commit()
    db.refresh(db_action_item)
    return db_action_item

@router.delete("/action-items/{action_item_id}")
def delete_action_item(
    action_item_id: int,
    db: Session = Depends(get_db)
):
    db_action_item = db.query(ActionItem).filter(ActionItem.id == action_item_id).first()
    if not db_action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    db.delete(db_action_item)
    db.commit()
    return {"message": "Action item deleted"} 