import os
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class RenphoMeasurement:
    def __init__(self, raw: Dict[str, Any]):
        self.raw = raw
        
        # Parse timestamp
        ts = raw.get("timeStamp") or raw.get("timestamp") or raw.get("time_stamp") or raw.get("createdAt") or raw.get("localCreatedAt")
        if isinstance(ts, (int, float)):
            # Handle millisecond vs second timestamps
            if ts > 1e11:
                ts = ts / 1000.0
            self.timestamp_epoch = float(ts)
            self.timestamp_iso = datetime.fromtimestamp(self.timestamp_epoch).isoformat()
        elif isinstance(ts, str):
            try:
                cleaned_str = ts.replace("Z", "+00:00")
                if " " in cleaned_str and "T" not in cleaned_str:
                    dt = datetime.strptime(cleaned_str, "%Y-%m-%d %H:%M:%S")
                else:
                    dt = datetime.fromisoformat(cleaned_str)
                self.timestamp_epoch = dt.timestamp()
                self.timestamp_iso = dt.isoformat()
            except Exception:
                self.timestamp_epoch = time.time()
                self.timestamp_iso = datetime.now().isoformat()
        else:
            self.timestamp_epoch = time.time()
            self.timestamp_iso = datetime.now().isoformat()

        # Parse Weight in KG
        weight = raw.get("weight") or raw.get("weight_kg") or raw.get("weight_lbs") or 0.0
        if "weight_lbs" in raw and not ("weight" in raw or "weight_kg" in raw):
            weight = float(weight) * 0.45359237
        self.weight_kg = round(float(weight), 2)
        self.weight_lbs = round(self.weight_kg * 2.20462, 2)

        # Body Fat %
        fat = raw.get("bodyfat") or raw.get("body_fat") or raw.get("fat") or raw.get("subfat") or 0.0
        self.percent_fat = round(float(fat), 2)

        # BMI
        bmi = raw.get("bmi") or 0.0
        self.bmi = round(float(bmi), 2)

        # Muscle Mass (kg or %)
        muscle = raw.get("muscle") or raw.get("muscle_mass") or raw.get("sinew_rate") or raw.get("muscle_kg") or 0.0
        muscle_val = float(muscle)
        if 0.0 < muscle_val <= 100.0 and self.weight_kg > 0:
            self.muscle_mass_kg = round((muscle_val / 100.0) * self.weight_kg, 2)
        else:
            self.muscle_mass_kg = round(muscle_val, 2)

        # Water / Hydration %
        water = raw.get("water") or raw.get("water_rate") or raw.get("hydration") or 0.0
        self.percent_hydration = round(float(water), 2)

        # Bone Mass (kg)
        bone = raw.get("bone") or raw.get("bone_mass") or raw.get("bone_kg") or 0.0
        self.bone_mass_kg = round(float(bone), 2)

        # Visceral Fat Rating
        visceral = raw.get("visfat") or raw.get("visceral_fat") or raw.get("visceral_fat_rating") or raw.get("visceral_fat_sub") or 0.0
        self.visceral_fat = round(float(visceral), 1)

        # Metabolic Age
        met_age = raw.get("bodyage") or raw.get("metabolic_age") or raw.get("body_age") or raw.get("age") or 0
        self.metabolic_age = int(met_age)

        # Basal Metabolic Rate (BMR kcal)
        bmr = raw.get("bmr") or raw.get("basal_met") or raw.get("basal_metabolic_rate") or 0
        self.basal_met = int(bmr)

        # Unique ID for tracking sync status
        self.id = raw.get("id") or f"{int(self.timestamp_epoch)}_{self.weight_kg}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp_epoch": self.timestamp_epoch,
            "timestamp_iso": self.timestamp_iso,
            "weight_kg": self.weight_kg,
            "weight_lbs": self.weight_lbs,
            "percent_fat": self.percent_fat,
            "bmi": self.bmi,
            "muscle_mass_kg": self.muscle_mass_kg,
            "percent_hydration": self.percent_hydration,
            "bone_mass_kg": self.bone_mass_kg,
            "visceral_fat": self.visceral_fat,
            "metabolic_age": self.metabolic_age,
            "basal_met": self.basal_met
        }


