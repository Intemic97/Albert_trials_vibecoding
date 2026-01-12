@echo off
REM Start Workflow Orchestration Service (Windows)

echo ========================================
echo Starting Workflow Orchestration Service
echo ========================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting API service...
python start_service.py

