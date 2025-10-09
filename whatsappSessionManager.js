const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WhatsAppSessionManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.sessionPath = path.join(__dirname, 'whatsapp-session');
        this.isLoggedIn = false;
    }

    async initialize() {
        try {
            console.log('🔐 Initializing WhatsApp session manager...');
            
            // Create session directory
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            // Launch browser with session persistence
            this.browser = await puppeteer.launch({
                headless: process.env.NODE_ENV === 'production' ? 'new' : false,
                executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser',
                userDataDir: this.sessionPath, // Persist session data
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--no-default-browser-check',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-first-run',
                    '--disable-background-networking',
                    '--disable-client-side-phishing-detection',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--metrics-recording-only',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain'
                ],
                defaultViewport: { width: 1280, height: 720 }
            });

            this.page = await this.browser.newPage();
            
            // Set user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Navigate to WhatsApp Web
            await this.page.goto('https://web.whatsapp.com', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Check if already logged in
            await this.checkLoginStatus();
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize session manager:', error);
            return false;
        }
    }

    async checkLoginStatus() {
        try {
            // Wait a bit for page to load
            await this.page.waitForTimeout(3000);
            
            // Check if chat list is visible (indicates login)
            const chatList = await this.page.$('[data-testid="chat-list"]');
            if (chatList) {
                console.log('✅ Already logged in to WhatsApp!');
                this.isLoggedIn = true;
                return true;
            }
            
            // Check if QR code is visible (needs login)
            const qrCode = await this.page.$('[data-testid="qr-code"]');
            if (qrCode) {
                console.log('📱 Please scan QR code to login...');
                await this.waitForLogin();
                return true;
            }
            
            console.log('⚠️ Unable to determine login status');
            return false;
            
        } catch (error) {
            console.error('❌ Error checking login status:', error);
            return false;
        }
    }

    async waitForLogin() {
        try {
            console.log('⏳ Waiting for login...');
            
            // Wait for chat list to appear (indicates successful login)
            await this.page.waitForSelector('[data-testid="chat-list"]', { 
                timeout: 120000 // 2 minutes
            });
            
            console.log('✅ Successfully logged in!');
            this.isLoggedIn = true;
            return true;
            
        } catch (error) {
            console.log('⏰ Login timeout. Please try again.');
            return false;
        }
    }

    async sendMessage(phoneNumber, message, imagePath = null) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in to WhatsApp. Please scan QR code first.');
        }

        try {
            console.log(`📤 Sending message to ${phoneNumber}...`);
            
            // Format phone number
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            // Navigate to chat
            const chatUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}`;
            await this.page.goto(chatUrl, { waitUntil: 'networkidle2' });
            
            // Wait for chat to load
            await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 10000 });
            
            // Type message
            const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]');
            await messageInput.click();
            await messageInput.type(message);
            
            // Attach image if provided
            if (imagePath && fs.existsSync(imagePath)) {
                console.log('📎 Attaching image...');
                
                const attachmentButton = await this.page.$('[data-testid="compose-btn-attach"]');
                await attachmentButton.click();
                
                await this.page.waitForSelector('[data-testid="popup-controls"]', { timeout: 5000 });
                
                const photoButton = await this.page.$('[data-testid="attach-image"]');
                await photoButton.click();
                
                await this.page.waitForSelector('input[type="file"]', { timeout: 5000 });
                
                const fileInput = await this.page.$('input[type="file"]');
                await fileInput.uploadFile(imagePath);
                
                await this.page.waitForSelector('[data-testid="media-preview"]', { timeout: 10000 });
            }
            
            // Send message
            const sendButton = await this.page.$('[data-testid="send"]');
            await sendButton.click();
            
            await this.page.waitForTimeout(2000);
            
            console.log(`✅ Message sent to ${phoneNumber}`);
            return { success: true, message: 'Message sent successfully' };
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    formatPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        if (cleaned.startsWith('0')) {
            cleaned = '40' + cleaned.substring(1);
        } else if (!cleaned.startsWith('40')) {
            cleaned = '40' + cleaned;
        }
        
        return cleaned;
    }

    async getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            sessionPath: this.sessionPath,
            browserConnected: this.browser ? true : false
        };
    }

    async destroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.page = null;
        this.isLoggedIn = false;
        console.log('🧹 Session manager destroyed');
    }
}

module.exports = WhatsAppSessionManager;
