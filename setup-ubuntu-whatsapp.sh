#!/bin/bash

echo "🐧 Setting up WhatsApp Automation for Ubuntu Server..."

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Chromium browser
echo "🌐 Installing Chromium browser..."
sudo apt install chromium-browser -y

# Install X11 dependencies for headless operation
echo "🖥️ Installing X11 dependencies..."
sudo apt install -y \
    xvfb \
    x11vnc \
    fluxbox \
    wmctrl \
    xfonts-100dpi \
    xfonts-75dpi \
    xfonts-scalable \
    xfonts-cyrillic \
    x11-apps \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

# Install additional dependencies
echo "🔧 Installing additional dependencies..."
sudo apt install -y \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2

# Create virtual display script
echo "📺 Creating virtual display script..."
cat > start-virtual-display.sh << 'EOF'
#!/bin/bash
# Start virtual display for WhatsApp automation
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 &
sleep 2
fluxbox &
echo "Virtual display started on :99"
echo "WhatsApp automation can now run in headless mode"
EOF

chmod +x start-virtual-display.sh

# Create environment file
echo "⚙️ Creating environment configuration..."
cat > .env.ubuntu << 'EOF'
# Ubuntu Server Configuration
NODE_ENV=production
CHROME_PATH=/usr/bin/chromium-browser
DISPLAY=:99

# WhatsApp Configuration
WHATSAPP_HEADLESS=true
WHATSAPP_TIMEOUT=120000
WHATSAPP_RETRY_ATTEMPTS=3
EOF

echo "✅ Ubuntu setup completed!"
echo ""
echo "🚀 To start WhatsApp automation:"
echo "1. Run: ./start-virtual-display.sh"
echo "2. Run: NODE_ENV=production node server.js"
echo "3. Access your server and scan QR code"
echo ""
echo "📱 For QR code scanning:"
echo "- Use VNC viewer to connect to your server"
echo "- Or use X11 forwarding: ssh -X user@server"
echo "- Or use a remote desktop solution"
