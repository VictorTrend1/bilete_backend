const cron = require('node-cron');
const WhatsAppAutomation = require('./whatsappAutomation');
const WhatsAppSessionManager = require('./whatsappSessionManager');
const InfobipWhatsApp = require('./infobipWhatsApp');

class AlternativeMessagingService {
    constructor() {
        this.scheduledMessages = new Map();
        this.isReady = false;
        this.whatsappAutomation = new WhatsAppAutomation();
        this.sessionManager = new WhatsAppSessionManager();
        this.infobipWhatsApp = new InfobipWhatsApp();
        
        // Configuration for WhatsApp-only messaging
        this.config = {
            // WhatsApp Web automation (using WhatsApp Web directly)
            whatsappWeb: {
                enabled: true, // Always available
                requiresManualSetup: false,
                automationEnabled: true
            }
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            // Don't auto-start browser automation on initialization
            // It will be started manually when needed
            this.isReady = true;
            console.log('WhatsApp Messaging Service initialized (manual link mode)');
            console.log('To enable automation, call startAutomation() endpoint');
            return true;
        } catch (error) {
            console.error('Failed to initialize WhatsApp Messaging Service:', error);
            this.isReady = false;
            return false;
        }
    }

    async startAutomation() {
        try {
            console.log('Starting WhatsApp automation...');
            const automationReady = await this.whatsappAutomation.initialize();
            
            if (automationReady) {
                console.log('✅ WhatsApp automation started! Please scan QR code in the browser window.');
                return { success: true, message: 'Automation started. Please scan QR code.' };
            } else {
                console.log('❌ Failed to start automation');
                return { success: false, message: 'Failed to start automation. Check server logs.' };
            }
        } catch (error) {
            console.error('Error starting automation:', error);
            return { success: false, message: error.message };
        }
    }

    async startSessionManager() {
        try {
            console.log('Starting WhatsApp session manager...');
            const sessionReady = await this.sessionManager.initialize();
            
            if (sessionReady) {
                console.log('✅ WhatsApp session manager started!');
                return { success: true, message: 'Session manager started. Check login status.' };
            } else {
                console.log('❌ Failed to start session manager');
                return { success: false, message: 'Failed to start session manager. Check server logs.' };
            }
        } catch (error) {
            console.error('Error starting session manager:', error);
            return { success: false, message: error.message };
        }
    }

    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present
        if (cleaned.startsWith('0')) {
            cleaned = '40' + cleaned.substring(1);
        } else if (!cleaned.startsWith('40')) {
            cleaned = '40' + cleaned;
        }
        
