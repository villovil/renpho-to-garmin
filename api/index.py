import os
import sys

# Ensure root workspace directory is in Python path for Vercel Serverless Function
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app

# Vercel serverless entrypoint
app = app
