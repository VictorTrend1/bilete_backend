const cron = require('node-cron');

class AlternativeMessagingService {
    constructor() {
        this.scheduledMessages = new Map();
        this.isReady = false;
        
        // Configuration for WhatsApp-only messaging
        this.config = {
            // WhatsApp Web automation (using WhatsApp Web directly)
            whatsappWeb: {
                enabled: true, // Always available
                requiresManualSetup: false
            }
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            // WhatsApp Web is always available - no additional setup needed
            this.isReady = true;
            console.log('WhatsApp Messaging Service initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize WhatsApp Messaging Service:', error);
            this.isReady = false;
            return false;
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
        
        // Generate WhatsApp Web link
        const whatsappLink = this.generateWhatsAppLink(phoneNumber, message);
        
        return {
            success: true,
            message: 'Ticket ready for WhatsApp sending',
            results: [{
                success: true,
                method: 'WhatsApp_Web_Link',
                link: whatsappLink,
                message: 'Click the link to open WhatsApp Web and send the message',
                ticketData: ticketData,
                phoneNumber: phoneNumber
            }],
            primaryMethod: 'WhatsApp_Web_Link'
        };
    }

    async sendBulkTickets(ticketsData) {
        const results = [];
        
        for (const ticket of ticketsData) {
            try {
                const result = await this.sendTicket(ticket, ticket.telefon, ticket.email, ticket.customImagePath);
                results.push({ ...ticket, status: 'sent', result });
                
                // Add delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
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
        return {
            isReady: this.isReady,
            scheduledMessages: this.scheduledMessages.size,
            services: {
                whatsappWeb: this.config.whatsappWeb.enabled
            },
            config: {
                whatsappConfigured: this.config.whatsappWeb.enabled
            }
        };
    }

    async destroy() {
        // Cancel all scheduled messages
        for (const [jobId, data] of this.scheduledMessages) {
            data.job.destroy();
        }
        this.scheduledMessages.clear();
        
        console.log('Alternative Messaging Service destroyed');
    }
}

module.exports = AlternativeMessagingService;
