"""
Business SQLAlchemy ORM model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP
from sqlalchemy.orm import relationship
from schemas import Base


class Business(Base):
    __tablename__ = 'businesses'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    business_type = Column(String, nullable=False)  # 'hospital', 'pharmacy', 'rehab', 'school', 'therapy', etc.
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    
    # Address information
    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    country = Column(String, nullable=True, default='USA')
    
    # Business details
    description = Column(Text, nullable=True)
    hours_of_operation = Column(Text, nullable=True)  # JSON or text format
    emergency_contact = Column(String, nullable=True)
    
    # Status
    active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Relationships
    providers = relationship('Provider', back_populates='business')
