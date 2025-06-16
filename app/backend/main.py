from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import models, schemas
from database import get_db
from typing import List
from database import sync_engine
from models import Base
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import socket
from datetime import datetime
import os
import psutil

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

BACKEND_PORT = int(os.environ.get("BACKEND_PORT", 8000))

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=sync_engine)

@app.get("/layouts/", response_model=List[schemas.LayoutRead])
async def read_layouts(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Layout).offset(skip).limit(limit))
    return result.scalars().all()

@app.get("/layouts/{layout_id}", response_model=schemas.LayoutRead)
async def read_layout(layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Layout).where(models.Layout.id == layout_id))
    layout = result.scalar_one_or_none()
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout

@app.post("/layouts/", response_model=schemas.LayoutRead)
async def create_layout(layout: schemas.LayoutCreate, db: AsyncSession = Depends(get_db)):
    layout_data = layout.dict()
    layout_data.pop("key", None)  # Remove 'key' if present
    db_layout = models.Layout(**layout_data)
    db.add(db_layout)
    await db.commit()
    await db.refresh(db_layout)
    return db_layout

@app.put("/layouts/{layout_id}", response_model=schemas.LayoutRead)
async def update_layout(layout_id: int, layout: schemas.LayoutCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Layout).where(models.Layout.id == layout_id))
    db_layout = result.scalar_one_or_none()
    if db_layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    for key, value in layout.dict().items():
        setattr(db_layout, key, value)
    await db.commit()
    await db.refresh(db_layout)
    return db_layout

@app.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Layout).where(models.Layout.id == layout_id))
    db_layout = result.scalar_one_or_none()
    if db_layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    await db.delete(db_layout)
    await db.commit()
    return {"ok": True}

# Districts CRUD
@app.get("/layouts/{layout_id}/districts", response_model=List[schemas.DistrictRead])
async def read_districts(layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.District).where(models.District.layout_id == layout_id))
    return result.scalars().all()

@app.post("/layouts/{layout_id}/districts", response_model=schemas.DistrictRead)
async def create_district(layout_id: int, district: schemas.DistrictCreate, db: AsyncSession = Depends(get_db)):
    # Remove layout_id from the dict to avoid passing it twice
    district_data = district.dict().copy()
    district_data.pop("layout_id", None)
    db_district = models.District(**district_data, layout_id=layout_id)
    db.add(db_district)
    await db.commit()
    await db.refresh(db_district)
    return db_district

@app.put("/districts/{district_id}", response_model=schemas.DistrictRead)
async def update_district(district_id: int, district: schemas.DistrictCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.District).where(models.District.id == district_id))
    db_district = result.scalar_one_or_none()
    if db_district is None:
        raise HTTPException(status_code=404, detail="District not found")
    for key, value in district.dict().items():
        setattr(db_district, key, value)
    await db.commit()
    await db.refresh(db_district)
    return db_district

@app.delete("/districts/{district_id}")
async def delete_district(district_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.District).where(models.District.id == district_id))
    db_district = result.scalar_one_or_none()
    if db_district is None:
        raise HTTPException(status_code=404, detail="District not found")
    await db.delete(db_district)
    await db.commit()
    return {"ok": True}

# Dispatchers CRUD
@app.get("/dispatchers", response_model=List[schemas.DispatcherRead])
async def read_dispatchers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Dispatcher))
    return result.scalars().all()

@app.post("/dispatchers", response_model=schemas.DispatcherRead)
async def create_dispatcher(dispatcher: schemas.DispatcherCreate, db: AsyncSession = Depends(get_db)):
    db_dispatcher = models.Dispatcher(**dispatcher.dict())
    db.add(db_dispatcher)
    await db.commit()
    await db.refresh(db_dispatcher)
    return db_dispatcher

@app.put("/dispatchers/{dispatcher_id}", response_model=schemas.DispatcherRead)
async def update_dispatcher(dispatcher_id: int, dispatcher: schemas.DispatcherCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id))
    db_dispatcher = result.scalar_one_or_none()
    if db_dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    for key, value in dispatcher.dict().items():
        setattr(db_dispatcher, key, value)
    await db.commit()
    await db.refresh(db_dispatcher)
    return db_dispatcher

@app.delete("/dispatchers/{dispatcher_id}")
async def delete_dispatcher(dispatcher_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id))
    db_dispatcher = result.scalar_one_or_none()
    if db_dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    await db.delete(db_dispatcher)
    await db.commit()
    return {"ok": True}

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = await http_exception_handler(request, exc)
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true"
        }
    )

def get_host_ips():
    # Return all non-loopback IPv4 addresses (including private/local)
    ips = set()
    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                ip = addr.address
                if ip != '0.0.0.0':
                    ips.add(ip)
    # Always include 127.0.0.1 for dev
    ips.add('127.0.0.1')
    # Add HOST_IP from environment if set
    host_ip_env = os.environ.get('HOST_IP')
    if host_ip_env:
        ips.add(host_ip_env)
    return list(ips)

@app.get("/ip", include_in_schema=False)
def get_ip():
    return {"ip": get_host_ips(), "port": BACKEND_PORT}

@app.get("/status", include_in_schema=False)
def get_status():
    return {
        "ip": get_host_ips(),
        "port": BACKEND_PORT,
        "time": datetime.utcnow().isoformat() + "Z",
        "message": "Backend is running.",
        "backend_version": "1.0.0"
    }
