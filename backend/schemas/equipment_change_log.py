from sqlalchemy import Column, Integer, Text, ForeignKey, TIMESTAMP, String
from sqlalchemy.orm import relationship
from schemas import Base


class EquipmentChangeLog(Base):
    __tablename__ = 'equipment_change_log'
    id = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)  # Track which patient the change was for
    changed_at = Column(TIMESTAMP(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)
    changed_by = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Relationships
    equipment = relationship('Equipment', back_populates='change_logs')
    patient = relationship('Patient', foreign_keys=[patient_id])
