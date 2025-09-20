#!/bin/bash

# Smart Home Health Hub - Build Script
# This script automates the deployment process for the SHH system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service names
BACKEND_SERVICE="shh-backend"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if service exists
service_exists() {
    systemctl list-unit-files | grep -q "^$1.service"
}

# Function to check if service is active
service_is_active() {
    systemctl is-active --quiet "$1" 2>/dev/null
}

# Function to create backend service
create_backend_service() {
    local project_root="$1"
    local service_file="/etc/systemd/system/${BACKEND_SERVICE}.service"
    
    print_status "Creating backend service file..."
    
    sudo tee "$service_file" > /dev/null << EOF
[Unit]
Description=Smart Home Health Hub Backend
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=${project_root}/backend
Environment=PATH=${project_root}/.venv/bin
ExecStart=${project_root}/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable "$BACKEND_SERVICE"
    print_success "Backend service created and enabled"
}

# Function to create nginx configuration
create_nginx_config() {
    local project_root="$1"
    local nginx_config="/etc/nginx/sites-available/shh-frontend"
    local nginx_enabled="/etc/nginx/sites-enabled/shh-frontend"
    
    print_status "Creating nginx configuration..."
    
    sudo tee "$nginx_config" > /dev/null << EOF
server {
    listen 80;
    server_name _;

    root ${project_root}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Additional headers for better security and performance
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable the site
    if [ ! -L "$nginx_enabled" ]; then
        sudo ln -sf "$nginx_config" "$nginx_enabled"
        print_success "Nginx site enabled"
    fi
    
    # Test nginx configuration
    if sudo nginx -t; then
        print_success "Nginx configuration is valid"
    else
        print_error "Nginx configuration is invalid"
        return 1
    fi
}

# Function to stop service if running
stop_service_if_running() {
    local service_name="$1"
    if service_exists "$service_name"; then
        if service_is_active "$service_name"; then
            print_status "Stopping $service_name service..."
            sudo systemctl stop "$service_name"
            print_success "$service_name service stopped"
        else
            print_status "$service_name service is not running"
        fi
    fi
}

# Function to start service
start_service() {
    local service_name="$1"
    if service_exists "$service_name"; then
        print_status "Starting $service_name service..."
        sudo systemctl start "$service_name"
        print_success "$service_name service started"
    fi
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists git; then
    print_error "Git is not installed"
    exit 1
fi

if ! command_exists python3; then
    print_error "Python 3 is not installed"
    exit 1
fi

if ! command_exists pip; then
    print_error "Pip is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "NPM is not installed"
    exit 1
fi

if ! command_exists nginx; then
    print_error "Nginx is not installed"
    exit 1
fi

if ! command_exists systemctl; then
    print_error "systemctl is not available - this script requires systemd"
    exit 1
fi

print_success "All prerequisites are available"

# Store the original directory
ORIGINAL_DIR=$(pwd)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_status "Project root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Check and create services if needed
print_status "Checking for existing services..."

if ! service_exists "$BACKEND_SERVICE"; then
    print_warning "Backend service does not exist, creating it..."
    create_backend_service "$PROJECT_ROOT"
else
    print_success "Backend service already exists"
fi

# Setup nginx configuration
print_status "Setting up nginx configuration..."
create_nginx_config "$PROJECT_ROOT"

# Remove old frontend service if it exists
if service_exists "$FRONTEND_SERVICE"; then
    print_warning "Removing old frontend service (nginx will handle frontend now)..."
    stop_service_if_running "$FRONTEND_SERVICE"
    sudo systemctl disable "$FRONTEND_SERVICE"
    sudo rm -f "/etc/systemd/system/${FRONTEND_SERVICE}.service"
    sudo systemctl daemon-reload
    print_success "Old frontend service removed"
fi

# Stop services before build
print_status "Stopping services for build process..."
stop_service_if_running "$BACKEND_SERVICE"

# Step 1: Pull from GitHub
print_status "Pulling latest changes from GitHub..."
if git pull origin $(git branch --show-current); then
    print_success "Successfully pulled latest changes"
else
    print_error "Failed to pull from GitHub"
    exit 1
fi

# Step 2: Backend setup
print_status "Setting up backend..."
cd backend

# Check if virtual environment exists, create if not
if [ ! -d "../.venv" ]; then
    print_status "Creating Python virtual environment..."
    cd ..
    python3 -m venv .venv
    cd backend
    print_success "Virtual environment created"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source ../.venv/bin/activate

# Install/update requirements
print_status "Installing/updating Python requirements..."
if pip install -r requirements.txt; then
    print_success "Python requirements installed"
else
    print_error "Failed to install Python requirements"
    exit 1
fi

# Run Alembic migrations
print_status "Running database migrations..."
if alembic upgrade head; then
    print_success "Database migrations completed"
else
    print_warning "Database migrations may have failed - continuing anyway"
fi

# Step 3: Frontend setup
print_status "Setting up frontend..."
cd ../frontend

# Install npm dependencies
print_status "Installing NPM dependencies..."
if npm install; then
    print_success "NPM dependencies installed"
else
    print_error "Failed to install NPM dependencies"
    exit 1
fi

# Build frontend
print_status "Building frontend..."
if npm run build; then
    print_success "Frontend build completed"
else
    print_error "Frontend build failed"
    exit 1
fi

# Return to original directory
cd "$ORIGINAL_DIR"

# Start services after successful build
print_status "Starting services after successful build..."
start_service "$BACKEND_SERVICE"

# Reload nginx to serve updated frontend
reload_nginx

print_success "Build process completed successfully!"
print_status "Services are now running:"
echo "  - Backend service: $BACKEND_SERVICE"
echo "  - Frontend served by nginx on port 80"
print_status "Service management commands:"
echo "  - Check backend status: sudo systemctl status $BACKEND_SERVICE"
echo "  - Check nginx status: sudo systemctl status nginx"
echo "  - View backend logs: sudo journalctl -u $BACKEND_SERVICE -f"
echo "  - View nginx logs: sudo tail -f /var/log/nginx/access.log"
echo "  - Stop backend: sudo systemctl stop $BACKEND_SERVICE"
echo "  - Start backend: sudo systemctl start $BACKEND_SERVICE"
echo "  - Reload nginx: sudo systemctl reload nginx"
