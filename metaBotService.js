const axios = require('axios');
const FormData = require('form-data');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = require('./config');

class MetaBotService {
    constructor() {
        this.accessToken = META_ACCESS_TOKEN;
        this.phoneNumberId = META_PHONE_NUMBER_ID;
        this.baseURL = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
        this.scheduledMessages = new Map();
        this.isReady = false;
        
        // Initialize the service
        this.initialize();
    }

    async initialize() {
        try {
            if (!this.accessToken || !this.phoneNumberId) {
                console.error('Meta API credentials not configured');
                this.isReady = false;
                return false;
            }
            
            // Test the connection by getting phone number info
            await this.testConnection();
            this.isReady = true;
            console.log('Meta Bot Service initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Meta Bot Service:', error);
            this.isReady = false;
            return false;
        }
    }

    async testConnection() {
        try {
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            console.log('Meta API connection test successful:', response.data);
            return true;
        } catch (error) {
            console.error('Meta API connection test failed:', error.response?.data || error.message);
            throw error;
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
        
        return `🎫 *Biletul tău pentru eveniment*

👤 *Nume:* ${nume}
📱 *Telefon:* ${telefon}
🎟️ *Tip bilet:* ${tip_bilet}
📅 *Data creării:* ${date}

✅ *Biletul este valid și poate fi folosit la intrare.*

_Te rugăm să păstrezi acest bilet pentru verificare._`;
    }

    async sendMessage(phoneNumber, message, mediaUrl = null) {
        if (!this.isReady) {
            throw new Error('Meta Bot Service is not ready');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            const messageData = {
                messaging_product: 'whatsapp',
                to: formattedNumber,
                type: 'text',
                text: {
                    body: message
                }
            };

            // If media URL is provided, send as document
            if (mediaUrl) {
                messageData.type = 'document';
                messageData.document = {
                    link: mediaUrl,
                    filename: 'bilet.png'
                };
            }

            const response = await axios.post(this.baseURL, messageData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Message sent successfully to ${phoneNumber}:`, response.data);
            return { success: true, message: 'Message sent successfully', data: response.data };
            
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw new Error(`Failed to send message: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async sendTicket(ticketData, phoneNumber, customImagePath = null) {
        try {
            // Create message content
            const message = this.createTicketMessage(ticketData);
            
            // Send text message first
            const result = await this.sendMessage(phoneNumber, message);
            
            // If custom image exists, send it
            if (customImagePath && fs.existsSync(customImagePath)) {
                // For Meta API, we need to upload the image first or use a public URL
                // For now, we'll skip the image sending as it requires additional setup
                console.log('Custom image detected but Meta API image sending requires additional setup');
            }
            
            console.log(`Ticket sent successfully to ${phoneNumber}`);
            return { success: true, message: 'Ticket sent successfully' };
            
        } catch (error) {
            console.error('Error sending ticket:', error);
            throw new Error(`Failed to send ticket: ${error.message}`);
        }
    }

    async sendBulkTickets(ticketsData) {
        const results = [];
        
        for (const ticket of ticketsData) {
            try {
                const result = await this.sendTicket(ticket, ticket.telefon, ticket.customImagePath);
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

    scheduleTicketSending(ticketData, phoneNumber, sendTime, customImagePath = null) {
        const jobId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Parse sendTime (format: "YYYY-MM-DD HH:mm:ss")
        const [datePart, timePart] = sendTime.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        
        // Create cron expression for the specific time
        const cronExpression = `${second} ${minute} ${hour} ${day} ${month} *`;
        
        const job = cron.schedule(cronExpression, async () => {
            try {
                await this.sendTicket(ticketData, phoneNumber, customImagePath);
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
                sendTime: data.sendTime,
                status: data.status
            });
        }
        return messages;
    }

    async sendQRCode(phoneNumber, qrCodeDataURL) {
        if (!this.isReady) {
            throw new Error('Meta Bot Service is not ready');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            // Convert data URL to buffer
            const base64Data = qrCodeDataURL.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Save temporary file
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempPath = path.join(tempDir, `qr_${Date.now()}.png`);
            fs.writeFileSync(tempPath, buffer);
            
            // For Meta API, we need to upload the image to a public URL or use their media API
            // For now, we'll send a text message with instructions
            const message = `Codul QR pentru biletul tău a fost generat. Te rugăm să contactezi administratorul pentru a primi imaginea.`;
            
            const result = await this.sendMessage(formattedNumber, message);
            
            // Clean up temporary file
            fs.unlinkSync(tempPath);
            
            return { success: true, message: 'QR Code message sent successfully' };
            
        } catch (error) {
            console.error('Error sending QR code:', error);
            throw new Error(`Failed to send QR code: ${error.message}`);
        }
    }

    async getStatus() {
        return {
            isReady: this.isReady,
            scheduledMessages: this.scheduledMessages.size,
            serviceInfo: {
                phoneNumberId: this.phoneNumberId,
                hasAccessToken: !!this.accessToken
            }
        };
    }

    async destroy() {
        // Cancel all scheduled messages
        for (const [jobId, data] of this.scheduledMessages) {
            data.job.destroy();
        }
        this.scheduledMessages.clear();
        
        console.log('Meta Bot Service destroyed');
    }
}

module.exports = MetaBotService;

