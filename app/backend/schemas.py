from pydantic import BaseModel, field_serializer
from typing import Optional

class LayoutBase(BaseModel):
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None

class LayoutCreate(LayoutBase):
    pass

class LayoutRead(LayoutBase):
    id: int
    key: Optional[int] = None

    @field_serializer('key', mode='plain')
    def set_key(self, v, info):
        return self.id if self.id is not None else 0
    class Config:
        orm_mode = True

class DistrictBase(BaseModel):
    name: str
    channel_or_frequency: Optional[str] = None
    layout_id: int

class DistrictCreate(DistrictBase):
    pass

class DistrictRead(DistrictBase):
    id: int
    class Config:
        orm_mode = True

class DispatcherBase(BaseModel):
    last_name: str
    first_name: str
    cell_number: Optional[str] = None
    layout_id: Optional[int] = None
    district_id: Optional[int] = None

class DispatcherCreate(DispatcherBase):
    pass

class DispatcherRead(DispatcherBase):
    id: int
    class Config:
        orm_mode = True
