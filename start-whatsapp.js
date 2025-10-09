const AlternativeMessagingService = require('./alternativeMessagingService');

async function startWhatsAppAutomation() {
    console.log('🚀 Starting WhatsApp Automation...');
    
    const messagingService = new AlternativeMessagingService();
    
    try {
        // Initialize the service
        console.log('📡 Initializing messaging service...');
        await messagingService.initialize();
        
        // Start automation
        console.log('🤖 Starting WhatsApp automation...');
        const result = await messagingService.startAutomation();
        
        if (result.success) {
            console.log('✅ WhatsApp automation started successfully!');
            console.log('📱 Instructions:');
            console.log('1. A browser window should open with WhatsApp Web');
            console.log('2. Open WhatsApp on your phone');
            console.log('3. Go to Settings > Linked Devices > Link a Device');
            console.log('4. Scan the QR code shown in the browser');
            console.log('5. Wait for "Successfully logged in" message');
            
            // Keep the process running
            console.log('⏳ Waiting for login... (Press Ctrl+C to stop)');
            
            // Check status every 5 seconds
            const checkStatus = setInterval(async () => {
                const status = await messagingService.getStatus();
                console.log('📊 Status:', JSON.stringify(status.automation, null, 2));
                
                if (status.automation && status.automation.isLoggedIn) {
                    console.log('🎉 Successfully logged in to WhatsApp!');
                    console.log('✅ Automation is ready for sending messages');
                    clearInterval(checkStatus);
                }
            }, 5000);
            
        } else {
            console.error('❌ Failed to start automation:', result.message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

// Start the automation
startWhatsAppAutomation().catch(console.error);
