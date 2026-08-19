import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Directory for storing persistent garth session tokens
GARTH_HOME = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".garth")

class GarminService:
    def __init__(self, email: str = "", password: str = ""):
        self.email = email
        self.password = password
        self.client = None
        self._is_logged_in = False

    def login(self, email: Optional[str] = None, password: Optional[str] = None, mfa_code: Optional[str] = None) -> bool:
        if email:
            self.email = email
        if password:
            self.password = password

        if not self.email or not self.password:
            raise ValueError("Garmin email and password are required.")

        from garminconnect import Garmin

        os.makedirs(GARTH_HOME, exist_ok=True)

        prompt_func = (lambda: mfa_code) if mfa_code else None

        try:
            # Instantiate Garmin client with credentials & optional MFA prompt lambda
            self.client = Garmin(
                email=self.email, 
                password=self.password, 
                prompt_mfa=prompt_func
            )

            # login(tokenstore=GARTH_HOME) will automatically load cached session tokens if present,
            # or perform fresh authentication and persist tokens into GARTH_HOME.
            self.client.login(tokenstore=GARTH_HOME)
            
            self._is_logged_in = True
            logger.info("Successfully authenticated with Garmin Connect.")
            return True
        except Exception as ex:
            err_msg = str(ex).lower()
            if "mfa" in err_msg or "2fa" in err_msg or "code" in err_msg or "prompt_mfa" in err_msg:
                logger.warning("Garmin MFA/2FA verification required.")
                raise ValueError("MFA_REQUIRED: Multi-factor authentication code needed.")
            else:
                logger.error(f"Garmin Connect login failed: {ex}")
                raise ex

    def push_body_composition(self, measurement: Dict[str, Any], replace_existing: bool = True) -> Dict[str, Any]:
        """
        Pushes a body composition entry to Garmin Connect. If replace_existing is True,
        it first removes any pre-existing weigh-in on Garmin for that date.
        """
        if not self._is_logged_in:
            self.login()

        weight_kg = measurement.get("weight_kg", 0.0)
        if weight_kg <= 0:
            raise ValueError("Weight in kg must be greater than 0.")

        # Timestamp formatting for Garmin API: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
        timestamp_str = measurement.get("timestamp_iso")
        if not timestamp_str and "timestamp_epoch" in measurement:
            timestamp_str = datetime.fromtimestamp(measurement["timestamp_epoch"]).isoformat()
        elif not timestamp_str:
            timestamp_str = datetime.now().isoformat()

        # Format date component
        dt_obj = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        iso_timestamp = dt_obj.strftime("%Y-%m-%dT%H:%M:%S")
        date_str = dt_obj.strftime("%Y-%m-%d")

        # Delete any existing weigh-in on Garmin for this date if replace_existing is requested
        if replace_existing:
            try:
                deleted_count = self.client.delete_weigh_ins(date_str, delete_all=True)
                if deleted_count:
                    logger.info(f"Deleted {deleted_count} existing weigh-in(s) on Garmin for date {date_str} before replacing.")
            except Exception as del_err:
                logger.debug(f"Delete existing weigh-in check on {date_str}: {del_err}")

        # Extract metrics
        percent_fat = measurement.get("percent_fat") or None
        percent_hydration = measurement.get("percent_hydration") or None
        muscle_mass = measurement.get("muscle_mass_kg") or None
        bone_mass = measurement.get("bone_mass_kg") or None
        bmi = measurement.get("bmi") or None
        visceral_fat = measurement.get("visceral_fat") or None
        metabolic_age = measurement.get("metabolic_age") or None
        basal_met = measurement.get("basal_met") or None

        # Clean zero/invalid values to None
        if percent_fat and percent_fat <= 0: percent_fat = None
        if percent_hydration and percent_hydration <= 0: percent_hydration = None
        if muscle_mass and muscle_mass <= 0: muscle_mass = None
        if bone_mass and bone_mass <= 0: bone_mass = None
        if bmi and bmi <= 0: bmi = None
        if visceral_fat and visceral_fat <= 0: visceral_fat = None
        if metabolic_age and metabolic_age <= 0: metabolic_age = None
        if basal_met and basal_met <= 0: basal_met = None

        logger.info(f"Uploading body composition to Garmin Connect: Date={date_str}, Weight={weight_kg}kg, Fat={percent_fat}%, Muscle={muscle_mass}kg")

        try:
            result = self.client.add_body_composition(
                timestamp=iso_timestamp,
                weight=weight_kg,
                percent_fat=percent_fat,
                percent_hydration=percent_hydration,
                muscle_mass=muscle_mass,
                bone_mass=bone_mass,
                bmi=bmi,
                visceral_fat_rating=visceral_fat,
                metabolic_age=metabolic_age,
                basal_met=basal_met
            )
            logger.info(f"Garmin body composition upload result: {result}")
            return {
                "status": "success",
                "timestamp": iso_timestamp,
                "weight_kg": weight_kg,
                "garmin_response": result
            }
        except Exception as ex:
            logger.error(f"Error calling add_body_composition: {ex}")
            raise ex

    def get_body_composition(self, start_date: str, end_date: Optional[str] = None) -> Dict[str, Any]:
        if not self._is_logged_in:
            self.login()
        if not end_date:
            end_date = start_date
        return self.client.get_body_composition(start_date, end_date)
