"""
Configuration for Prefect Worker Service
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Service Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))

# Database Configuration
DATABASE_PATH = os.getenv("DATABASE_PATH", "../database.sqlite")

# Prefect Configuration
PREFECT_API_URL = os.getenv("PREFECT_API_URL", "http://127.0.0.1:4200/api")

# External Services
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
CLIMATIQ_API_KEY = os.getenv("CLIMATIQ_API_KEY")

# Email Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

# Paths
BASE_DIR = Path(__file__).parent
FLOWS_DIR = BASE_DIR / "flows"
TASKS_DIR = BASE_DIR / "tasks"

