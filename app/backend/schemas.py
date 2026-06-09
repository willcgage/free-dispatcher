from pydantic import BaseModel, field_serializer
from typing import Any, Dict, List, Optional

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

# --- Module Repository integration ---

class RepoModuleRead(BaseModel):
    id: int
    record_number: str
    module_name: str
    category: Optional[str] = None
    geometry_type: Optional[str] = None
    length_feet: Optional[int] = None
    length_inches: Optional[int] = None
    has_mss: Optional[bool] = None
    status: Optional[str] = None
    repo_updated_at: Optional[str] = None
    synced_at: str
    data: Dict[str, Any]  # full parsed JSON blob
    class Config:
        orm_mode = True

class SyncResult(BaseModel):
    synced: int
    updated: int
    synced_at: str

class LayoutModuleAssignmentBase(BaseModel):
    record_number: str
    district_id: Optional[int] = None
    position: int = 0

class LayoutModuleAssignmentCreate(LayoutModuleAssignmentBase):
    pass

class LayoutModuleAssignmentUpdate(BaseModel):
    district_id: Optional[int] = None
    position: Optional[int] = None

class LayoutModuleAssignmentRead(LayoutModuleAssignmentBase):
    id: int
    layout_id: int
    module: Optional[RepoModuleRead] = None
    class Config:
        orm_mode = True
