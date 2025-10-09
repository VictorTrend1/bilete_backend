const WhatsAppPhoneAuth = require('./whatsappPhoneAuth');

async function testPhoneAuthentication() {
    console.log('📱 Testing WhatsApp Phone Number Authentication...');
    
    const whatsapp = new WhatsAppPhoneAuth();
    
    try {
        // Initialize
        console.log('🚀 Initializing WhatsApp...');
        await whatsapp.initialize();
        
        // Get phone number from user
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const phoneNumber = await new Promise((resolve) => {
            rl.question('📞 Enter your phone number (with country code, e.g., +40712345678): ', resolve);
        });
        
        rl.close();
        
        // Attempt login with phone number
        console.log(`🔐 Attempting to login with phone: ${phoneNumber}`);
        const loginSuccess = await whatsapp.loginWithPhone(phoneNumber);
        
        if (loginSuccess) {
            console.log('✅ Login successful!');
            
            // Test sending a message
            const testPhone = await new Promise((resolve) => {
                const rl2 = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl2.question('📤 Enter phone number to send test message to: ', resolve);
            });
            
            const testMessage = 'Hello! This is a test message from WhatsApp automation.';
            
            try {
                const result = await whatsapp.sendMessage(testPhone, testMessage);
                console.log('✅ Test message sent successfully!');
                console.log('📊 Result:', result);
            } catch (error) {
                console.error('❌ Failed to send test message:', error.message);
            }
            
        } else {
            console.log('❌ Login failed. Please try again.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Clean up
        setTimeout(async () => {
            await whatsapp.destroy();
            console.log('🧹 Cleanup completed');
            process.exit(0);
        }, 5000);
    }
}

// Run the test
testPhoneAuthentication().catch(console.error);
