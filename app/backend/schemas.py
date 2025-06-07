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

class LayoutBase(BaseModel):
    key: str
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None

class LayoutCreate(LayoutBase):
    pass

class LayoutRead(LayoutBase):
    id: int
    class Config:
        orm_mode = True

class LayoutDistrictBase(BaseModel):
    layout_id: int
    district_id: int

class LayoutDistrictCreate(LayoutDistrictBase):
    pass

class LayoutDistrictRead(LayoutDistrictBase):
    id: int
    class Config:
        orm_mode = True

class LayoutDistrictModuleBase(BaseModel):
    layout_district_id: int
    module_key: str
    name: str
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    category: Optional[str] = None
    number_of_endplates: Optional[int] = None

class LayoutDistrictModuleCreate(LayoutDistrictModuleBase):
    pass

class LayoutDistrictModuleRead(LayoutDistrictModuleBase):
    id: int
    class Config:
        orm_mode = True
