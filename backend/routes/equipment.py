"""
Equipment routes
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentResponse,
    EquipmentChangeLog,
    EquipmentQuantityChange,
    EquipmentChangeHistoryResponse,
    EquipmentCategoryCreate,
    EquipmentCategoryUpdate,
    EquipmentCategoryResponse,
)
from crud.equipment import (
    get_equipment_list, log_equipment_change, receive_equipment, 
    open_equipment, get_equipment_change_history, get_equipment,
    get_equipment_categories, add_equipment, add_equipment_simple, add_equipment_category,
    update_equipment, update_equipment_category, delete_equipment,
    delete_equipment_category, search_equipment, get_equipment_due_count
)

logger = logging.getLogger("app")

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.post("")
async def api_add_equipment(data: EquipmentCreate, db: Session = Depends(get_db)):
    """Add new equipment item."""
    if data.scheduled_replacement and (not data.last_changed or not data.useful_days):
        return JSONResponse(status_code=400, content={"detail": "Last changed and useful days are required for scheduled replacements"})
    
    eid = add_equipment_simple(db, data.name, data.quantity, data.scheduled_replacement, data.last_changed, data.useful_days)
    return {"id": eid, "status": "success"}


@router.get("", response_model=List[dict])
async def api_get_equipment(db: Session = Depends(get_db)):
    """Get equipment list sorted by due next."""
    return get_equipment_list(db)


@router.post("/{equipment_id}/change")
async def api_log_equipment_change(equipment_id: int, data: EquipmentChangeLog, db: Session = Depends(get_db)):
    """Log a change and update last_changed."""
    
    # Check if equipment has scheduled replacement
    from models import Equipment
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        return JSONResponse(status_code=404, content={"detail": "Equipment not found"})
    
    if not equipment.scheduled_replacement:
        return JSONResponse(status_code=400, content={"detail": "Equipment does not have scheduled replacement"})
    
    success = log_equipment_change(db, equipment_id, data.changed_at)
    return {"success": success}


@router.get("/{equipment_id}/history")
async def api_get_equipment_history(equipment_id: int, db: Session = Depends(get_db)):
    """Get change history for equipment."""
    return get_equipment_change_history(db, equipment_id)


@router.post("/{equipment_id}/receive")
async def api_receive_equipment(equipment_id: int, data: EquipmentQuantityChange, db: Session = Depends(get_db)):
    """Increase equipment quantity (receive new stock)."""
    success = receive_equipment(db, equipment_id, data.amount)
    return {"success": success}


@router.post("/{equipment_id}/open")
async def api_open_equipment(equipment_id: int, data: EquipmentQuantityChange, db: Session = Depends(get_db)):
    """Decrease equipment quantity (open/use equipment)."""
    success = open_equipment(db, equipment_id, data.amount)
    return {"success": success}


@router.get("/due/count")
async def api_get_equipment_due_count(db: Session = Depends(get_db)):
    """Get count of equipment items that are due for replacement."""
    return {"count": get_equipment_due_count(db)}
