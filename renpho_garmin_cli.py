import sys
import argparse
import logging
from sync_manager import SyncManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def main():
    parser = argparse.ArgumentParser(description="Renpho to Garmin Body Composition Sync CLI")
    parser.add_argument("--sync-latest", action="store_true", help="Sync latest unsynced Renpho measurement to Garmin Connect")
    parser.add_argument("--backfill", action="store_true", help="Sync all past unsynced Renpho measurements to Garmin Connect")
    parser.add_argument("--status", action="store_true", help="View sync status and configuration overview")
    parser.add_argument("--config-renpho", nargs=2, metavar=("EMAIL", "PASSWORD"), help="Save Renpho login credentials")
    parser.add_argument("--config-garmin", nargs=2, metavar=("EMAIL", "PASSWORD"), help="Save Garmin login credentials")
    parser.add_argument("--mfa", metavar="CODE", help="Provide Garmin Multi-Factor Authentication (MFA) code")

    args = parser.parse_args()
    manager = SyncManager()

    if args.config_renpho:
        manager.save_config({
            "renpho_email": args.config_renpho[0],
            "renpho_password": args.config_renpho[1]
        })
        print("✔ Renpho credentials updated successfully.")

    if args.config_garmin:
        manager.save_config({
            "garmin_email": args.config_garmin[0],
            "garmin_password": args.config_garmin[1]
        })
        print("✔ Garmin credentials updated successfully.")

    if args.status:
        cfg = manager.load_config()
        history = manager.load_history()
        print("\n--- Renpho to Garmin Sync Status ---")
        print(f"Renpho Account : {cfg.get('renpho_email', 'Not set')}")
        print(f"Garmin Account : {cfg.get('garmin_email', 'Not set')}")
        print(f"Weight Unit    : {cfg.get('weight_unit', 'kg').upper()}")
        print(f"Total Synced   : {len(history.get('synced_ids', {}))} records")
        logs = history.get("logs", [])
        if logs:
            print(f"Last Event     : [{logs[0].get('timestamp')}] {logs[0].get('type')} - {logs[0].get('message')}")
        print("------------------------------------\n")
        return

    if args.sync_latest:
        print("🔄 Checking for latest Renpho measurement...")
        try:
            if args.mfa:
                manager.garmin.login(mfa_code=args.mfa)
            res = manager.sync_latest()
            print(f"\nResult: {res.get('status').upper()}")
            print(f"Message: {res.get('message')}\n")
        except Exception as e:
            print(f"\n❌ Error during sync: {e}\n")
            sys.exit(1)
        return

    if args.backfill:
        print("🔄 Backfilling all unsynced Renpho measurements...")
        try:
            if args.mfa:
                manager.garmin.login(mfa_code=args.mfa)
            res = manager.sync_all_unsynced()
            print(f"\nResult: {res.get('status').upper()}")
            print(f"Summary: {res.get('summary')}\n")
        except Exception as e:
            print(f"\n❌ Error during backfill: {e}\n")
            sys.exit(1)
        return

    if len(sys.argv) == 1:
        parser.print_help()

if __name__ == "__main__":
    main()
