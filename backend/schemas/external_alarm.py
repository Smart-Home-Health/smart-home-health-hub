from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, TIMESTAMP
from sqlalchemy.orm import relationship
from schemas import Base


class ExternalAlarm(Base):
    __tablename__ = 'external_alarms'
    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey('monitoring_alerts.id'))
    device_id = Column(String, nullable=False)
    pin = Column(Integer, nullable=False)
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True))
    last_activity = Column(TIMESTAMP(timezone=True), nullable=False)
    acknowledged = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    monitoring_alert = relationship('MonitoringAlert', backref='external_alarms')
