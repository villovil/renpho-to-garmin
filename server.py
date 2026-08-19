import os
import logging
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from sync_manager import SyncManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("renpho_garmin_server")

app = FastAPI(title="Renpho to Garmin Sync API", version="1.0.0")

# Enable CORS for local UI development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sync_manager = SyncManager()

class ConfigModel(BaseModel):
    renpho_email: Optional[str] = ""
    renpho_password: Optional[str] = ""
    garmin_email: Optional[str] = ""
    garmin_password: Optional[str] = ""
    weight_unit: Optional[str] = "kg"
    auto_sync: Optional[bool] = False

class TestLoginModel(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None

class SyncSingleModel(BaseModel):
    measurement: Dict[str, Any]

@app.get("/api/config")
def get_config():
    cfg = sync_manager.load_config()
    # Mask passwords for UI security
    return {
        "renpho_email": cfg.get("renpho_email", ""),
        "renpho_password": "●●●●●●●●" if cfg.get("renpho_password") else "",
        "garmin_email": cfg.get("garmin_email", ""),
        "garmin_password": "●●●●●●●●" if cfg.get("garmin_password") else "",
        "weight_unit": cfg.get("weight_unit", "kg"),
        "auto_sync": cfg.get("auto_sync", False),
        "has_renpho_creds": bool(cfg.get("renpho_email") and cfg.get("renpho_password")),
        "has_garmin_creds": bool(cfg.get("garmin_email") and cfg.get("garmin_password"))
    }

@app.post("/api/config")
def save_config(data: ConfigModel):
    existing = sync_manager.load_config()
    update_data = {}
    
    if data.renpho_email is not None:
        update_data["renpho_email"] = data.renpho_email
    if data.renpho_password and data.renpho_password != "●●●●●●●●":
        update_data["renpho_password"] = data.renpho_password
        
    if data.garmin_email is not None:
        update_data["garmin_email"] = data.garmin_email
    if data.garmin_password and data.garmin_password != "●●●●●●●●":
        update_data["garmin_password"] = data.garmin_password

    if data.weight_unit is not None:
        update_data["weight_unit"] = data.weight_unit
    if data.auto_sync is not None:
        update_data["auto_sync"] = data.auto_sync

    saved = sync_manager.save_config(update_data)
    return {"status": "success", "message": "Settings saved successfully."}

@app.post("/api/test-renpho")
def test_renpho(payload: TestLoginModel):
    try:
        from renpho_service import RenphoService
        srv = RenphoService()
        srv.login(payload.email, payload.password)
        measurements = srv.get_measurements(limit=5)
        return {
            "status": "success",
            "message": f"Renpho authentication successful! Fetched {len(measurements)} recent measurements.",
            "sample_measurement": measurements[0].to_dict() if measurements else None
        }
    except Exception as e:
        logger.error(f"Test Renpho error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/test-garmin")
def test_garmin(payload: TestLoginModel):
    try:
        from garmin_service import GarminService
        srv = GarminService()
        srv.login(payload.email, payload.password, mfa_code=payload.mfa_code)
        return {
            "status": "success",
            "message": "Garmin Connect authentication successful!"
        }
    except ValueError as ve:
        if "MFA_REQUIRED" in str(ve):
            return {
                "status": "mfa_required",
                "message": "Multi-factor authentication code required. Please enter the code sent to your email/phone."
            }
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Test Garmin error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/measurements")
def get_measurements(limit: int = 50):
    try:
        measurements = sync_manager.fetch_measurements(limit=limit)
        return {"status": "success", "measurements": measurements}
    except Exception as e:
        logger.error(f"Get measurements error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/latest")
def sync_latest():
    try:
        res = sync_manager.sync_latest()
        return res
    except Exception as e:
        logger.error(f"Sync latest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/batch")
def sync_batch(limit: int = 100):
    try:
        res = sync_manager.sync_all_unsynced(limit=limit)
        return res
    except Exception as e:
        logger.error(f"Sync batch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/single")
def sync_single(payload: SyncSingleModel):
    try:
        sync_manager.initialize_clients()
        m_dict = payload.measurement
        res = sync_manager.garmin.push_body_composition(m_dict)
        
        # Mock measurement object for marking synced
        from renpho_service import RenphoMeasurement
        m_obj = RenphoMeasurement(m_dict)
        sync_manager.mark_synced(m_obj, res)
        
        msg = f"Synced measurement from {m_dict.get('timestamp_iso')} to Garmin Connect."
        sync_manager.log_event("SYNC_SINGLE", msg, {"measurement": m_dict, "result": res})
        return {"status": "success", "message": msg, "result": res}
    except Exception as e:
        logger.error(f"Sync single error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
def get_logs():
    history = sync_manager.load_history()
    return {"status": "success", "logs": history.get("logs", []), "total_synced": len(history.get("synced_ids", {}))}

# Serve frontend build if dist folder exists
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
