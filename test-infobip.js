const AlternativeMessagingService = require('./alternativeMessagingService');

async function testInfobipAPI() {
    console.log('🚀 Testing Infobip WhatsApp API...');
    
    const messagingService = new AlternativeMessagingService();
    
    try {
        // Test API connection
        console.log('🔍 Testing API connection...');
        const connectionTest = await messagingService.testInfobipConnection();
        
        if (connectionTest.success) {
            console.log('✅ Infobip API connection successful!');
            console.log(`💰 Account balance: ${connectionTest.balance} ${connectionTest.currency}`);
        } else {
            console.log('❌ Infobip API connection failed:', connectionTest.error);
            return;
        }
        
        // Get API status
        console.log('📊 Getting API status...');
        const status = await messagingService.getInfobipStatus();
        console.log('📊 Status:', JSON.stringify(status, null, 2));
        
        // Test sending a simple message
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const phoneNumber = await new Promise((resolve) => {
            rl.question('📞 Enter phone number to send test message to (e.g., 0712345678): ', resolve);
        });
        
        const testMessage = 'Hello! This is a test message from your WhatsApp bot using Infobip API. 🚀';
        
        try {
            console.log(`📤 Sending test message to ${phoneNumber}...`);
            const result = await messagingService.sendMessageViaInfobip(phoneNumber, testMessage);
            console.log('✅ Test message sent successfully!');
            console.log('📊 Result:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('❌ Failed to send test message:', error.message);
        }
        
        // Test sending a ticket message
        const testTicket = {
            nume: 'Test User',
            telefon: phoneNumber,
            tip_bilet: 'BAL',
            created_at: new Date()
        };
        
        try {
            console.log('🎫 Testing ticket message...');
            const ticketResult = await messagingService.sendTicketViaInfobip(testTicket, phoneNumber);
            console.log('✅ Ticket message sent successfully!');
            console.log('📊 Result:', JSON.stringify(ticketResult, null, 2));
        } catch (error) {
            console.error('❌ Failed to send ticket message:', error.message);
        }
        
        rl.close();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Clean up
        setTimeout(async () => {
            await messagingService.destroy();
            console.log('🧹 Cleanup completed');
            process.exit(0);
        }, 5000);
    }
}

// Run the test
testInfobipAPI().catch(console.error);
