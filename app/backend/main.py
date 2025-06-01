from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import shutil
import os
from starlette.responses import JSONResponse, FileResponse
import pkg_resources
import logging
from sqlalchemy import func, select
import socket
from zeroconf import ServiceInfo, Zeroconf
import threading
import time

import models, schemas
from database import engine, SessionLocal

# Configure logging to file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get DB session
async def get_db():
    async with SessionLocal() as session:  # type: ignore
        yield session


@app.on_event("startup")
async def on_startup():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)


@app.get("/")
def read_root():
    return {"message": "Train Dispatcher Backend is running!"}


# CRUD for Dispatchers
@app.post("/dispatchers/", response_model=schemas.DispatcherRead)
async def create_dispatcher(
    dispatcher: schemas.DispatcherCreate, db: AsyncSession = Depends(get_db)
):
    db_dispatcher = models.Dispatcher(name=dispatcher.name)
    db.add(db_dispatcher)
    await db.commit()
    await db.refresh(db_dispatcher)
    return db_dispatcher


@app.get("/dispatchers/", response_model=List[schemas.DispatcherRead])
async def read_dispatchers(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Dispatcher).offset(skip).limit(limit)
    )
    return result.scalars().all()


@app.get("/dispatchers/{dispatcher_id}", response_model=schemas.DispatcherRead)
async def read_dispatcher(dispatcher_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id)
    )
    dispatcher = result.scalar_one_or_none()
    if dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    return dispatcher


@app.put("/dispatchers/{dispatcher_id}", response_model=schemas.DispatcherRead)
async def update_dispatcher(
    dispatcher_id: int,
    dispatcher: schemas.DispatcherCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id)
    )
    db_dispatcher = result.scalar_one_or_none()
    if db_dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    db_dispatcher.name = dispatcher.name  # type: ignore
    await db.commit()
    await db.refresh(db_dispatcher)
    return db_dispatcher


@app.delete("/dispatchers/{dispatcher_id}")
async def delete_dispatcher(dispatcher_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id)
    )
    db_dispatcher = result.scalar_one_or_none()
    if db_dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    await db.delete(db_dispatcher)
    await db.commit()
    return {"ok": True}


# CRUD for Districts
@app.post("/districts/", response_model=schemas.DistrictRead)
async def create_district(
    district: schemas.DistrictCreate, db: AsyncSession = Depends(get_db)
):
    db_district = models.District(
        name=district.name, dispatcher_id=district.dispatcher_id
    )
    db.add(db_district)
    await db.commit()
    await db.refresh(db_district)
    return db_district


@app.get("/districts/", response_model=List[schemas.DistrictRead])
async def read_districts(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.District).offset(skip).limit(limit)
    )
    return result.scalars().all()


@app.get("/districts/{district_id}", response_model=schemas.DistrictRead)
async def read_district(district_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.District).where(models.District.id == district_id)
    )
    district = result.scalar_one_or_none()
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    return district


@app.put("/districts/{district_id}", response_model=schemas.DistrictRead)
async def update_district(
    district_id: int,
    district: schemas.DistrictCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.District).where(models.District.id == district_id)
    )
    db_district = result.scalar_one_or_none()
    if db_district is None:
        raise HTTPException(status_code=404, detail="District not found")
    db_district.name = district.name  # type: ignore
    db_district.dispatcher_id = district.dispatcher_id  # type: ignore
    await db.commit()
    await db.refresh(db_district)
    return db_district


@app.delete("/districts/{district_id}")
async def delete_district(district_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.District).where(models.District.id == district_id)
    )
    db_district = result.scalar_one_or_none()
    if db_district is None:
        raise HTTPException(status_code=404, detail="District not found")
    await db.delete(db_district)
    await db.commit()
    return {"ok": True}


# CRUD for Trains
@app.post("/trains/", response_model=schemas.TrainRead)
async def create_train(train: schemas.TrainCreate, db: AsyncSession = Depends(get_db)):
    db_train = models.Train(name=train.name, status=train.status)
    db.add(db_train)
    await db.commit()
    await db.refresh(db_train)
    return db_train