class RenphoService:
    def __init__(self, email: str = "", password: str = "", public_key: str = ""):
        self.email = email
        self.password = password
        self.public_key = public_key
        self.client = None
        self._is_logged_in = False

    def login(self, email: Optional[str] = None, password: Optional[str] = None) -> bool:
        if email:
            self.email = email
        if password:
            self.password = password

        if not self.email or not self.password:
            raise ValueError("Renpho email and password are required.")

        # Try using renpho library first
        try:
            from renpho import RenphoClient
            self.client = RenphoClient(self.email, self.password)
            self.client.login()
            self._is_logged_in = True
            logger.info("Successfully logged into Renpho via renpho library.")
            return True
        except ImportError:
            logger.warning("renpho package not found, using fallback REST client.")
            return self._login_fallback()
        except Exception as e:
            logger.error(f"Renpho library login error: {e}. Trying fallback REST client...")
            return self._login_fallback()

    def _login_fallback(self) -> bool:
        import requests
        import hashlib
        
        # Unofficial Renpho mobile API endpoints
        LOGIN_URL = "https://renpho.mainstarcloud.com/api/v3/users/login"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Renpho/2.6.0 (iPhone; iOS 16.0; Scale)",
            "app_id": "Renpho",
            "terminal_type": "2"
        }
        
        # MD5 password hash if needed
        pw_hash = hashlib.md5(self.password.encode('utf-8')).hexdigest()
        
        payload = {
            "email": self.email,
            "password": pw_hash,
            "secure_password": self.password
        }
        
        try:
            resp = requests.post(LOGIN_URL, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == 200 or "terminal_user_session_key" in data:
                    self._session_key = data.get("terminal_user_session_key") or data.get("result", {}).get("session_key")
                    self._user_id = data.get("result", {}).get("user_id")
                    self._is_logged_in = True
                    logger.info("Successfully logged into Renpho via fallback REST API.")
                    return True
                else:
                    raise Exception(f"Renpho login API response error: {data.get('msg', 'Unknown error')}")
            else:
                raise Exception(f"Renpho login HTTP error: status {resp.status_code}")
        except Exception as ex:
            logger.error(f"Fallback Renpho login failed: {ex}")
            raise ex

    def get_measurements(self, limit: int = 100) -> List[RenphoMeasurement]:
        if not self._is_logged_in:
            self.login()

        measurements_raw = []

        if self.client:
            try:
                if hasattr(self.client, "get_all_measurements"):
                    raw = self.client.get_all_measurements()
                    if isinstance(raw, list):
                        measurements_raw = raw
                    elif isinstance(raw, dict) and "weight_list" in raw:
                        measurements_raw = raw["weight_list"]
                elif hasattr(self.client, "get_measurements"):
                    raw = self.client.get_measurements()
                    measurements_raw = raw if isinstance(raw, list) else []
            except Exception as e:
                logger.error(f"Error fetching measurements via renpho library: {e}")

        if not measurements_raw and hasattr(self, "_session_key"):
            # Fetch via fallback REST API
            import requests
            FETCH_URL = "https://renpho.mainstarcloud.com/api/v3/measurements/get_list"
            headers = {
                "User-Agent": "Renpho/2.6.0 (iPhone; iOS 16.0; Scale)",
                "terminal_user_session_key": self._session_key
            }
            params = {"user_id": self._user_id, "limit": limit}
            try:
                resp = requests.get(FETCH_URL, headers=headers, params=params, timeout=15)
                if resp.status_code == 200:
                    res = resp.json()
                    measurements_raw = res.get("result", {}).get("weight_list", []) or res.get("weight_list", [])
            except Exception as ex:
                logger.error(f"Error fetching measurements via fallback REST API: {ex}")

        # Parse & normalize
        results = [RenphoMeasurement(m) for m in measurements_raw]
        # Sort newest first
        results.sort(key=lambda m: m.timestamp_epoch, reverse=True)
        return results[:limit]
