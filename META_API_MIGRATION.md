# Meta API Migration Guide

This document explains the migration from WhatsApp Web.js to Meta Graph API for WhatsApp Business.

## Changes Made

### 1. Dependencies Updated
- Removed: `whatsapp-web.js`, `qrcode-terminal`
- Added: `form-data` for file uploads
- Kept: `axios` for HTTP requests, `node-cron` for scheduling

### 2. New Service Class
- Created `metaBotService.js` to replace `botService.js`
- Uses Meta Graph API v18.0 for WhatsApp Business
- No QR code authentication required
- Uses access tokens for authentication

### 3. Configuration Updates
- Added Meta API credentials to `config.js`:
  - `META_ACCESS_TOKEN`: Your Meta access token
  - `META_PHONE_NUMBER_ID`: Your WhatsApp Business phone number ID
  - `META_VERIFY_TOKEN`: Webhook verification token
  - `META_WEBHOOK_URL`: Your webhook URL

### 4. Server Updates
- Updated `server.js` to use `MetaBotService` instead of `WhatsAppBot`
- Removed QR code endpoint (not needed for Meta API)
- Added configuration endpoint instead
- Updated all bot-related endpoints

## Required Environment Variables

Add these to your `.env` file:

```env
# Meta WhatsApp Business API Configuration
META_ACCESS_TOKEN=your_meta_access_token_here
META_PHONE_NUMBER_ID=your_phone_number_id_here
META_VERIFY_TOKEN=your_webhook_verify_token_here
META_WEBHOOK_URL=https://yourdomain.com/webhook
```

## How to Get Meta API Credentials

1. **Create a Meta Business Account**
   - Go to [business.facebook.com](https://business.facebook.com)
   - Create or use an existing business account

2. **Set up WhatsApp Business API**
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Create a new app or use existing one
   - Add WhatsApp product to your app

3. **Get Access Token**
   - In your app dashboard, go to WhatsApp > API Setup
   - Copy the temporary access token
   - For production, create a permanent access token

4. **Get Phone Number ID**
   - In WhatsApp > API Setup, find your phone number
   - Copy the Phone Number ID

5. **Set up Webhook (Optional)**
   - Configure webhook URL for receiving messages
   - Set verify token for webhook verification

## API Endpoints Changes

### Removed Endpoints
- `GET /api/bot/qr` - No longer needed (replaced with `/api/bot/config`)

### New Endpoints
- `GET /api/bot/config` - Returns bot configuration status

### Updated Endpoints
All existing bot endpoints now use Meta API:
- `POST /api/bot/send-ticket`
- `POST /api/bot/send-bulk-tickets`
- `POST /api/bot/schedule-ticket`
- `GET /api/bot/scheduled-messages`
- `DELETE /api/bot/scheduled-messages/:jobId`
- `POST /api/bot/send-qr`

## Key Differences

### Authentication
- **Before**: QR code scanning required
- **After**: Access token authentication

### Message Sending
- **Before**: Direct WhatsApp Web connection
- **After**: HTTP requests to Meta Graph API

### Rate Limiting
- **Before**: WhatsApp Web.js rate limits
- **After**: Meta API rate limits (higher limits for business accounts)

### Media Handling
- **Before**: Direct file upload to WhatsApp
- **After**: Requires uploading to Meta's media API first

## Installation

1. Install new dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Meta API credentials
```

3. Start the server:
```bash
npm start
```

## Testing

1. Check bot status:
```bash
curl http://localhost:3001/api/bot/status
```

2. Test message sending (requires valid credentials):
```bash
curl -X POST http://localhost:3001/api/bot/send-ticket \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"ticketId": "TICKET_ID", "phoneNumber": "PHONE_NUMBER"}'
```

## Troubleshooting

### Common Issues

1. **"Meta Bot Service is not ready"**
   - Check if `META_ACCESS_TOKEN` and `META_PHONE_NUMBER_ID` are set
   - Verify the access token is valid
   - Check if the phone number ID is correct

2. **"Failed to send message"**
   - Verify the phone number format (should include country code)
   - Check if the access token has the required permissions
   - Ensure the phone number is registered with WhatsApp Business

3. **Rate limiting**
   - Meta API has rate limits based on your business tier
   - Implement proper delays between bulk messages
   - Consider upgrading your Meta Business account

### Debug Information

Use the debug endpoint to check service status:
```bash
curl http://localhost:3001/api/bot/debug
```

This will show:
- Bot initialization status
- Service configuration
- Connection status
- Scheduled messages count