@app.get("/trains/", response_model=List[schemas.TrainRead])
async def read_trains(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Train).offset(skip).limit(limit))
    return result.scalars().all()

@app.get("/trains/{train_id}", response_model=schemas.TrainRead)
async def read_train(train_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Train).where(models.Train.id == train_id))
    train = result.scalar_one_or_none()
    if train is None:
        raise HTTPException(status_code=404, detail="Train not found")
    return train

@app.put("/trains/{train_id}", response_model=schemas.TrainRead)
async def update_train(train_id: int, train: schemas.TrainCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Train).where(models.Train.id == train_id))
    db_train = result.scalar_one_or_none()
    if db_train is None:
        raise HTTPException(status_code=404, detail="Train not found")
    db_train.name = train.name  # type: ignore
    db_train.status = train.status  # type: ignore
    await db.commit()
    await db.refresh(db_train)
    return db_train

@app.delete("/trains/{train_id}")
async def delete_train(train_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Train).where(models.Train.id == train_id))
    db_train = result.scalar_one_or_none()
    if db_train is None:
        raise HTTPException(status_code=404, detail="Train not found")
    await db.delete(db_train)
    await db.commit()
    return {"ok": True}


# CRUD for Modules
@app.post("/modules/", response_model=schemas.ModuleRead)
async def create_module(module: schemas.ModuleCreate, db: AsyncSession = Depends(get_db)):
    db_module = models.Module(
        name=module.name,
        district_id=module.district_id,
        number_of_endplates=module.number_of_endplates or 1,
        owner=module.owner,
        owner_email=module.owner_email
    )
    db.add(db_module)
    await db.commit()
    await db.refresh(db_module)
    return db_module

@app.get("/modules/", response_model=List[schemas.ModuleRead])
async def read_modules(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Module).offset(skip).limit(limit))
    return result.scalars().all()

@app.get("/modules/{module_id}", response_model=schemas.ModuleRead)
async def read_module(module_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Module).where(models.Module.id == module_id))
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    return module

@app.put("/modules/{module_id}", response_model=schemas.ModuleRead)
async def update_module(module_id: int, module: schemas.ModuleCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Module).where(models.Module.id == module_id))
    db_module = result.scalar_one_or_none()
    if db_module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    db_module.name = module.name  # type: ignore
    db_module.district_id = module.district_id  # type: ignore
    db_module.number_of_endplates = module.number_of_endplates or 1  # type: ignore
    db_module.owner = module.owner  # type: ignore
    db_module.owner_email = module.owner_email  # type: ignore
    await db.commit()
    await db.refresh(db_module)
    return db_module

@app.delete("/modules/{module_id}")
async def delete_module(module_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Module).where(models.Module.id == module_id))
    db_module = result.scalar_one_or_none()
    if db_module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    await db.delete(db_module)
    await db.commit()
    return {"ok": True}


# CRUD for ModuleEndplates
@app.post("/module_endplates/", response_model=schemas.ModuleEndplateRead)
async def create_module_endplate(endplate: schemas.ModuleEndplateCreate, db: AsyncSession = Depends(get_db)):
    db_endplate = models.ModuleEndplate(
        module_id=endplate.module_id,
        endplate_number=endplate.endplate_number,
        connected_module_id=endplate.connected_module_id
    )
    db.add(db_endplate)
    await db.commit()
    await db.refresh(db_endplate)
    return db_endplate

@app.get("/module_endplates/", response_model=List[schemas.ModuleEndplateRead])
async def read_module_endplates(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ModuleEndplate).offset(skip).limit(limit))
    return result.scalars().all()

@app.get("/module_endplates/{endplate_id}", response_model=schemas.ModuleEndplateRead)
async def read_module_endplate(endplate_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ModuleEndplate).where(models.ModuleEndplate.id == endplate_id))
    endplate = result.scalar_one_or_none()
    if endplate is None:
        raise HTTPException(status_code=404, detail="ModuleEndplate not found")
    return endplate

