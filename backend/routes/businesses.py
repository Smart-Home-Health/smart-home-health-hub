from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from db import get_db
from crud.businesses import (
    get_business, get_businesses, get_businesses_by_type, create_business, 
    update_business, delete_business, activate_business, search_businesses, get_business_types
)

router = APIRouter(prefix="/api/businesses", tags=["businesses"])

# Pydantic models for request/response
class BusinessBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    business_type: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    zip_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field("USA", max_length=100)
    description: Optional[str] = None
    hours_of_operation: Optional[str] = None
    emergency_contact: Optional[str] = Field(None, max_length=100)
    active: bool = True

class BusinessCreate(BusinessBase):
    pass

class BusinessUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    business_type: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    zip_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    hours_of_operation: Optional[str] = None
    emergency_contact: Optional[str] = Field(None, max_length=100)
    active: Optional[bool] = None

class BusinessResponse(BusinessBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[BusinessResponse])
def list_businesses(
    active_only: bool = Query(True, description="Filter to active businesses only"),
    business_type: Optional[str] = Query(None, description="Filter by business type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all businesses with optional filtering."""
    if business_type:
        return get_businesses_by_type(db, business_type, active_only)
    return get_businesses(db, skip=skip, limit=limit, active_only=active_only)

@router.get("/types", response_model=List[str])
def list_business_types(db: Session = Depends(get_db)):
    """Get all unique business types."""
    return get_business_types(db)

@router.get("/search", response_model=List[BusinessResponse])
def search_businesses_endpoint(
    q: str = Query(..., min_length=1, description="Search term"),
    active_only: bool = Query(True, description="Filter to active businesses only"),
    db: Session = Depends(get_db)
):
    """Search businesses by name, type, or city."""
    return search_businesses(db, q, active_only)

@router.get("/{business_id}", response_model=BusinessResponse)
def get_business_by_id(business_id: int, db: Session = Depends(get_db)):
    """Get a specific business by ID."""
    business = get_business(db, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business

@router.post("/", response_model=BusinessResponse)
def create_business_endpoint(business: BusinessCreate, db: Session = Depends(get_db)):
    """Create a new business."""
    try:
        return create_business(db, business.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creating business: {str(e)}")

@router.put("/{business_id}", response_model=BusinessResponse)
def update_business_endpoint(
    business_id: int, 
    business: BusinessUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing business."""
    # Filter out None values
    update_data = {k: v for k, v in business.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    updated_business = update_business(db, business_id, update_data)
    if not updated_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    return updated_business

@router.delete("/{business_id}")
def delete_business_endpoint(business_id: int, db: Session = Depends(get_db)):
    """Soft delete a business (sets active to False)."""
    success = delete_business(db, business_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business deactivated successfully"}

@router.post("/{business_id}/activate")
def activate_business_endpoint(business_id: int, db: Session = Depends(get_db)):
    """Reactivate a business."""
    success = activate_business(db, business_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business activated successfully"}
