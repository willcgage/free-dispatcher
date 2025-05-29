import models
from pydantic import BaseModel
from typing import Optional
import enum

class DispatcherBase(BaseModel):
    name: str

class DispatcherCreate(DispatcherBase):
    pass

class DispatcherRead(DispatcherBase):
    id: int
    class Config:
        orm_mode = True

class DistrictBase(BaseModel):
    name: str
    dispatcher_id: int

class DistrictCreate(DistrictBase):
    pass

class DistrictRead(DistrictBase):
    id: int
    class Config:
        orm_mode = True

class ModuleCategory(str, enum.Enum):
    THROUGH = "Through"
    SIDING = "Siding"
    YARD = "Yard"
    INDUSTRY = "Industry"
    CROSSING_JUNCTION = "Crossing/Junction"
    OTHER = "Other"

class TrainBase(BaseModel):
    name: str
    status: Optional[str] = "idle"

class TrainCreate(TrainBase):
    pass

class TrainRead(TrainBase):
    id: int
    class Config:
        orm_mode = True

class ModuleBase(BaseModel):
    name: str

class ModuleCreate(ModuleBase):
    pass

class ModuleRead(ModuleBase):
    id: int
    class Config:
        orm_mode = True