@app.put("/module_endplates/{endplate_id}", response_model=schemas.ModuleEndplateRead)
async def update_module_endplate(endplate_id: int, endplate: schemas.ModuleEndplateCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ModuleEndplate).where(models.ModuleEndplate.id == endplate_id))
    db_endplate = result.scalar_one_or_none()
    if db_endplate is None:
        raise HTTPException(status_code=404, detail="ModuleEndplate not found")
    setattr(db_endplate, "module_id", endplate.module_id)
    setattr(db_endplate, "endplate_number", endplate.endplate_number)
    setattr(db_endplate, "connected_module_id", endplate.connected_module_id)
    await db.commit()
    await db.refresh(db_endplate)
    return db_endplate

@app.delete("/module_endplates/{endplate_id}")
async def delete_module_endplate(endplate_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ModuleEndplate).where(models.ModuleEndplate.id == endplate_id))
    db_endplate = result.scalar_one_or_none()
    if db_endplate is None:
        raise HTTPException(status_code=404, detail="ModuleEndplate not found")
    await db.delete(db_endplate)
    await db.commit()
    return {"ok": True}


DB_PATH = os.getenv("DB_PATH", "/var/lib/postgresql/data/dispatcher_db")


@app.post("/admin/import-db/")
async def import_db(file: UploadFile = File(...)):
    # Save uploaded file to DB_PATH (overwrite existing DB)
    try:
        with open(DB_PATH, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"ok": True, "message": "Database imported."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})


@app.post("/admin/create-db/")
async def create_db():
    # Drop and recreate all tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.drop_all)
            await conn.run_sync(models.Base.metadata.create_all)
        return {"ok": True, "message": "Database created/reset."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})


@app.get("/admin/export-db/")
async def export_db():
    # Return the database file for download
    try:
        return FileResponse(DB_PATH, filename="dispatcher_db_export", media_type="application/octet-stream")
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})


@app.post("/admin/cleanup-orphans/")
async def cleanup_orphans(db: AsyncSession = Depends(get_db)):
    # Delete districts with no valid dispatcher
    await db.execute(
        models.District.__table__.delete().where(~models.District.dispatcher_id.in_(
            select(models.Dispatcher.id)
        ))
    )
    await db.commit()
    return {"ok": True, "message": "Orphan districts cleaned up."}


@app.get("/admin/orphan-records/")
async def get_orphan_records(db: AsyncSession = Depends(get_db)):
    # Find orphan districts (no valid dispatcher or dispatcher_id is NULL)
    orphan_districts = (await db.execute(
        select(models.District).where(
            (models.District.dispatcher_id == None) |
            (~models.District.dispatcher_id.in_(select(models.Dispatcher.id)))
        )
    )).scalars().all()
    return {
        "orphan_districts": [
            {"id": d.id, "name": d.name, "dispatcher_id": d.dispatcher_id} for d in orphan_districts
        ],
        "orphan_modules": []  # No modules table
    }


@app.post("/admin/delete-orphans/")
async def delete_orphans(payload: dict, db: AsyncSession = Depends(get_db)):
    district_ids = payload.get("district_ids", [])
    if district_ids:
        await db.execute(models.District.__table__.delete().where(models.District.id.in_(district_ids)))
    await db.commit()
    return {"ok": True, "message": "Selected orphan districts deleted."}


@app.get("/status")
async def status(db: AsyncSession = Depends(get_db)):
    # Get backend version
    try:
        version = pkg_resources.get_distribution("fastapi").version
    except Exception:
        version = "unknown"
    # Get counts for each table
    async def get_count(model):
        result = await db.execute(select(func.count(model.id)))
        return result.scalar()
    dispatcher_count = await get_count(models.Dispatcher)
    district_count = await get_count(models.District)
    train_count = await get_count(models.Train)
    module_count = await get_count(models.Module)
    # Get counts for ModuleEndplates (newly added)
    endplate_count = await get_count(models.ModuleEndplate)
    counts = {
        "dispatchers": dispatcher_count,
        "districts": district_count,
        "trains": train_count,
        "modules": module_count,
        "module_endplates": endplate_count,  # Include endplate count
    }
    # Get recent logs (if using logging to file)
    logs = []
    try:
        with open("backend.log") as f:
            logs = f.readlines()[-20:]
    except Exception:
        logs = ["No log file found."]
    return {
        "backend_version": version,
        "service_counts": counts,
        "logs": logs,
        "message": "Train Dispatcher Backend is running!"
    }


