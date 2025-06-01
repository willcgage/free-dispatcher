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

class Module(Base):
    __tablename__ = "modules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, default=1)
    number_of_endplates = Column(Integer, nullable=False, default=1)
    owner = Column(String, nullable=True)  # New field
    owner_email = Column(String, nullable=True)  # New field
    is_yard = Column(Boolean, nullable=False, default=False)  # New field for Yard
    district = relationship("District")

class ModuleEndplate(Base):
    __tablename__ = "module_endplates"
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    endplate_number = Column(Integer, nullable=False)
    connected_module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)
    module = relationship("Module", foreign_keys=[module_id])
    connected_module = relationship("Module", foreign_keys=[connected_module_id])
    __table_args__ = (
        UniqueConstraint('module_id', 'endplate_number', name='uix_module_endplate'),
    )
