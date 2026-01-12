#!/bin/bash
# Start Workflow Orchestration Service (Linux/Mac)

echo "========================================"
echo "Starting Workflow Orchestration Service"
echo "========================================"
echo ""

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Starting API service..."
python start_service.py

