#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🤖 Installing WhatsApp Bot Dependencies...\n');

// Check if we're in the backend directory
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: Please run this script from the backend directory');
    process.exit(1);
}

// Dependencies to install
const dependencies = [
    'whatsapp-web.js@^1.23.0',
    'qrcode-terminal@^0.12.0',
    'node-cron@^3.0.2',
    'axios@^1.5.0'
];

console.log('📦 Installing dependencies...\n');

try {
    // Install dependencies
    for (const dep of dependencies) {
        console.log(`Installing ${dep}...`);
        execSync(`npm install ${dep}`, { stdio: 'inherit' });
    }
    
    console.log('\n✅ All dependencies installed successfully!');
    
    // Create temp directory for bot files
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('📁 Created temp directory for bot files');
    }
    
    // Create sessions directory for WhatsApp sessions
    const sessionsDir = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
        console.log('📁 Created sessions directory for WhatsApp sessions');
    }
    
    console.log('\n🎉 Bot setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Check the console for QR code');
    console.log('3. Scan QR code with WhatsApp');
    console.log('4. Access /bot.html to manage the bot');
    
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
}
