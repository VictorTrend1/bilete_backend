const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class AlternativeMessagingService {
    constructor() {
        this.scheduledMessages = new Map();
        this.isReady = false;
        
        // Configuration for different messaging services
        this.config = {
            // Twilio SMS configuration
            twilio: {
                accountSid: process.env.TWILIO_ACCOUNT_SID,
                authToken: process.env.TWILIO_AUTH_TOKEN,
                fromNumber: process.env.TWILIO_FROM_NUMBER,
                enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
            },
            
            // Email configuration
            email: {
                service: process.env.EMAIL_SERVICE || 'gmail',
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
                enabled: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
            },
            
            // WhatsApp Web automation (using WhatsApp Web directly)
            whatsappWeb: {
                enabled: true, // Always available as fallback
                requiresManualSetup: true
            }
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            // Initialize email transporter if configured
            if (this.config.email.enabled) {
                this.emailTransporter = nodemailer.createTransporter({
                    service: this.config.email.service,
                    auth: {
                        user: this.config.email.user,
                        pass: this.config.email.pass
                    }
                });
                console.log('Email service initialized');
            }
            
            this.isReady = true;
            console.log('Alternative Messaging Service initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Alternative Messaging Service:', error);
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

    // Method 1: Send via Twilio SMS
    async sendViaSMS(phoneNumber, message) {
        if (!this.config.twilio.enabled) {
            throw new Error('Twilio SMS not configured');
        }

        try {
            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilio.accountSid}/Messages.json`,
                new URLSearchParams({
                    To: `+${this.formatPhoneNumber(phoneNumber)}`,
                    From: this.config.twilio.fromNumber,
                    Body: message
                }),
                {
                    auth: {
                        username: this.config.twilio.accountSid,
                        password: this.config.twilio.authToken
                    }
                }
            );

            console.log(`SMS sent successfully to ${phoneNumber}:`, response.data);
            return { success: true, method: 'SMS', data: response.data };
        } catch (error) {
            console.error('Error sending SMS:', error.response?.data || error.message);
            throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
        }
    }

    // Method 2: Send via Email
    async sendViaEmail(email, subject, message, attachmentPath = null) {
        if (!this.config.email.enabled) {
            throw new Error('Email service not configured');
        }

        try {
            const mailOptions = {
                from: this.config.email.user,
                to: email,
                subject: subject,
                text: message,
                html: message.replace(/\n/g, '<br>')
            };

            if (attachmentPath && fs.existsSync(attachmentPath)) {
                mailOptions.attachments = [{
                    filename: path.basename(attachmentPath),
                    path: attachmentPath
                }];
            }

            const result = await this.emailTransporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${email}:`, result.messageId);
            return { success: true, method: 'Email', data: result };
        } catch (error) {
            console.error('Error sending email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    // Method 3: Generate WhatsApp Web link
    generateWhatsAppLink(phoneNumber, message) {
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
    }

    // Main method to send ticket with fallback options
    async sendTicket(ticketData, phoneNumber, email = null, customImagePath = null) {
        const message = this.createTicketMessage(ticketData);
        const results = [];

        // Try SMS first (if configured)
        if (this.config.twilio.enabled) {
            try {
                const smsResult = await this.sendViaSMS(phoneNumber, message);
                results.push(smsResult);
            } catch (error) {
                console.log('SMS failed, trying other methods:', error.message);
            }
        }

        // Try Email (if email provided and configured)
        if (email && this.config.email.enabled) {
            try {
                const emailResult = await this.sendViaEmail(
                    email,
                    `Bilet pentru eveniment - ${ticketData.nume}`,
                    message,
                    customImagePath
                );
                results.push(emailResult);
            } catch (error) {
                console.log('Email failed:', error.message);
            }
        }

        // Always provide WhatsApp Web link as fallback
        const whatsappLink = this.generateWhatsAppLink(phoneNumber, message);
        results.push({
            success: true,
            method: 'WhatsApp_Web_Link',
            link: whatsappLink,
            message: 'Click the link to open WhatsApp Web and send the message'
        });

        return {
            success: true,
            message: 'Ticket sending attempted with multiple methods',
            results: results,
            primaryMethod: results.find(r => r.success && r.method !== 'WhatsApp_Web_Link')?.method || 'WhatsApp_Web_Link'
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
                sms: this.config.twilio.enabled,
                email: this.config.email.enabled,
                whatsappWeb: this.config.whatsappWeb.enabled
            },
            config: {
                twilioConfigured: this.config.twilio.enabled,
                emailConfigured: this.config.email.enabled
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
