const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WhatsAppAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.isReady = false;
    }

    async initialize() {
        try {
            console.log('Initializing WhatsApp automation...');
            
            // Launch browser with specific options for WhatsApp Web
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for production
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                defaultViewport: { width: 1280, height: 720 }
            });

            this.page = await this.browser.newPage();
            
            // Set user agent to avoid detection
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Navigate to WhatsApp Web
            await this.page.goto('https://web.whatsapp.com', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            console.log('WhatsApp Web loaded. Please scan QR code to login...');
            
            // Wait for user to scan QR code and login
            await this.waitForLogin();
            
            this.isReady = true;
            console.log('WhatsApp automation ready!');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize WhatsApp automation:', error);
            this.isReady = false;
            return false;
        }
    }

    async waitForLogin() {
        try {
            // Wait for the main chat interface to load (indicates successful login)
            await this.page.waitForSelector('[data-testid="chat-list"]', { 
                timeout: 120000 // 2 minutes timeout for QR scan
            });
            
            console.log('Successfully logged in to WhatsApp Web!');
            this.isLoggedIn = true;
            
        } catch (error) {
            throw new Error('Login timeout. Please scan QR code within 2 minutes.');
        }
    }

    async sendMessage(phoneNumber, message, imagePath = null) {
        if (!this.isReady || !this.isLoggedIn) {
            throw new Error('WhatsApp automation not ready. Please initialize and login first.');
        }

        try {
            console.log(`Sending message to ${phoneNumber}...`);
            
            // Format phone number
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            // Navigate to chat with the number
            const chatUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}`;
            await this.page.goto(chatUrl, { waitUntil: 'networkidle2' });
            
            // Wait for chat to load
            await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 10000 });
            
            // Type the message
            const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]');
            await messageInput.click();
            await messageInput.type(message);
            
            // Send image if provided
            if (imagePath && fs.existsSync(imagePath)) {
                console.log('Attaching image...');
                
                // Click attachment button
                const attachmentButton = await this.page.$('[data-testid="compose-btn-attach"]');
                await attachmentButton.click();
                
                // Wait for attachment menu
                await this.page.waitForSelector('[data-testid="popup-controls"]', { timeout: 5000 });
                
                // Click on photo/video option
                const photoButton = await this.page.$('[data-testid="attach-image"]');
                await photoButton.click();
                
                // Wait for file input
                await this.page.waitForSelector('input[type="file"]', { timeout: 5000 });
                
                // Upload the image
                const fileInput = await this.page.$('input[type="file"]');
                await fileInput.uploadFile(imagePath);
                
                // Wait for image to be attached
                await this.page.waitForSelector('[data-testid="media-preview"]', { timeout: 10000 });
                
                console.log('Image attached successfully');
            }
            
            // Send the message
            const sendButton = await this.page.$('[data-testid="send"]');
            await sendButton.click();
            
            // Wait for message to be sent
            await this.page.waitForTimeout(2000);
            
            console.log(`Message sent successfully to ${phoneNumber}`);
            return { success: true, message: 'Message sent successfully' };
            
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    async sendBulkMessages(messages) {
        const results = [];
        
        for (const messageData of messages) {
            try {
                const result = await this.sendMessage(
                    messageData.phoneNumber, 
                    messageData.message, 
                    messageData.imagePath
                );
                results.push({ ...messageData, status: 'sent', result });
                
                // Add delay between messages to avoid rate limiting
                await this.page.waitForTimeout(3000);
                
            } catch (error) {
                results.push({ 
                    ...messageData, 
                    status: 'failed', 
                    error: error.message 
                });
            }
        }
        
        return results;
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

    async getStatus() {
        return {
            isReady: this.isReady,
            isLoggedIn: this.isLoggedIn,
            browserConnected: this.browser ? true : false
        };
    }

    async destroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.page = null;
        this.isReady = false;
        this.isLoggedIn = false;
        console.log('WhatsApp automation destroyed');
    }
}

module.exports = WhatsAppAutomation;
