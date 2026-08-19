import os
import sys
import webbrowser
import subprocess
import time

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    print("==================================================")
    print("  🚀 Renpho to Garmin Weight & Body Data Sync App  ")
    print("==================================================")
    print("Starting backend web server at http://localhost:8000 ...")

    # Open browser automatically after 2 seconds
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Launch uvicorn server
    cmd = [venv_python, "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
    try:
        subprocess.run(cmd, cwd=base_dir)
    except KeyboardInterrupt:
        print("\nApp stopped by user.")

if __name__ == "__main__":
    main()