@app.get("/ip")
def get_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        s.connect(('10.255.255.255', 1))
        local_ip = s.getsockname()[0]
    except Exception:
        local_ip = '127.0.0.1'
    finally:
        s.close()
    return {"ip": local_ip}


@app.on_event("startup")
def register_mdns_service():
    try:
        # Get the local IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        try:
            # doesn't have to be reachable
            s.connect(('10.255.255.255', 1))
            local_ip = s.getsockname()[0]
        except Exception:
            local_ip = '127.0.0.1'
        finally:
            s.close()

        info = ServiceInfo(
            "_http._tcp.local.",
            "TrainDispatcher._http._tcp.local.",
            addresses=[socket.inet_aton(local_ip)],
            port=8000,  # The internal container port
            properties={},
            server="train-dispatcher.local."
        )
        app.state.zeroconf = Zeroconf()
        app.state.zeroconf.register_service(info)
        logging.info(f"mDNS/ZeroConf service registered at {local_ip}:8000")
    except Exception as e:
        logging.error(f"Failed to register mDNS/ZeroConf service: {e}")


@app.on_event("shutdown")
def unregister_mdns_service():
    try:
        if hasattr(app.state, 'zeroconf'):
            app.state.zeroconf.close()
            logging.info("mDNS/ZeroConf service unregistered.")
    except Exception as e:
        logging.error(f"Failed to unregister mDNS/ZeroConf service: {e}")


# Orphan record checker state
orphan_check_interval = 60  # seconds, default
orphan_check_thread = None
orphan_check_stop = threading.Event()

# Store last orphan check results
last_orphan_check = {"orphan_districts": [], "last_run": None}

def orphan_check_worker():
    global last_orphan_check
    while not orphan_check_stop.is_set():
        try:
            with SessionLocal() as session:
                # Find orphan districts
                orphan_districts = session.execute(
                    select(models.District).where(
                        (models.District.dispatcher_id == None) |
                        (~models.District.dispatcher_id.in_(select(models.Dispatcher.id)))
                    )
                ).scalars().all()
                last_orphan_check = {
                    "orphan_districts": [
                        {"id": d.id, "name": d.name, "dispatcher_id": d.dispatcher_id} for d in orphan_districts
                    ],
                    "last_run": time.time(),
                }
        except Exception as e:
            last_orphan_check = {"error": str(e), "last_run": time.time()}
        orphan_check_stop.wait(orphan_check_interval)

@app.on_event("startup")
def start_orphan_check_thread():
    global orphan_check_thread
    orphan_check_stop.clear()
    orphan_check_thread = threading.Thread(target=orphan_check_worker, daemon=True)
    orphan_check_thread.start()

@app.on_event("shutdown")
def stop_orphan_check_thread():
    orphan_check_stop.set()
    if orphan_check_thread:
        orphan_check_thread.join()

@app.get("/admin/orphan-check-interval/")
def get_orphan_check_interval():
    return {"interval": orphan_check_interval}

@app.post("/admin/orphan-check-interval/")
def set_orphan_check_interval(payload: dict):
    global orphan_check_interval
    interval = payload.get("interval")
    if not isinstance(interval, int) or interval < 10:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Interval must be an integer >= 10 seconds."})
    orphan_check_interval = interval
    return {"ok": True, "interval": orphan_check_interval}

@app.get("/admin/last-orphan-check/")
def get_last_orphan_check():
    return last_orphan_check
