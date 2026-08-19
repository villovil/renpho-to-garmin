import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from renpho_service import RenphoService, RenphoMeasurement
from garmin_service import GarminService

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
HISTORY_FILE = os.path.join(BASE_DIR, "sync_history.json")

class SyncManager:
    def __init__(self):
        self.config = self.load_config()
        self.history = self.load_history()
        self.renpho = RenphoService()
        self.garmin = GarminService()

    def load_config(self) -> Dict[str, Any]:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load config.json: {e}")
        return {
            "renpho_email": "",
            "renpho_password": "",
            "garmin_email": "",
            "garmin_password": "",
            "weight_unit": "kg",  # 'kg' or 'lbs'
            "auto_sync": False
        }

    def save_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        self.config.update(new_config)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2)
        logger.info("Saved configuration to config.json.")
        return self.config

    def load_history(self) -> Dict[str, Any]:
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load sync_history.json: {e}")
        return {"synced_ids": {}, "logs": []}

    def save_history(self):
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(self.history, f, indent=2)

    def log_event(self, event_type: str, message: str, details: Optional[Dict[str, Any]] = None):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "message": message,
            "details": details or {}
        }
        self.history["logs"].insert(0, entry)
        # Keep last 200 logs
        self.history["logs"] = self.history["logs"][:200]
        self.save_history()

    def is_synced(self, measurement: RenphoMeasurement) -> bool:
        # Check by measurement ID or exact date + weight combination
        mid = measurement.id
        if mid in self.history["synced_ids"]:
            return True
        date_key = measurement.timestamp_iso[:10]
        weight_key = f"{date_key}_{measurement.weight_kg}"
        if weight_key in self.history["synced_ids"]:
            return True
        return False

    def mark_synced(self, measurement: RenphoMeasurement, garmin_res: Dict[str, Any]):
        mid = measurement.id
        date_key = measurement.timestamp_iso[:10]
        weight_key = f"{date_key}_{measurement.weight_kg}"
        
        sync_record = {
            "synced_at": datetime.now().isoformat(),
            "measurement_id": mid,
            "timestamp_iso": measurement.timestamp_iso,
            "weight_kg": measurement.weight_kg,
            "percent_fat": measurement.percent_fat,
            "muscle_mass_kg": measurement.muscle_mass_kg,
            "garmin_response": garmin_res
        }
        
        self.history["synced_ids"][mid] = sync_record
        self.history["synced_ids"][weight_key] = sync_record
        self.save_history()

    def initialize_clients(self, mfa_code: Optional[str] = None):
        renpho_email = self.config.get("renpho_email")
        renpho_pw = self.config.get("renpho_password")
        garmin_email = self.config.get("garmin_email")
        garmin_pw = self.config.get("garmin_password")

        if not renpho_email or not renpho_pw:
            raise ValueError("Renpho credentials missing in configuration.")
        if not garmin_email or not garmin_pw:
            raise ValueError("Garmin credentials missing in configuration.")

        # Authenticate Renpho
        self.renpho.login(renpho_email, renpho_pw)
        # Authenticate Garmin
        self.garmin.login(garmin_email, garmin_pw, mfa_code=mfa_code)

    def fetch_measurements(self, limit: int = 50) -> List[Dict[str, Any]]:
        self.initialize_clients()
        measurements = self.renpho.get_measurements(limit=limit)
        results = []
        for m in measurements:
            m_dict = m.to_dict()
            m_dict["synced"] = self.is_synced(m)
            results.append(m_dict)
        return results

    def sync_latest(self) -> Dict[str, Any]:
        self.initialize_clients()
        measurements = self.renpho.get_measurements(limit=10)
        if not measurements:
            msg = "No Renpho measurements found to sync."
            self.log_event("SYNC_SKIP", msg)
            return {"status": "skipped", "message": msg}

        latest = measurements[0]
        if self.is_synced(latest):
            msg = f"Latest measurement from {latest.timestamp_iso} ({latest.weight_kg} kg) is already synced."
            self.log_event("SYNC_SKIP", msg, {"measurement": latest.to_dict()})
            return {"status": "skipped", "message": msg, "measurement": latest.to_dict()}

        # Push to Garmin
        m_dict = latest.to_dict()
        res = self.garmin.push_body_composition(m_dict)
        self.mark_synced(latest, res)
        
        msg = f"Successfully synced Renpho measurement ({latest.weight_kg} kg, Fat: {latest.percent_fat}%, Muscle: {latest.muscle_mass_kg} kg) to Garmin Connect."
        self.log_event("SYNC_SUCCESS", msg, {"measurement": m_dict, "garmin_result": res})
        return {"status": "success", "message": msg, "measurement": m_dict, "result": res}

    def sync_all_unsynced(self, limit: int = 100) -> Dict[str, Any]:
        self.initialize_clients()
        measurements = self.renpho.get_measurements(limit=limit)
        synced_count = 0
        skipped_count = 0
        failed_count = 0
        details = []

        # Process oldest first so chronological order is maintained
        measurements.reverse()

        for m in measurements:
            if self.is_synced(m):
                skipped_count += 1
                continue
            
            try:
                m_dict = m.to_dict()
                res = self.garmin.push_body_composition(m_dict)
                self.mark_synced(m, res)
                synced_count += 1
                details.append({"timestamp": m.timestamp_iso, "weight_kg": m.weight_kg, "status": "success"})
            except Exception as ex:
                failed_count += 1
                details.append({"timestamp": m.timestamp_iso, "weight_kg": m.weight_kg, "status": "failed", "error": str(ex)})

        msg = f"Batch sync completed: {synced_count} synced, {skipped_count} skipped, {failed_count} failed."
        self.log_event("BATCH_SYNC", msg, {"synced": synced_count, "skipped": skipped_count, "failed": failed_count})
        return {
            "status": "completed",
            "summary": msg,
            "synced_count": synced_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "details": details
        }
