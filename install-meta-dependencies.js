const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Installing Meta API dependencies...');

try {
    // Install new dependencies
    console.log('📦 Installing form-data...');
    execSync('npm install form-data@^4.0.0', { stdio: 'inherit' });
    
    // Remove old dependencies
    console.log('🗑️ Removing old WhatsApp Web.js dependencies...');
    try {
        execSync('npm uninstall whatsapp-web.js qrcode-terminal', { stdio: 'inherit' });
    } catch (error) {
        console.log('⚠️ Some old dependencies may not have been installed');
    }
    
    console.log('✅ Dependencies updated successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Set up your Meta Business account');
    console.log('2. Get your access token and phone number ID');
    console.log('3. Add the following to your .env file:');
    console.log('   META_ACCESS_TOKEN=your_access_token_here');
    console.log('   META_PHONE_NUMBER_ID=your_phone_number_id_here');
    console.log('   META_VERIFY_TOKEN=your_webhook_verify_token_here');
    console.log('   META_WEBHOOK_URL=https://yourdomain.com/webhook');
    console.log('4. Start the server with: npm start');
    console.log('');
    console.log('📖 For detailed instructions, see META_API_MIGRATION.md');
    
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
}

