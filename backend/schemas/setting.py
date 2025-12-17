from sqlalchemy import Column, String, Text, TIMESTAMP
from schemas import Base


class Setting(Base):
    __tablename__ = 'settings'
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    data_type = Column(String, nullable=False)
    description = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
