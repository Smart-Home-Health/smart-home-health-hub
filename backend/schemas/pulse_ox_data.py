from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from schemas import Base


class PulseOxData(Base):
    __tablename__ = 'pulse_ox_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    spo2 = Column(Integer)
    bpm = Column(Integer)
    pa = Column(Float)
    status = Column(String)
    motion = Column(String)
    spo2_alarm = Column(String)
    hr_alarm = Column(String)
    raw_data = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Relationships
    patient = relationship('Patient', back_populates='pulse_ox_data')
