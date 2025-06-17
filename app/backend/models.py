from sqlalchemy import Column, ForeignKey, Integer, String
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
