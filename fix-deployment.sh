#!/bin/bash

echo "🔧 Fixing Site Bilete Backend Deployment"
echo "========================================"
echo ""

# Get the backend directory
cd "$(dirname "$0")"
BACKEND_DIR=$(pwd)

echo "Working in: $BACKEND_DIR"
echo ""

# 1. Stop the service
echo "1. Stopping service..."
systemctl stop bilete-backend
echo "✅ Service stopped"
echo ""

# 2. Install/update dependencies
echo "2. Installing dependencies..."
cd "$BACKEND_DIR"
npm install
echo "✅ Dependencies installed"
echo ""

# 3. Check for image files
echo "3. Checking image files..."
MISSING_FILES=0

if [ ! -f "$BACKEND_DIR/BAL+AFTERVIP.png" ]; then
    echo "⚠️  WARNING: BAL+AFTERVIP.png is missing"
    MISSING_FILES=1
fi

if [ ! -f "$BACKEND_DIR/AFTERVIP.png" ]; then
    echo "⚠️  WARNING: AFTERVIP.png is missing"
    MISSING_FILES=1
fi

if [ $MISSING_FILES -eq 1 ]; then
    echo ""
    echo "❌ Some image files are missing. Please upload them to: $BACKEND_DIR"
    echo "   Required files:"
    echo "   - BAL+AFTERVIP.png"
    echo "   - AFTERVIP.png"
    echo ""
else
    echo "✅ All image files present"
fi
echo ""

# 4. Fix file permissions
echo "4. Fixing file permissions..."
if [ -w "$BACKEND_DIR" ]; then
    chmod 644 "$BACKEND_DIR"/*.png 2>/dev/null
    chmod 644 "$BACKEND_DIR"/*.jpg 2>/dev/null
    chmod 644 "$BACKEND_DIR"/server.js 2>/dev/null
    echo "✅ Permissions set"
else
    echo "⚠️  Cannot set permissions (run with sudo)"
fi
echo ""

# 5. Reload systemd and start service
echo "5. Reloading systemd and starting service..."
systemctl daemon-reload
systemctl start bilete-backend
sleep 2
echo ""

# 6. Check status
echo "6. Service status:"
systemctl status bilete-backend --no-pager -l
echo ""

# 7. Show recent logs
echo "7. Recent logs:"
journalctl -u bilete-backend -n 20 --no-pager
echo ""

echo "✅ Fix script completed!"
echo ""
echo "If the service is still not working, check the logs:"
echo "  journalctl -u bilete-backend -f"

