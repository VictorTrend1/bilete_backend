#!/bin/bash

echo "🖥️ Setting up VNC for WhatsApp Automation on Ubuntu Server..."

# Install VNC server and dependencies
echo "📦 Installing VNC server..."
sudo apt update
sudo apt install -y \
    xfce4 \
    xfce4-goodies \
    tightvncserver \
    chromium-browser \
    firefox

# Create VNC startup script
echo "📝 Creating VNC startup script..."
cat > start-vnc-whatsapp.sh << 'EOF'
#!/bin/bash

# Kill any existing VNC sessions
vncserver -kill :1 2>/dev/null

# Start VNC server
echo "🚀 Starting VNC server on display :1..."
vncserver :1 -geometry 1280x720 -depth 24

# Set display
export DISPLAY=:1

# Start desktop environment
echo "🖥️ Starting desktop environment..."
startxfce4 &

# Wait for desktop to start
sleep 5

echo "✅ VNC server started!"
echo "📱 To connect:"
echo "1. Install VNC viewer on your computer"
echo "2. Connect to: YOUR_SERVER_IP:5901"
echo "3. Password: (set when you first run vncserver)"
echo ""
echo "🤖 To start WhatsApp automation:"
echo "1. Open terminal in VNC"
echo "2. Run: cd /path/to/your/project"
echo "3. Run: NODE_ENV=production node server.js"
echo "4. Scan QR code in the browser window"
EOF

chmod +x start-vnc-whatsapp.sh

# Create WhatsApp automation script
echo "🤖 Creating WhatsApp automation script..."
cat > start-whatsapp-automation.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting WhatsApp Automation with VNC..."

# Set environment variables
export DISPLAY=:1
export NODE_ENV=production

# Start the server
echo "📡 Starting WhatsApp automation server..."
node server.js
EOF

chmod +x start-whatsapp-automation.sh

echo "✅ VNC setup completed!"
echo ""
echo "🚀 To start WhatsApp automation:"
echo "1. Run: ./start-vnc-whatsapp.sh"
echo "2. Connect with VNC viewer to YOUR_SERVER_IP:5901"
echo "3. In VNC, run: ./start-whatsapp-automation.sh"
echo "4. Scan QR code in the browser window"
echo ""
echo "📱 VNC Viewer clients:"
echo "- Windows: RealVNC Viewer, TightVNC Viewer"
echo "- Mac: Built-in Screen Sharing"
echo "- Linux: Remmina, TigerVNC"
echo "- Mobile: VNC Viewer app"
