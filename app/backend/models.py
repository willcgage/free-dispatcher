from sqlalchemy import Column, Integer, String, ForeignKey
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
    district = relationship("District")
