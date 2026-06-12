from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Layout(Base):
    __tablename__ = "layouts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    location_city = Column(String, nullable=True)
    location_state = Column(String, nullable=True)

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    channel_or_frequency = Column(String, nullable=True)
    layout_id = Column(Integer, ForeignKey("layouts.id"), nullable=False)

class Dispatcher(Base):
    __tablename__ = "dispatchers"
    id = Column(Integer, primary_key=True, index=True)
    last_name = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    cell_number = Column(String, nullable=True)
    layout_id = Column(Integer, ForeignKey("layouts.id"), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

class RepoModule(Base):
    """Cached snapshot of a module from the Module Repository API."""
    __tablename__ = "repo_modules"
    id = Column(Integer, primary_key=True, index=True)
    record_number = Column(String, nullable=False, unique=True, index=True)
    module_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    geometry_type = Column(String, nullable=True)
    length_feet = Column(Integer, nullable=True)
    length_inches = Column(Integer, nullable=True)
    has_mss = Column(Integer, nullable=True)  # stored as 0/1
    status = Column(String, nullable=True)
    repo_updated_at = Column(String, nullable=True)
    synced_at = Column(String, nullable=False)
    data = Column(Text, nullable=False)  # full JSON blob from modules/full

class LayoutModuleAssignment(Base):
    """Associates a Module Repository module with a Layout (and optionally a District)."""
    __tablename__ = "layout_module_assignments"
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id"), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    record_number = Column(String, ForeignKey("repo_modules.record_number"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint("layout_id", "record_number", name="uq_layout_module"),)
