const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WhatsAppPhoneAuth {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.sessionPath = path.join(__dirname, 'whatsapp-session');
    }

    async initialize() {
        try {
            console.log('📱 Initializing WhatsApp with phone authentication...');
            
            // Create session directory
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            this.browser = await puppeteer.launch({
                headless: false, // Keep visible for phone auth
                executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser',
                userDataDir: this.sessionPath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                defaultViewport: { width: 1280, height: 720 }
            });

            this.page = await this.browser.newPage();
            
            // Set user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            return false;
        }
    }

    async loginWithPhone(phoneNumber) {
        try {
            console.log(`📞 Attempting to login with phone number: ${phoneNumber}`);
            
            // Navigate to WhatsApp Web
            await this.page.goto('https://web.whatsapp.com', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for page to load
            await this.page.waitForTimeout(3000);

            // Check if already logged in
            const chatList = await this.page.$('[data-testid="chat-list"]');
            if (chatList) {
                console.log('✅ Already logged in!');
                this.isLoggedIn = true;
                return true;
            }

            // Look for phone number input
            const phoneInput = await this.page.$('input[type="tel"]');
            if (phoneInput) {
                console.log('📱 Phone number input found, entering number...');
                
                // Clear and enter phone number
                await phoneInput.click();
                await phoneInput.evaluate(el => el.value = '');
                await phoneInput.type(phoneNumber);
                
                // Click next button
                const nextButton = await this.page.$('button[type="submit"]');
                if (nextButton) {
                    await nextButton.click();
                    console.log('📤 Phone number submitted, waiting for verification...');
                    
                    // Wait for verification code input
                    await this.page.waitForSelector('input[type="text"]', { timeout: 10000 });
                    console.log('🔐 Please enter the verification code sent to your phone');
                    
                    // Wait for user to enter code manually
                    await this.waitForVerification();
                    
                } else {
                    throw new Error('Next button not found');
                }
            } else {
                console.log('📱 No phone input found, trying QR code method...');
                await this.waitForQRScan();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Login failed:', error);
            return false;
        }
    }

    async waitForVerification() {
        try {
            console.log('⏳ Waiting for verification code to be entered...');
            
            // Wait for chat list to appear (indicates successful login)
            await this.page.waitForSelector('[data-testid="chat-list"]', { 
                timeout: 300000 // 5 minutes for manual code entry
            });
            
            console.log('✅ Successfully logged in with phone number!');
            this.isLoggedIn = true;
            return true;
            
        } catch (error) {
            console.log('⏰ Verification timeout. Please try again.');
            return false;
        }
    }

    async waitForQRScan() {
        try {
            console.log('📱 Please scan the QR code with your phone...');
            
            // Wait for chat list to appear
            await this.page.waitForSelector('[data-testid="chat-list"]', { 
                timeout: 120000 // 2 minutes
            });
            
            console.log('✅ Successfully logged in via QR code!');
            this.isLoggedIn = true;
            return true;
            
        } catch (error) {
            console.log('⏰ QR scan timeout. Please try again.');
            return false;
        }
    }

    async sendMessage(phoneNumber, message, imagePath = null) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in to WhatsApp');
        }

        try {
            console.log(`📤 Sending message to ${phoneNumber}...`);
            
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const chatUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}`;
            
            await this.page.goto(chatUrl, { waitUntil: 'networkidle2' });
            await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 10000 });
            
            const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]');
            await messageInput.click();
            await messageInput.type(message);
            
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
        console.log('🧹 Phone auth destroyed');
    }
}

module.exports = WhatsAppPhoneAuth;
