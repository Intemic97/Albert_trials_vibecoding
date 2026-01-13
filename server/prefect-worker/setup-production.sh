#!/bin/bash

# 🚀 Script de Configuración de Producción para Prefect Worker
# Este script automatiza la configuración del servicio Prefect en producción

set -e  # Exit on error

echo "=================================================="
echo "🚀 Prefect Worker - Production Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}⚠️  This script should NOT be run as root${NC}"
   echo "Please run as your regular user (with sudo privileges)"
   exit 1
fi

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${GREEN}✓${NC} Detected app directory: $APP_DIR"
echo ""

# Step 1: Check Python version
echo "📦 Step 1: Checking Python installation..."
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo -e "${GREEN}✓${NC} Python 3.11 found"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    echo -e "${GREEN}✓${NC} Python 3.10 found"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    if (( $(echo "$PYTHON_VERSION >= 3.10" | bc -l) )); then
        PYTHON_CMD="python3"
        echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION found"
    else
        echo -e "${RED}✗${NC} Python 3.10+ required, found $PYTHON_VERSION"
        echo "Installing Python 3.11..."
        sudo apt update
        sudo apt install -y python3.11 python3.11-venv python3-pip
        PYTHON_CMD="python3.11"
    fi
else
    echo -e "${RED}✗${NC} Python not found. Installing Python 3.11..."
    sudo apt update
    sudo apt install -y python3.11 python3.11-venv python3-pip
    PYTHON_CMD="python3.11"
fi
echo ""

# Step 2: Create virtual environment
echo "📦 Step 2: Setting up virtual environment..."
cd "$SCRIPT_DIR"

if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠${NC}  Virtual environment already exists"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf venv
        $PYTHON_CMD -m venv venv
        echo -e "${GREEN}✓${NC} Virtual environment recreated"
    else
        echo -e "${GREEN}✓${NC} Using existing virtual environment"
    fi
else
    $PYTHON_CMD -m venv venv
    echo -e "${GREEN}✓${NC} Virtual environment created"
fi
echo ""

# Step 3: Install dependencies
echo "📦 Step 3: Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo -e "${GREEN}✓${NC} Dependencies installed"
deactivate
echo ""

# Step 4: Check .env file
echo "📝 Step 4: Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC}  .env file not found"
    echo "Creating .env from template..."
    
    cat > .env << EOF
# API Configuration
API_PORT=8000
API_HOST=0.0.0.0

# Database Path (use absolute path in production)
DATABASE_PATH=$APP_DIR/server/workflow.db

# OpenAI API Key
OPENAI_API_KEY=your_openai_key_here

# Logging
LOG_LEVEL=INFO
EOF
    
    echo -e "${GREEN}✓${NC} .env file created"
    echo -e "${YELLOW}⚠${NC}  IMPORTANT: Edit $SCRIPT_DIR/.env and add your OPENAI_API_KEY"
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi
echo ""

# Step 5: Check Node.js backend .env
echo "📝 Step 5: Checking Node.js backend configuration..."
NODE_ENV="$APP_DIR/server/.env"
if [ -f "$NODE_ENV" ]; then
    if grep -q "PREFECT_SERVICE_URL" "$NODE_ENV"; then
        echo -e "${GREEN}✓${NC} PREFECT_SERVICE_URL already configured"
    else
        echo -e "${YELLOW}⚠${NC}  Adding PREFECT_SERVICE_URL to Node.js .env"
        echo "" >> "$NODE_ENV"
        echo "# Prefect Service URL" >> "$NODE_ENV"
        echo "PREFECT_SERVICE_URL=http://localhost:8000" >> "$NODE_ENV"
        echo -e "${GREEN}✓${NC} PREFECT_SERVICE_URL added"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Node.js .env not found at $NODE_ENV"
fi
echo ""

# Step 6: Create systemd service
echo "🔧 Step 6: Creating systemd service..."
read -p "Do you want to create a systemd service? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    read -p "Enter the user to run the service (default: $USER): " SERVICE_USER
    SERVICE_USER=${SERVICE_USER:-$USER}
    
    SYSTEMD_SERVICE="/tmp/prefect-worker.service"
    cat > "$SYSTEMD_SERVICE" << EOF
[Unit]
Description=Prefect Workflow Worker Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SCRIPT_DIR
Environment="PATH=$SCRIPT_DIR/venv/bin"
ExecStart=$SCRIPT_DIR/venv/bin/python start_service.py
Restart=always
RestartSec=10

# Logging
StandardOutput=append:/var/log/prefect-worker.log
StandardError=append:/var/log/prefect-worker-error.log

[Install]
WantedBy=multi-user.target
EOF
    
    echo "Service file created. Installing with sudo..."
    sudo mv "$SYSTEMD_SERVICE" /etc/systemd/system/prefect-worker.service
    
    # Create log files
    sudo touch /var/log/prefect-worker.log
    sudo touch /var/log/prefect-worker-error.log
    sudo chown $SERVICE_USER:$SERVICE_USER /var/log/prefect-worker*.log
    
    # Reload and enable
    sudo systemctl daemon-reload
    sudo systemctl enable prefect-worker
    
    echo -e "${GREEN}✓${NC} Systemd service created and enabled"
    echo ""
    
    read -p "Do you want to start the service now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        sudo systemctl start prefect-worker
        sleep 2
        sudo systemctl status prefect-worker --no-pager
    fi
else
    echo -e "${YELLOW}⚠${NC}  Skipping systemd service creation"
fi
echo ""

# Step 7: Test the service
echo "🧪 Step 7: Testing the service..."
sleep 2
if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Prefect service is responding!"
    curl -s http://localhost:8000/ | python3 -m json.tool
else
    echo -e "${YELLOW}⚠${NC}  Service not responding yet (it may still be starting)"
    echo "Check logs with: sudo journalctl -u prefect-worker -f"
fi
echo ""

# Summary
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo ""
echo "📝 Next steps:"
echo "  1. Edit .env file and add your OPENAI_API_KEY:"
echo "     nano $SCRIPT_DIR/.env"
echo ""
echo "  2. Restart the service:"
echo "     sudo systemctl restart prefect-worker"
echo ""
echo "  3. Check service status:"
echo "     sudo systemctl status prefect-worker"
echo ""
echo "  4. View logs:"
echo "     sudo journalctl -u prefect-worker -f"
echo ""
echo "  5. Restart your Node.js backend (if using PM2):"
echo "     pm2 restart all"
echo ""
echo "=================================================="

