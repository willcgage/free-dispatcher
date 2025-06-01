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
    district_id: int
    number_of_endplates: int = 1
    owner: Optional[str] = None  # New field
    owner_email: Optional[str] = None  # New field

class ModuleCreate(ModuleBase):
    pass

class ModuleRead(ModuleBase):
    id: int
    class Config:
        orm_mode = True

class ModuleEndplateBase(BaseModel):
    module_id: int
    endplate_number: int
    connected_module_id: Optional[int] = None

class ModuleEndplateCreate(ModuleEndplateBase):
    pass

class ModuleEndplateRead(ModuleEndplateBase):
    id: int
    class Config:
        orm_mode = True
