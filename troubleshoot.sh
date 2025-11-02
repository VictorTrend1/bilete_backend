#!/bin/bash

echo "🔍 Troubleshooting Site Bilete Backend"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root or with sudo for full diagnostics"
    echo ""
fi

# 1. Check service status
echo "1. Checking service status..."
systemctl status bilete-backend --no-pager -l
echo ""

# 2. Check if image files exist
echo "2. Checking image files..."
cd "$(dirname "$0")"
BACKEND_DIR=$(pwd)

echo "Checking for required image files in: $BACKEND_DIR"
if [ -f "$BACKEND_DIR/BAL+AFTERVIP.png" ]; then
    echo "✅ BAL+AFTERVIP.png exists"
else
    echo "❌ BAL+AFTERVIP.png MISSING"
fi

if [ -f "$BACKEND_DIR/AFTERVIP.png" ]; then
    echo "✅ AFTERVIP.png exists"
else
    echo "❌ AFTERVIP.png MISSING"
fi

if [ -f "$BACKEND_DIR/after.png" ]; then
    echo "✅ after.png exists"
else
    echo "❌ after.png MISSING"
fi

if [ -f "$BACKEND_DIR/model_bilet.jpg" ]; then
    echo "✅ model_bilet.jpg exists"
else
    echo "❌ model_bilet.jpg MISSING"
fi
echo ""

# 3. Check file permissions
echo "3. Checking file permissions..."
ls -la "$BACKEND_DIR"/*.png "$BACKEND_DIR"/*.jpg 2>/dev/null | head -10
echo ""

# 4. Check recent logs
echo "4. Recent service logs (last 30 lines)..."
journalctl -u bilete-backend -n 30 --no-pager
echo ""

# 5. Check if node_modules exist
echo "5. Checking dependencies..."
if [ -d "$BACKEND_DIR/node_modules" ]; then
    echo "✅ node_modules directory exists"
    echo "Checking key packages..."
    if [ -d "$BACKEND_DIR/node_modules/jimp" ]; then
        echo "✅ jimp installed"
    else
        echo "❌ jimp MISSING - run: npm install"
    fi
    if [ -d "$BACKEND_DIR/node_modules/qrcode" ]; then
        echo "✅ qrcode installed"
    else
        echo "❌ qrcode MISSING - run: npm install"
    fi
else
    echo "❌ node_modules MISSING - run: npm install"
fi
echo ""

# 6. Test if server.js can be loaded
echo "6. Testing server.js syntax..."
if node -c "$BACKEND_DIR/server.js" 2>/dev/null; then
    echo "✅ server.js syntax is valid"
else
    echo "❌ server.js has syntax errors"
    node -c "$BACKEND_DIR/server.js"
fi
echo ""

# 7. Check disk space
echo "7. Checking disk space..."
df -h / | tail -1
echo ""

# 8. Recommendations
echo "8. Recommended actions:"
echo ""
echo "If image files are missing:"
echo "  - Upload BAL+AFTERVIP.png and AFTERVIP.png to $BACKEND_DIR"
echo "  - Check file permissions: chmod 644 $BACKEND_DIR/*.png"
echo ""
echo "If service is not running:"
echo "  - systemctl stop bilete-backend"
echo "  - systemctl start bilete-backend"
echo "  - systemctl status bilete-backend"
echo ""
echo "If dependencies are missing:"
echo "  - cd $BACKEND_DIR"
echo "  - npm install"
echo ""
echo "To view live logs:"
echo "  - journalctl -u bilete-backend -f"
echo ""

