from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


# Pydantic models for settings moved from routes/settings.py
class SettingIn(BaseModel):
    value: Any
    data_type: str = Field(default="string", pattern="^(string|int|float|bool|json)$")
    description: Optional[str] = None


class SettingUpdate(BaseModel):
    settings: Dict[str, Any] = Field(..., min_items=1)


class SettingResponse(BaseModel):
    key: str
    value: Any


class SettingDeleteResponse(BaseModel):
    status: str
    message: str


class SettingCreateResponse(BaseModel):
    key: str
    value: Any
    status: str


class AllSettingsResponse(BaseModel):
    """Response model for getting all settings"""
    settings: Dict[str, Any]
