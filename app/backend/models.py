from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Dispatcher(Base):
    __tablename__ = "dispatchers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    districts = relationship("District", back_populates="dispatcher")

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    dispatcher_id = Column(Integer, ForeignKey("dispatchers.id"))
    dispatcher = relationship("Dispatcher", back_populates="districts")

class Train(Base):
    __tablename__ = "trains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    status = Column(String, default="idle")

class Layout(Base):
    __tablename__ = "layouts"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    location_city = Column(String, nullable=True)
    location_state = Column(String, nullable=True)
    districts = relationship("LayoutDistrict", back_populates="layout")

class LayoutDistrict(Base):
    __tablename__ = "layout_districts"
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id"), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    layout = relationship("Layout", back_populates="districts")
    district = relationship("District")
    modules = relationship("LayoutDistrictModule", back_populates="layout_district")

class LayoutDistrictModule(Base):
    __tablename__ = "layout_district_modules"
    id = Column(Integer, primary_key=True, index=True)
    layout_district_id = Column(Integer, ForeignKey("layout_districts.id"), nullable=False)
    module_key = Column(String, nullable=False)  # Key from online registry
    name = Column(String, nullable=False)
    owner_name = Column(String, nullable=True)
    owner_email = Column(String, nullable=True)
    category = Column(String, nullable=True)
    number_of_endplates = Column(Integer, nullable=True)
    layout_district = relationship("LayoutDistrict", back_populates="modules")
