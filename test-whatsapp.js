const AlternativeMessagingService = require('./alternativeMessagingService');

async function testWhatsAppAutomation() {
    console.log('🚀 Testing WhatsApp Automation...');
    
    const messagingService = new AlternativeMessagingService();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check status
    const status = await messagingService.getStatus();
    console.log('📊 Status:', JSON.stringify(status, null, 2));
    
    if (status.automation && status.automation.isReady) {
        console.log('✅ WhatsApp automation is ready!');
        
        // Test sending a message
        const testTicket = {
            nume: 'Test User',
            telefon: '0712345678',
            tip_bilet: 'BAL',
            created_at: new Date()
        };
        
        try {
            const result = await messagingService.sendTicket(
                testTicket, 
                '0712345678', // Your phone number for testing
                null, // No email
                null  // No custom image
            );
            
            console.log('📤 Send result:', JSON.stringify(result, null, 2));
            
        } catch (error) {
            console.error('❌ Error sending message:', error.message);
        }
        
    } else {
        console.log('⚠️ WhatsApp automation not ready. Please scan QR code in the browser window.');
        console.log('💡 The system will fall back to generating WhatsApp links.');
    }
    
    // Clean up
    setTimeout(async () => {
        await messagingService.destroy();
        console.log('🧹 Cleanup completed');
        process.exit(0);
    }, 10000);
}

// Run the test
testWhatsAppAutomation().catch(console.error);
