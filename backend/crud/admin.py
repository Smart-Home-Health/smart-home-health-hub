"""
Admin-specific CRUD operations for multi-patient views
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from schemas.patient import Patient
from schemas.medication_schedule import MedicationSchedule
from schemas.medication_log import MedicationLog
from crud.medications import get_daily_medication_schedule
from crud.patients import get_patients

logger = logging.getLogger('crud')


def get_all_patients_medication_schedule_for_date(db: Session, target_date=None):
    """
    Get medication schedule for all active patients for a specific date (defaults to today)
    
    Returns:
        Dict with date, patients list, and aggregate totals
    """
    try:
        if target_date is None:
            target_date = datetime.now().date()
        
        # Get all active patients
        patients = get_patients(db, active_only=True, limit=1000)
        
        patients_data = []
        total_scheduled = 0
        total_completed = 0
        total_pending = 0
        total_missed = 0
        
        for patient in patients:
            # Get today's schedule for this patient
            patient_schedule = get_daily_medication_schedule(db, patient_id=patient.id)
            
            # Filter to just today's items (not yesterday's)
            today_items = [
                item for item in patient_schedule.get('scheduled_medications', [])
                if item.get('scheduled_time') and 
                datetime.fromisoformat(item['scheduled_time'].replace('Z', '+00:00')).date() == target_date
            ]
            
            # Calculate patient-specific stats
            patient_total = len(today_items)
            patient_completed = len([item for item in today_items if item.get('is_completed')])
            patient_missed = len([item for item in today_items if item.get('status') == 'missed'])
            patient_pending = len([item for item in today_items if item.get('status') == 'pending'])
            
            # Count "due soon" (within next 2 hours)
            current_time = datetime.now()
            patient_due_soon = 0
            for item in today_items:
                if item.get('status') == 'pending':
                    scheduled_time = datetime.fromisoformat(item['scheduled_time'].replace('Z', '+00:00'))
                    if scheduled_time.tzinfo is not None:
                        scheduled_time = scheduled_time.replace(tzinfo=None)
                    time_diff = (scheduled_time - current_time).total_seconds() / 60
                    if 0 <= time_diff <= 120:  # Within next 2 hours
                        patient_due_soon += 1
            
            patients_data.append({
                'patient_id': patient.id,
                'patient_name': f"{patient.first_name} {patient.last_name}",
                'scheduled_medications': today_items,
                'total_scheduled': patient_total,
                'total_completed': patient_completed,
                'total_pending': patient_pending,
                'total_missed': patient_missed,
                'total_due_soon': patient_due_soon
            })
            
            # Update aggregate totals
            total_scheduled += patient_total
            total_completed += patient_completed
            total_pending += patient_pending
            total_missed += patient_missed
        
        return {
            'date': target_date.isoformat(),
            'patients': patients_data,
            'total_scheduled': total_scheduled,
            'total_completed': total_completed,
            'total_pending': total_pending,
            'total_missed': total_missed
        }
    
    except Exception as e:
        logger.error(f"Error getting all patients medication schedule: {e}")
        return {
            'date': target_date.isoformat() if target_date else datetime.now().date().isoformat(),
            'patients': [],
            'total_scheduled': 0,
            'total_completed': 0,
            'total_pending': 0,
            'total_missed': 0
        }


def get_admin_dashboard_summary(db: Session):
    """
    Get summary statistics for admin dashboard
    
    Returns:
        Dict with patient counts, medication stats, care task stats, and equipment stats
    """
    try:
        # Get patient counts
        total_patients = db.query(func.count(Patient.id)).scalar()
        active_patients = db.query(func.count(Patient.id)).filter(Patient.is_active == True).scalar()
        
        # Get today's medication schedule for all patients
        med_schedule = get_all_patients_medication_schedule_for_date(db)
        
        # For now, return zeros for care tasks and equipment (as requested)
        # These will be implemented later
        
        return {
            'patients': {
                'total': total_patients or 0,
                'active': active_patients or 0,
                'inactive': (total_patients or 0) - (active_patients or 0)
            },
            'medications': {
                'due_today': med_schedule.get('total_scheduled', 0),
                'completed_today': med_schedule.get('total_completed', 0),
                'missed_today': med_schedule.get('total_missed', 0),
                'overdue': med_schedule.get('total_missed', 0)  # Same as missed for now
            },
            'care_tasks': {
                'due_today': 0,
                'completed_today': 0,
                'missed_today': 0,
                'overdue': 0
            },
            'equipment': {
                'total': 0,
                'due_for_change': 0,
                'ok': 0
            },
            'recent_activity': []  # TODO: Implement recent activity feed
        }
    
    except Exception as e:
        logger.error(f"Error getting admin dashboard summary: {e}")
        return {
            'patients': {'total': 0, 'active': 0, 'inactive': 0},
            'medications': {'due_today': 0, 'completed_today': 0, 'missed_today': 0, 'overdue': 0},
            'care_tasks': {'due_today': 0, 'completed_today': 0, 'missed_today': 0, 'overdue': 0},
            'equipment': {'total': 0, 'due_for_change': 0, 'ok': 0},
            'recent_activity': []
        }
