"""
MyArea24 — Vercel Serverless Function Entrypoint
Directly exposes the production FastAPI application to Vercel's Python Serverless Runtime.
"""
import os
import sys

# Ensure repository root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.main import app
