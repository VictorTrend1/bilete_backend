const axios = require('axios');

class InfobipWhatsApp {
    constructor() {
        this.apiKey = '9c07e3f020f4c442cb5f403877594043-f75f9f0b-801d-43b9-8541-262efed26215';
        this.baseUrl = 'https://g93ze8.api.infobip.com';
        this.sender = '447860088970'; // Your WhatsApp Business number
        this.isReady = true;
    }

    async sendMessage(phoneNumber, message, imageUrl = null) {
        try {
            console.log(`📤 Sending WhatsApp message via Infobip to ${phoneNumber}...`);
            
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            console.log(`Formatted number: ${formattedNumber}, Sender: ${this.sender}`);
            
            let messageData = {
                messages: [
                    {
                        from: this.sender, // Your WhatsApp Business number
                        to: formattedNumber,
                        content: {
                            type: "text",
                            text: message
                        }
                    }
                ]
            };

            // Add image if provided
            if (imageUrl) {
                messageData.messages[0].content = {
                    type: "image",
                    image: {
                        url: imageUrl,
                        caption: message
                    }
                };
            }

            console.log('Message data being sent:', JSON.stringify(messageData, null, 2));
            
            const response = await axios.post(
                `${this.baseUrl}/whatsapp/1/message/text`,
                messageData,
                {
                    headers: {
                        'Authorization': `App ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            console.log(`✅ Message sent successfully to ${phoneNumber}`);
            return {
                success: true,
                messageId: response.data.messages[0].messageId,
                status: response.data.messages[0].status,
                message: 'Message sent via Infobip API'
            };

        } catch (error) {
            console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
            console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
            const errorMessage = error.response?.data?.requestError?.serviceException?.text || 
                                error.response?.data?.requestError?.serviceException?.messageId ||
                                JSON.stringify(error.response?.data) || 
                                error.message;
            throw new Error(`Failed to send message: ${errorMessage}`);
        }
    }

    async sendBulkMessages(messages) {
        const results = [];
        
        for (const messageData of messages) {
            try {
                const result = await this.sendMessage(
                    messageData.phoneNumber,
                    messageData.message,
                    messageData.imageUrl
                );
                results.push({ ...messageData, status: 'sent', result });
                
                // Add delay between messages to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
                
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

    async sendTemplateMessage(phoneNumber, templateName, templateParams = []) {
        try {
            console.log(`📤 Sending WhatsApp template message to ${phoneNumber}...`);
            
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            const messageData = {
                messages: [
                    {
                        from: this.sender, // Your WhatsApp Business number
                        to: formattedNumber,
                        content: {
                            type: "template",
                            template: {
                                name: templateName,
                                language: {
                                    code: "en"
                                },
                                components: [
                                    {
                                        type: "body",
                                        parameters: templateParams.map(param => ({
                                            type: "text",
                                            text: param
                                        }))
                                    }
                                ]
                            }
                        }
                    }
                ]
            };

            const response = await axios.post(
                `${this.baseUrl}/whatsapp/1/message/template`,
                messageData,
                {
                    headers: {
                        'Authorization': `App ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            console.log(`✅ Template message sent successfully to ${phoneNumber}`);
            return {
                success: true,
                messageId: response.data.messages[0].messageId,
                status: response.data.messages[0].status,
                message: 'Template message sent via Infobip API'
            };

        } catch (error) {
            console.error('❌ Error sending template message:', error.response?.data || error.message);
            throw new Error(`Failed to send template message: ${error.response?.data?.requestError?.serviceException?.text || error.message}`);
        }
    }

    async sendTicketMessage(ticketData, phoneNumber, baseUrl = 'https://www.site-bilete.shop') {
        try {
            const message = this.formatTicketMessage(ticketData, baseUrl);
            return await this.sendMessage(phoneNumber, message);
        } catch (error) {
            console.error('❌ Error sending ticket message:', error);
            throw error;
        }
    }

    formatTicketMessage(ticketData, baseUrl = 'https://www.site-bilete.shop') {
        const ticketLink = `${baseUrl}/verificare.html?id=${ticketData._id}`;
        const downloadLink = `${baseUrl}/api/tickets/${ticketData._id}/qr.png`;
        
        return `*Bilet BAL*

*Nume:* ${ticketData.nume}
*Telefon:* ${ticketData.telefon}
*Tip bilet:* ${ticketData.tip_bilet}

*Vezi biletul complet:* ${ticketLink}
*Descarcă biletul:* ${downloadLink}`;
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
        
        // Ensure it's a valid format for Infobip
        return cleaned;
    }

    async getStatus() {
        return {
            isReady: this.isReady,
            apiKey: this.apiKey.substring(0, 10) + '...',
            baseUrl: this.baseUrl,
            service: 'Infobip WhatsApp API'
        };
    }

    async testConnection() {
        try {
            // Test API connection by getting account info
            const response = await axios.get(
                `${this.baseUrl}/account/1/balance`,
                {
                    headers: {
                        'Authorization': `App ${this.apiKey}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            console.log('✅ Infobip API connection successful');
            return {
                success: true,
                balance: response.data.balance,
                currency: response.data.currency
            };
        } catch (error) {
            console.error('❌ Infobip API connection failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.requestError?.serviceException?.text || error.message
            };
        }
    }
}

module.exports = InfobipWhatsApp;
