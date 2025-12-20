"""
Pydantic models for Admin API responses
"""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class PatientMedicationStatus(BaseModel):
    """Medication status summary for a single patient"""
    patient_id: int
    patient_name: str
    scheduled_medications: List[dict]
    total_scheduled: int
    total_completed: int
    total_pending: int
    total_missed: int
    total_due_soon: int


class AllPatientsMedicationSchedule(BaseModel):
    """Today's medication schedule across all patients"""
    date: str
    patients: List[PatientMedicationStatus]
    total_scheduled: int
    total_completed: int
    total_pending: int
    total_missed: int


class AdminDashboardSummary(BaseModel):
    """Summary statistics for admin dashboard"""
    patients: dict  # {total, active, inactive}
    medications: dict  # {due_today, completed_today, missed_today, overdue}
    care_tasks: dict  # {due_today, completed_today, missed_today, overdue}
    equipment: dict  # {total, due_for_change, ok}
    recent_activity: Optional[List[dict]] = None
