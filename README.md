# Renpho to Garmin Sync

Automated sync tool for transferring body composition scale measurements from Renpho to Garmin Connect.

## Features

- Synchronizes weight, body fat %, muscle mass, hydration, bone mass, BMI, visceral fat, metabolic age, and BMR.
- Web UI and REST API for setup, manual sync, batch sync, and viewing history.
- Garmin MFA (2-factor authentication) support with session token caching via Garth.

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd "Renpho to Garmin"
   ```

2. **Configure your credentials**:
   Copy `config.json.example` to `config.json` and enter your Renpho and Garmin login details:
   ```bash
   cp config.json.example config.json
   ```
   *Note: `config.json` is git-ignored to prevent committing your password.*

3. **Run the Application**:
   ```bash
   python start_app.py
   ```
   Or run `run_app.bat` on Windows.
