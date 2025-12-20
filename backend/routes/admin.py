"""
Admin-specific routes for multi-patient views
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from db import get_db
from crud.admin import (
    get_all_patients_medication_schedule_for_date,
    get_admin_dashboard_summary
)
from schemas.admin import (
    AllPatientsMedicationSchedule,
    AdminDashboardSummary
)

logger = logging.getLogger("app")

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard/summary", response_model=AdminDashboardSummary)
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Get summary statistics for admin dashboard
    
    Returns patient counts, today's medication/care task stats, and equipment status
    """
    try:
        summary = get_admin_dashboard_summary(db)
        return summary
    except Exception as e:
        logger.error(f"Error getting admin dashboard summary: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error retrieving dashboard summary: {str(e)}"}
        )


@router.get("/medications/schedules/today", response_model=AllPatientsMedicationSchedule)
async def get_all_patients_medications_today(db: Session = Depends(get_db)):
    """
    Get today's medication schedule across all active patients
    
    Returns:
        - date: Today's date
        - patients: List of patients with their scheduled medications
        - total_scheduled: Total medications scheduled for all patients
        - total_completed: Total completed across all patients
        - total_pending: Total pending across all patients
        - total_missed: Total missed across all patients
    """
    try:
        schedule = get_all_patients_medication_schedule_for_date(db)
        return schedule
    except Exception as e:
        logger.error(f"Error getting all patients medication schedule: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error retrieving medication schedule: {str(e)}"}
        )


@router.get("/care-tasks/schedules/today")
async def get_all_patients_care_tasks_today(db: Session = Depends(get_db)):
    """
    Get today's care task schedule across all active patients
    
    NOTE: Currently returns placeholder data. Implementation pending.
    """
    try:
        # TODO: Implement care task aggregation similar to medications
        return {
            'date': datetime.now().date().isoformat(),
            'patients': [],
            'total_scheduled': 0,
            'total_completed': 0,
            'total_pending': 0,
            'total_missed': 0
        }
    except Exception as e:
        logger.error(f"Error getting all patients care task schedule: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error retrieving care task schedule: {str(e)}"}
        )
