from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


# Pydantic models for MQTT
class MQTTTopicConfig(BaseModel):
    enabled: bool = True
    broadcast_topic: Optional[str] = None
    listen_topic: Optional[str] = None
    # For nutrition topics which have multiple sub-topics
    water_broadcast_topic: Optional[str] = None
    water_listen_topic: Optional[str] = None
    calories_broadcast_topic: Optional[str] = None
    calories_listen_topic: Optional[str] = None


class MQTTSettings(BaseModel):
    mqtt_enabled: Optional[bool] = None
    mqtt_broker: Optional[str] = Field(None, max_length=255)
    mqtt_port: Optional[int] = Field(None, ge=1, le=65535)
    mqtt_username: Optional[str] = Field(None, max_length=255)
    mqtt_password: Optional[str] = Field(None, max_length=255)
    mqtt_client_id: Optional[str] = Field(None, max_length=255)
    mqtt_discovery_enabled: Optional[bool] = None
    mqtt_test_mode: Optional[bool] = None
    mqtt_base_topic: Optional[str] = Field(None, max_length=255)
    topics: Optional[Dict[str, MQTTTopicConfig]] = None


class MQTTConnectionTest(BaseModel):
    mqtt_broker: str = Field(..., min_length=1, max_length=255)
    mqtt_port: int = Field(default=1883, ge=1, le=65535)
    mqtt_client_id: str = Field(default="test_client", max_length=255)
    mqtt_username: Optional[str] = Field(None, max_length=255)
    mqtt_password: Optional[str] = Field(None, max_length=255)
    
    @validator('mqtt_broker')
    def validate_broker(cls, v):
        if not v or not v.strip():
            raise ValueError('MQTT broker address cannot be empty')
        return v.strip()


class MQTTDiscoveryRequest(BaseModel):
    test_mode: bool = Field(default=True)


class MQTTSettingsResponse(BaseModel):
    mqtt_enabled: Optional[str] = None
    mqtt_broker: Optional[str] = None
    mqtt_port: Optional[str] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None
    mqtt_client_id: Optional[str] = None
    mqtt_discovery_enabled: Optional[str] = None
    mqtt_test_mode: Optional[str] = None
    mqtt_base_topic: Optional[str] = None
    topics: Dict[str, Any] = {}
