const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Installing Alternative Messaging Dependencies...');

try {
    // Install new dependencies
    console.log('📦 Installing nodemailer...');
    execSync('npm install nodemailer@^6.9.7', { stdio: 'inherit' });
    
    console.log('✅ Dependencies installed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('');
    console.log('🔧 OPTION 1: SMS via Twilio (Recommended)');
    console.log('1. Create account at https://www.twilio.com');
    console.log('2. Get your Account SID and Auth Token');
    console.log('3. Add to .env file:');
    console.log('   TWILIO_ACCOUNT_SID=your_account_sid_here');
    console.log('   TWILIO_AUTH_TOKEN=your_auth_token_here');
    console.log('   TWILIO_FROM_NUMBER=+1234567890');
    console.log('');
    console.log('📧 OPTION 2: Email (Backup)');
    console.log('1. Configure Gmail or other email provider');
    console.log('2. Add to .env file:');
    console.log('   EMAIL_SERVICE=gmail');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASS=your-app-password');
    console.log('');
    console.log('💬 OPTION 3: WhatsApp Web Link (Automatic)');
    console.log('No configuration needed - works automatically as fallback');
    console.log('');
    console.log('🎯 The system will try all available methods:');
    console.log('   1. SMS (if Twilio configured)');
    console.log('   2. Email (if email provided and configured)');
    console.log('   3. WhatsApp Web Link (always available)');
    console.log('');
    console.log('📖 For detailed instructions, see ALTERNATIVE_MESSAGING_GUIDE.md');
    console.log('');
    console.log('🚀 Start the server with: npm start');
    
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
}
