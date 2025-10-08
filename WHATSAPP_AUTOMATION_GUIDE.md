# 🤖 WhatsApp Automation Guide

This guide explains how to use the automated WhatsApp messaging system for sending tickets with images.

## 🚀 **How It Works**

The system uses **Puppeteer** to automate WhatsApp Web, allowing you to:
- ✅ **Automatically send messages** without manual intervention
- ✅ **Send images** (ticket images, custom images)
- ✅ **Bulk messaging** to multiple recipients
- ✅ **Scheduled messaging** for future delivery
- ✅ **Fallback to manual links** if automation fails

## 📋 **Setup Process**

### **Step 1: First Time Setup**
1. **Start the server**: `npm start`
2. **Browser opens automatically** with WhatsApp Web
3. **Scan QR code** with your phone to login
4. **Wait for "Successfully logged in"** message
5. **System is ready** for automated sending

### **Step 2: Using the System**
1. **Access the frontend** and go to "Mesagerie" section
2. **Check status** - should show "WhatsApp Automation: Activ"
3. **Send tickets** - they will be sent automatically
4. **Include images** - system will attach them automatically

## 🔧 **Configuration**

### **Environment Variables**
No additional configuration needed! The system works out of the box.

### **Browser Settings**
- **Headless mode**: Set `headless: true` in `whatsappAutomation.js` for production
- **Display mode**: Set `headless: false` for development/testing

## 📱 **How to Send Messages**

### **Single Ticket**
```javascript
// The system automatically:
// 1. Opens WhatsApp Web
// 2. Navigates to the recipient
// 3. Types the message
// 4. Attaches image (if provided)
// 5. Sends the message
```

### **Bulk Messages**
```javascript
// Sends multiple messages with delays to avoid rate limiting
// Each message includes:
// - Personalized ticket information
// - Custom images (if provided)
// - Proper formatting
```

## 🖼️ **Image Support**

### **Supported Image Types**
- **PNG files** (recommended)
- **JPG/JPEG files**
- **Custom ticket images** (BAL tickets)
- **QR code images**

### **Image Paths**
- **Custom images**: Provide full path to image file
- **Auto-generated**: Use `'auto'` for automatic BAL ticket generation
- **No image**: Use `null` for text-only messages

## ⚡ **Features**

### **Automatic Features**
- ✅ **Phone number formatting** (Romanian format support)
- ✅ **Message personalization** with ticket details
- ✅ **Image attachment** for visual tickets
- ✅ **Rate limiting** to avoid WhatsApp restrictions
- ✅ **Error handling** with fallback to manual links

### **Fallback System**
If automation fails, the system automatically:
1. **Generates WhatsApp Web links**
2. **Shows manual sending options**
3. **Provides clickable links** for manual sending

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **"Automation not ready"**
- **Solution**: Scan QR code in the browser window
- **Check**: Browser window is open and WhatsApp Web is loaded

#### **"Login timeout"**
- **Solution**: Restart the server and scan QR code quickly
- **Time limit**: 2 minutes to scan QR code

#### **"Message sending failed"**
- **Solution**: Check phone number format
- **Format**: Use Romanian format (0712345678) or international (+40712345678)

#### **"Image not attached"**
- **Solution**: Check image file exists and is accessible
- **Supported**: PNG, JPG, JPEG formats

### **Debug Mode**
```javascript
// Check automation status
const status = await messagingService.getStatus();
console.log('Automation status:', status.automation);
```

## 📊 **Status Monitoring**

### **Status Indicators**
- **🟢 Automation: Activ** - Ready for automatic sending
- **🟡 Automation: Neactiv** - Using manual links
- **🔴 Login Status: Neconectat** - Need to scan QR code

### **Real-time Status**
The frontend shows real-time status of:
- WhatsApp automation readiness
- Login status
- Service availability

## 🚀 **Production Deployment**

### **Server Setup**
1. **Install dependencies**: `npm install`
2. **Set headless mode**: `headless: true` in automation config
3. **Configure logging**: Add proper logging for production
4. **Monitor status**: Set up health checks

### **Security Considerations**
- **Browser isolation**: Runs in isolated browser instance
- **Session management**: WhatsApp session is maintained
- **Rate limiting**: Built-in delays to avoid restrictions

## 📈 **Performance**

### **Sending Speed**
- **Single message**: ~3-5 seconds
- **Bulk messages**: ~3 seconds per message (with delays)
- **Image attachment**: +2-3 seconds per image

### **Rate Limits**
- **WhatsApp limits**: ~20-30 messages per minute
- **System delays**: 3-second delay between messages
- **Bulk sending**: Automatic rate limiting

## 🔄 **Maintenance**

### **Regular Tasks**
- **Monitor browser**: Ensure WhatsApp Web stays logged in
- **Check status**: Verify automation is working
- **Update dependencies**: Keep Puppeteer updated

### **Session Management**
- **Auto-reconnect**: System handles session timeouts
- **QR re-scan**: Automatic prompts when session expires
- **Error recovery**: Automatic fallback to manual mode

## 📞 **Support**

### **Getting Help**
1. **Check status** in the frontend
2. **Review logs** in the console
3. **Test with simple message** first
4. **Verify phone number format**

### **Common Solutions**
- **Restart server** if automation stops
- **Re-scan QR code** if login expires
- **Check image paths** if attachments fail
- **Verify phone numbers** if sending fails

---

## 🎯 **Quick Start Checklist**

- [ ] Server started successfully
- [ ] Browser opened with WhatsApp Web
- [ ] QR code scanned and logged in
- [ ] Status shows "Automation: Activ"
- [ ] Test message sent successfully
- [ ] Images attaching correctly
- [ ] Bulk sending working
- [ ] Scheduled messages functioning

**🎉 You're ready to use automated WhatsApp messaging!**
