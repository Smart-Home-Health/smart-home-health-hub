from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, TIMESTAMP
from sqlalchemy.orm import relationship
from schemas import Base


class Equipment(Base):
    __tablename__ = 'equipment'
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)  # NULL = shared equipment
    name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    scheduled_replacement = Column(Boolean, nullable=False, default=True)
    last_changed = Column(TIMESTAMP(timezone=True), nullable=True)  # Nullable when scheduled_replacement is False
    useful_days = Column(Integer, nullable=True)  # Nullable when scheduled_replacement is False
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Relationships
    patient = relationship('Patient', foreign_keys=[patient_id])
    change_logs = relationship('EquipmentChangeLog', back_populates='equipment')
