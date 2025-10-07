const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        this.isReady = false;
        this.scheduledMessages = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('QR Code received, scan it with your phone:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            console.log('WhatsApp Bot is ready!');
            this.isReady = true;
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp Bot authenticated successfully');
        });

        this.client.on('auth_failure', (msg) => {
            console.error('Authentication failed:', msg);
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp Bot disconnected:', reason);
            this.isReady = false;
        });
    }

    async initialize() {
        try {
            await this.client.initialize();
            return true;
        } catch (error) {
            console.error('Failed to initialize WhatsApp Bot:', error);
            return false;
        }
    }

    async sendTicket(ticketData, phoneNumber, customImagePath = null) {
        if (!this.isReady) {
            throw new Error('WhatsApp Bot is not ready');
        }

        try {
            // Format phone number for WhatsApp
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            // Create message content
            const message = this.createTicketMessage(ticketData);
            
            // Send text message first
            await this.client.sendMessage(formattedNumber, message);
            
            // If custom image exists, send it
            if (customImagePath && fs.existsSync(customImagePath)) {
                const media = MessageMedia.fromFilePath(customImagePath);
                await this.client.sendMessage(formattedNumber, media, {
                    caption: `Biletul tău personalizat pentru ${ticketData.nume}`
                });
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
                await new Promise(resolve => setTimeout(resolve, 2000));
                
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

    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present
        if (cleaned.startsWith('0')) {
            cleaned = '40' + cleaned.substring(1);
        } else if (!cleaned.startsWith('40')) {
            cleaned = '40' + cleaned;
        }
        
        // Add WhatsApp format
        return cleaned + '@c.us';
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

    async sendQRCode(phoneNumber, qrCodeDataURL) {
        if (!this.isReady) {
            throw new Error('WhatsApp Bot is not ready');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            // Convert data URL to buffer
            const base64Data = qrCodeDataURL.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Save temporary file
            const tempPath = path.join(__dirname, 'temp', `qr_${Date.now()}.png`);
            fs.writeFileSync(tempPath, buffer);
            
            // Send as media
            const media = MessageMedia.fromFilePath(tempPath);
            await this.client.sendMessage(formattedNumber, media, {
                caption: 'Codul QR pentru biletul tău'
            });
            
            // Clean up temporary file
            fs.unlinkSync(tempPath);
            
            return { success: true, message: 'QR Code sent successfully' };
            
        } catch (error) {
            console.error('Error sending QR code:', error);
            throw new Error(`Failed to send QR code: ${error.message}`);
        }
    }

    async getStatus() {
        return {
            isReady: this.isReady,
            scheduledMessages: this.scheduledMessages.size,
            clientInfo: this.client.info ? {
                name: this.client.info.pushname,
                number: this.client.info.wid.user
            } : null
        };
    }

    async destroy() {
        // Cancel all scheduled messages
        for (const [jobId, data] of this.scheduledMessages) {
            data.job.destroy();
        }
        this.scheduledMessages.clear();
        
        // Destroy client
        await this.client.destroy();
    }
}

module.exports = WhatsAppBot;
