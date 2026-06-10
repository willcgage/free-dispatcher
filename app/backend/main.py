from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import models, schemas
from database import get_db, sync_engine, Base
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import socket
from datetime import datetime, timezone
import os
import json
import psutil
import httpx

# Module Repository connection config — defaults to local Supabase dev instance.
# Override with env vars for production:
#   MODULEREPO_URL=https://dpifxkipqfaxujidgjyg.supabase.co
#   MODULEREPO_ANON_KEY=<production anon key>
MODULEREPO_URL = os.environ.get(
    "MODULEREPO_URL", "http://127.0.0.1:54321"
)
MODULEREPO_ANON_KEY = os.environ.get(
    "MODULEREPO_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9"
    ".CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
)

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
    print("=== DISPATCHER UPDATE ENDPOINT CALLED")  # Debug log
    result = await db.execute(select(models.Dispatcher).where(models.Dispatcher.id == dispatcher_id))
    db_dispatcher = result.scalar_one_or_none()
    if db_dispatcher is None:
        raise HTTPException(status_code=404, detail="Dispatcher not found")
    for key, value in dispatcher.dict().items():
        setattr(db_dispatcher, key, value)
    await db.commit()
    await db.refresh(db_dispatcher)
    print("Updated dispatcher DB object:", db_dispatcher.__dict__)  # Debug log
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

# ---------------------------------------------------------------------------
# Module Repository integration — sync + read
# ---------------------------------------------------------------------------

@app.post("/modules/sync", response_model=schemas.SyncResult)
async def sync_modules(db: AsyncSession = Depends(get_db)):
    """Fetch the full module catalog from the Module Repository and cache it locally."""
    endpoint = f"{MODULEREPO_URL}/functions/v1/modules-full"
    headers = {
        "apikey": MODULEREPO_ANON_KEY,
        "Authorization": f"Bearer {MODULEREPO_ANON_KEY}",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(endpoint, headers=headers)
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Cannot reach Module Repository — is local Supabase running (supabase start)?")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Module Repository timed out")
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Module Repository returned {resp.status_code}: {resp.text[:200]}",
        )
    modules_data = resp.json()
    synced_at = datetime.now(timezone.utc).isoformat()
    synced_count = 0
    updated_count = 0

    for m in modules_data:
        record_number = m.get("record_number")
        if not record_number:
            continue
        result = await db.execute(
            select(models.RepoModule).where(models.RepoModule.record_number == record_number)
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            db.add(models.RepoModule(
                record_number=record_number,
                module_name=m.get("module_name", ""),
                category=m.get("category"),
                geometry_type=m.get("geometry_type"),
                length_feet=m.get("length_feet"),
                length_inches=m.get("length_inches"),
                has_mss=1 if m.get("has_mss") else 0,
                status=m.get("status"),
                repo_updated_at=m.get("updated_at"),
                synced_at=synced_at,
                data=json.dumps(m),
            ))
            synced_count += 1
        else:
            existing.module_name = m.get("module_name", "")
            existing.category = m.get("category")
            existing.geometry_type = m.get("geometry_type")
            existing.length_feet = m.get("length_feet")
            existing.length_inches = m.get("length_inches")
            existing.has_mss = 1 if m.get("has_mss") else 0
            existing.status = m.get("status")
            existing.repo_updated_at = m.get("updated_at")
            existing.synced_at = synced_at
            existing.data = json.dumps(m)
            updated_count += 1

    await db.commit()
    return schemas.SyncResult(synced=synced_count, updated=updated_count, synced_at=synced_at)


@app.get("/modules/", response_model=List[schemas.RepoModuleRead])
async def list_modules(db: AsyncSession = Depends(get_db)):
    """Return all cached modules from the last sync."""
    result = await db.execute(
        select(models.RepoModule).order_by(models.RepoModule.record_number)
    )
    rows = result.scalars().all()
    out = []
    for row in rows:
        d = {
            "id": row.id,
            "record_number": row.record_number,
            "module_name": row.module_name,
            "category": row.category,
            "geometry_type": row.geometry_type,
            "length_feet": row.length_feet,
            "length_inches": row.length_inches,
            "has_mss": bool(row.has_mss),
            "status": row.status,
            "repo_updated_at": row.repo_updated_at,
            "synced_at": row.synced_at,
            "data": json.loads(row.data),
        }
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Layout module assignments
# ---------------------------------------------------------------------------

@app.get("/layouts/{layout_id}/module-assignments", response_model=List[schemas.LayoutModuleAssignmentRead])
async def list_module_assignments(layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.LayoutModuleAssignment)
        .where(models.LayoutModuleAssignment.layout_id == layout_id)
        .order_by(models.LayoutModuleAssignment.position, models.LayoutModuleAssignment.id)
    )
    assignments = result.scalars().all()
    out = []
    for a in assignments:
        mod_result = await db.execute(
            select(models.RepoModule).where(models.RepoModule.record_number == a.record_number)
        )
        mod_row = mod_result.scalar_one_or_none()
        mod = None
        if mod_row:
            mod = {
                "id": mod_row.id,
                "record_number": mod_row.record_number,
                "module_name": mod_row.module_name,
                "category": mod_row.category,
                "geometry_type": mod_row.geometry_type,
                "length_feet": mod_row.length_feet,
                "length_inches": mod_row.length_inches,
                "has_mss": bool(mod_row.has_mss),
                "status": mod_row.status,
                "repo_updated_at": mod_row.repo_updated_at,
                "synced_at": mod_row.synced_at,
                "data": json.loads(mod_row.data),
            }
        out.append({
            "id": a.id,
            "layout_id": a.layout_id,
            "district_id": a.district_id,
            "record_number": a.record_number,
            "position": a.position,
            "module": mod,
        })
    return out