        return cleaned;
    }

    createTicketMessage(ticketData) {
        const { nume, telefon, tip_bilet, created_at } = ticketData;
        const date = new Date(created_at).toLocaleDateString('ro-RO');
        
        return `🎫 Biletul tău pentru eveniment

👤 Nume: ${nume}
📱 Telefon: ${telefon}
🎟️ Tip bilet: ${tip_bilet}
📅 Data creării: ${date}

✅ Biletul este valid și poate fi folosit la intrare.

Te rugăm să păstrezi acest bilet pentru verificare.`;
    }

    // WhatsApp Web link generation (primary method)

    // Method 3: Generate WhatsApp Web link
    generateWhatsAppLink(phoneNumber, message) {
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
    }

    // Main method to send ticket via WhatsApp
    async sendTicket(ticketData, phoneNumber, email = null, customImagePath = null) {
        const message = this.createTicketMessage(ticketData);
        const results = [];
        
        try {
            // Try automated sending first
            if (this.whatsappAutomation && this.whatsappAutomation.isReady) {
                try {
                    const automationResult = await this.whatsappAutomation.sendMessage(
                        phoneNumber, 
                        message, 
                        customImagePath
                    );
                    
                    results.push({
                        success: true,
                        method: 'WhatsApp_Automation',
                        message: 'Message sent automatically via WhatsApp',
                        result: automationResult
                    });
                    
                    return {
                        success: true,
                        message: 'Ticket sent automatically via WhatsApp',
                        results: results,
                        primaryMethod: 'WhatsApp_Automation'
                    };
                    
                } catch (automationError) {
                    console.log('Automation failed, falling back to link generation:', automationError.message);
                }
            }
            
            // Fallback to link generation
            const whatsappLink = this.generateWhatsAppLink(phoneNumber, message);
            results.push({
                success: true,
                method: 'WhatsApp_Web_Link',
                link: whatsappLink,
                message: 'Click the link to open WhatsApp Web and send the message',
                ticketData: ticketData,
                phoneNumber: phoneNumber
            });
            
            return {
                success: true,
                message: 'Ticket ready for WhatsApp sending (automation not available)',
                results: results,
                primaryMethod: 'WhatsApp_Web_Link'
            };
            
        } catch (error) {
            console.error('Error sending ticket:', error);
            throw error;
        }
    }

    async sendBulkTickets(ticketsData) {
        const results = [];
        
        // If automation is available, use bulk sending
        if (this.whatsappAutomation && this.whatsappAutomation.isReady) {
            try {
                const messages = ticketsData.map(ticket => ({
                    phoneNumber: ticket.telefon,
                    message: this.createTicketMessage(ticket),
                    imagePath: ticket.customImagePath
                }));
                
                const automationResults = await this.whatsappAutomation.sendBulkMessages(messages);
                return automationResults;
                
            } catch (error) {
                console.log('Bulk automation failed, falling back to individual sending:', error.message);
            }
        }
        
        // Fallback to individual sending
        for (const ticket of ticketsData) {
            try {
                const result = await this.sendTicket(ticket, ticket.telefon, ticket.email, ticket.customImagePath);
                results.push({ ...ticket, status: 'sent', result });
                
                // Add delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                results.push({ 
                    ...ticket, 
                    status: 'failed', 
                    error: error.message 
                });
            }
        }
        
        return results;
    }

    scheduleTicketSending(ticketData, phoneNumber, sendTime, email = null, customImagePath = null) {
        const jobId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Parse sendTime (format: "YYYY-MM-DD HH:mm:ss")
        const [datePart, timePart] = sendTime.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        
        // Create cron expression for the specific time
        const cronExpression = `${second} ${minute} ${hour} ${day} ${month} *`;
        
        const job = cron.schedule(cronExpression, async () => {
            try {
                await this.sendTicket(ticketData, phoneNumber, email, customImagePath);
                console.log(`Scheduled ticket sent to ${phoneNumber} at ${sendTime}`);
                
                // Remove from scheduled messages after execution
                this.scheduledMessages.delete(jobId);
            } catch (error) {
                console.error(`Failed to send scheduled ticket to ${phoneNumber}:`, error);
            }
        }, {
            scheduled: false
        });
        
        this.scheduledMessages.set(jobId, {
            job,
            ticketData,
            phoneNumber,
            email,
            sendTime,
            status: 'scheduled'
        });
        
        job.start();
        return jobId;
    }

    cancelScheduledMessage(jobId) {
        const scheduledMessage = this.scheduledMessages.get(jobId);
        if (scheduledMessage) {
            scheduledMessage.job.destroy();
            this.scheduledMessages.delete(jobId);
            return true;
        }
        return false;
    }

    getScheduledMessages() {
        const messages = [];
        for (const [jobId, data] of this.scheduledMessages) {
            messages.push({
                jobId,
                ticketData: data.ticketData,
                phoneNumber: data.phoneNumber,
                email: data.email,
                sendTime: data.sendTime,
                status: data.status
            });
        }
        return messages;
    }

    async getStatus() {
        const automationStatus = this.whatsappAutomation ? await this.whatsappAutomation.getStatus() : null;
        
        return {
            isReady: this.isReady,
            scheduledMessages: this.scheduledMessages.size,
            services: {
                whatsappWeb: this.config.whatsappWeb.enabled,
                automation: automationStatus ? automationStatus.isReady : false
            },
            config: {
                whatsappConfigured: this.config.whatsappWeb.enabled,
                automationReady: automationStatus ? automationStatus.isReady : false,
                loggedIn: automationStatus ? automationStatus.isLoggedIn : false
            },
            automation: automationStatus
        };
    }

    // Infobip WhatsApp API methods
    async sendMessageViaInfobip(phoneNumber, message, imageUrl = null) {
        try {
            console.log('📤 Sending message via Infobip API...');
            return await this.infobipWhatsApp.sendMessage(phoneNumber, message, imageUrl);
        } catch (error) {
            console.error('❌ Error sending message via Infobip:', error);
            throw error;
        }
    }

    async sendTicketViaInfobip(ticketData, phoneNumber) {
        try {
            console.log('🎫 Sending ticket via Infobip API...');
            return await this.infobipWhatsApp.sendTicketMessage(ticketData, phoneNumber);
        } catch (error) {
            console.error('❌ Error sending ticket via Infobip:', error);
            throw error;
        }
    }

    async sendBulkMessagesViaInfobip(messages) {
        try {
            console.log('📤 Sending bulk messages via Infobip API...');
            return await this.infobipWhatsApp.sendBulkMessages(messages);
        } catch (error) {
            console.error('❌ Error sending bulk messages via Infobip:', error);
            throw error;
        }
    }

    async testInfobipConnection() {
        try {
            console.log('🔍 Testing Infobip API connection...');
            return await this.infobipWhatsApp.testConnection();
        } catch (error) {
            console.error('❌ Error testing Infobip connection:', error);
            throw error;
        }
    }

    async getInfobipStatus() {
        return await this.infobipWhatsApp.getStatus();
    }

    async destroy() {
        // Cancel all scheduled messages
        for (const [jobId, data] of this.scheduledMessages) {
            data.job.destroy();
        }
        this.scheduledMessages.clear();
        
        // Destroy WhatsApp automation
        if (this.whatsappAutomation) {
            await this.whatsappAutomation.destroy();
        }
        
        console.log('Alternative Messaging Service destroyed');
    }
}

module.exports = AlternativeMessagingService;
