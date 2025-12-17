from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from schemas import Base


class Vital(Base):
    __tablename__ = 'vitals'
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    vital_type = Column(String, nullable=False)
    vital_group = Column(String, nullable=True)  # Sub-type or grouping (e.g., 'systolic', 'diastolic', 'map' for BP)
    value = Column(Float, nullable=False)
    notes = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Relationships
    patient = relationship('Patient', back_populates='vitals')