@app.post("/layouts/{layout_id}/module-assignments", response_model=schemas.LayoutModuleAssignmentRead)
async def create_module_assignment(
    layout_id: int,
    body: schemas.LayoutModuleAssignmentCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify the module exists in local cache
    mod_result = await db.execute(
        select(models.RepoModule).where(models.RepoModule.record_number == body.record_number)
    )
    if mod_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Module not found in local cache — run sync first")
    db.add(models.LayoutModuleAssignment(
        layout_id=layout_id,
        district_id=body.district_id,
        record_number=body.record_number,
        position=body.position,
    ))
    await db.commit()
    # Re-read with module data via the list endpoint logic
    result = await db.execute(
        select(models.LayoutModuleAssignment)
        .where(models.LayoutModuleAssignment.layout_id == layout_id)
        .where(models.LayoutModuleAssignment.record_number == body.record_number)
    )
    a = result.scalar_one()
    mod_result2 = await db.execute(
        select(models.RepoModule).where(models.RepoModule.record_number == a.record_number)
    )
    mod_row = mod_result2.scalar_one()
    return {
        "id": a.id, "layout_id": a.layout_id, "district_id": a.district_id,
        "record_number": a.record_number, "position": a.position,
        "module": {
            "id": mod_row.id, "record_number": mod_row.record_number,
            "module_name": mod_row.module_name, "category": mod_row.category,
            "geometry_type": mod_row.geometry_type, "length_feet": mod_row.length_feet,
            "length_inches": mod_row.length_inches, "has_mss": bool(mod_row.has_mss),
            "status": mod_row.status, "repo_updated_at": mod_row.repo_updated_at,
            "synced_at": mod_row.synced_at, "data": json.loads(mod_row.data),
        },
    }


@app.put("/layouts/{layout_id}/module-assignments/{assignment_id}", response_model=schemas.LayoutModuleAssignmentRead)
async def update_module_assignment(
    layout_id: int,
    assignment_id: int,
    body: schemas.LayoutModuleAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.LayoutModuleAssignment)
        .where(models.LayoutModuleAssignment.id == assignment_id)
        .where(models.LayoutModuleAssignment.layout_id == layout_id)
    )
    a = result.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if body.district_id is not None or "district_id" in body.model_fields_set:
        a.district_id = body.district_id
    if body.position is not None:
        a.position = body.position
    await db.commit()
    await db.refresh(a)
    mod_result = await db.execute(
        select(models.RepoModule).where(models.RepoModule.record_number == a.record_number)
    )
    mod_row = mod_result.scalar_one()
    return {
        "id": a.id, "layout_id": a.layout_id, "district_id": a.district_id,
        "record_number": a.record_number, "position": a.position,
        "module": {
            "id": mod_row.id, "record_number": mod_row.record_number,
            "module_name": mod_row.module_name, "category": mod_row.category,
            "geometry_type": mod_row.geometry_type, "length_feet": mod_row.length_feet,
            "length_inches": mod_row.length_inches, "has_mss": bool(mod_row.has_mss),
            "status": mod_row.status, "repo_updated_at": mod_row.repo_updated_at,
            "synced_at": mod_row.synced_at, "data": json.loads(mod_row.data),
        },
    }


@app.delete("/layouts/{layout_id}/module-assignments/{assignment_id}")
async def delete_module_assignment(
    layout_id: int,
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.LayoutModuleAssignment)
        .where(models.LayoutModuleAssignment.id == assignment_id)
        .where(models.LayoutModuleAssignment.layout_id == layout_id)
    )
    a = result.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(a)
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
        "backend_version": "0.7.0"
    }

@app.get("/schema")
async def get_schema():
    # Reflect the database schema
    Base.metadata.reflect(bind=sync_engine)
    tables = []
    relationships = []

    for table_name, table in Base.metadata.tables.items():
        fields = [col.name for col in table.columns]
        tables.append({"name": table_name, "fields": fields})

        # Find foreign keys for relationships
        for col in table.columns:
            for fk in col.foreign_keys:
                relationships.append({
                    "from": table_name,
                    "to": fk.column.table.name,
                    "field": col.name
                })

    return {
        "tables": tables,
        "relationships": relationships
    }
