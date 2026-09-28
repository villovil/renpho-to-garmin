# Renpho to Garmin Sync

Automated sync tool for transferring body composition scale measurements from Renpho to Garmin Connect. Supports both local single-user desktop mode and multi-user web deployment on **Vercel**.

## Features

- **Comprehensive Body Composition Sync**: Synchronizes weight, body fat %, muscle mass, hydration, bone mass, BMI, visceral fat, metabolic age, and BMR.
- **Stateless & Private Multi-User Web App**: Users enter their own Renpho and Garmin login details in the browser. Credentials are processed in-memory for the sync request and **never saved on the server disk or database**.
- **Garmin 2FA / MFA Support**: Handles Multi-Factor Authentication codes cleanly.
- **Browser Persistence**: Option to remember credentials in the user's browser `localStorage` with a 1-click **"Clear Saved Credentials"** button.
- **Desktop UI & REST API**: Includes a modern Web Dashboard as well as Python CLI and FastAPI REST API.

---

## ⚡ Deployment to Vercel (Multi-User Host)

1. **Import to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/new).
   - Import your GitHub repository (`blagdon/renpho-to-garmin`).
   - Vercel automatically detects `vercel.json` and builds both the React frontend and Python serverless API.

2. **Deploy**:
   - Click **Deploy**.
   - No environment variables or server database setup required! Users log in directly via the web interface.

---

## 💻 Linux (Ubuntu) Desktop

1. **Clone the repository**:
   ```bash
   git clone https://github.com/blagdon/renpho-to-garmin.git
   cd renpho-to-garmin
   ```

2. **Configure your credentials (Optional)**:
   Copy `config.json.example` to `config.json` and enter your Renpho and Garmin login details for automated local single-user runs:
   ```bash
   cp config.json.example config.json
   ```
   *Note: `config.json` is git-ignored to prevent committing your password.*
   

3. **Setup the Python environment**:
   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv python3-pip git
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

   ```
   
4. **Run the Application**:
   ```bash
   python start_app.py
   ```

---

## 💻 Docker Compose Deployment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/villovil/renpho-to-garmin.git
   cd renpho-to-garmin
   ```

2. **Configure your credentials (Optional)**:
   Copy `config.json.example` to `config.json` and enter your Renpho and Garmin login details for automated local single-user runs:
   ```bash
   cp config.json.example config.json
   ```
   *Note: `config.json` is git-ignored to prevent committing your password.*

3. **Setup the Python environment**:
   ```bash
   docker compose up -d
   ```
   *Note: Point your browser to http://localhost:8000*