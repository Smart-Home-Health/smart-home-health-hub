from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


# Pydantic models for nutrition moved from routes/nutrition.py
class NutritionIntakeCreate(BaseModel):
    care_task_log_id: Optional[int] = None
    item_name: str = Field(..., min_length=1, max_length=200)
    item_type: str = Field(..., pattern="^(food|liquid|supplement)$")
    amount: float = Field(..., gt=0)
    amount_unit: str = Field(..., min_length=1, max_length=50)
    calories: Optional[float] = Field(None, ge=0)
    protein_grams: Optional[float] = Field(None, ge=0)
    carbs_grams: Optional[float] = Field(None, ge=0)
    fat_grams: Optional[float] = Field(None, ge=0)
    fiber_grams: Optional[float] = Field(None, ge=0)
    sodium_mg: Optional[float] = Field(None, ge=0)
    consumed_at: Optional[datetime] = None
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack|supplement)$")
    notes: Optional[str] = None
    recorded_by: Optional[str] = None


class NutritionIntakeUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=1, max_length=200)
    item_type: Optional[str] = Field(None, pattern="^(food|liquid|supplement)$")
    amount: Optional[float] = Field(None, gt=0)
    amount_unit: Optional[str] = Field(None, min_length=1, max_length=50)
    calories: Optional[float] = Field(None, ge=0)
    protein_grams: Optional[float] = Field(None, ge=0)
    carbs_grams: Optional[float] = Field(None, ge=0)
    fat_grams: Optional[float] = Field(None, ge=0)
    fiber_grams: Optional[float] = Field(None, ge=0)
    sodium_mg: Optional[float] = Field(None, ge=0)
    consumed_at: Optional[datetime] = None
    meal_type: Optional[str] = Field(None, pattern="^(breakfast|lunch|dinner|snack|supplement)$")
    notes: Optional[str] = None
    recorded_by: Optional[str] = None


class NutritionIntakeResponse(BaseModel):
    id: int
    patient_id: int
    care_task_log_id: Optional[int]
    item_name: str
    item_type: str
    amount: float
    amount_unit: str
    calories: Optional[float]
    protein_grams: Optional[float]
    carbs_grams: Optional[float]
    fat_grams: Optional[float]
    fiber_grams: Optional[float]
    sodium_mg: Optional[float]
    consumed_at: datetime
    meal_type: Optional[str]
    notes: Optional[str]
    recorded_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
