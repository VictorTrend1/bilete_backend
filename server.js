const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const path = require('path');
const Jimp = require('jimp');
const fs = require('fs');
require('dotenv').config();
const { MONGODB_URI } = require('./config');
const AlternativeMessagingService = require('./alternativeMessagingService');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize Alternative Messaging Service
const messagingService = new AlternativeMessagingService();
let serviceInitialized = false;

// Initialize bot on startup
(async () => {
    try {
        // Create temp directory for bot files
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        serviceInitialized = await messagingService.initialize();
        if (serviceInitialized) {
            console.log('Alternative Messaging Service initialized successfully');
        } else {
            console.log('Alternative Messaging Service initialization failed - check configuration');
        }
    } catch (error) {
        console.error('Error initializing Alternative Messaging Service:', error);
    }
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup (MongoDB)
mongoose.connect(process.env.MONGODB_URI || MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Mongoose Schemas and Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  group: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'users_new' // Use a new collection to avoid index conflicts
});

const ticketSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: String, required: true, trim: true },
  nume: { type: String, required: true, trim: true },
  telefon: { type: String, required: true, trim: true },
  tip_bilet: { 
    type: String, 
    required: true, 
    enum: ['BAL + AFTER', 'BAL', 'AFTER', 'AFTER VIP', 'BAL + AFTER VIP']
  },
  qr_code: { type: String, required: true, unique: true },
  verified: { type: Boolean, default: false },
  verification_count: { type: Number, default: 0 },
  verification_history: [{
    timestamp: { type: Date, default: Date.now },
    verified: { type: Boolean, default: true }
  }],
  flagged: { type: Boolean, default: false },
  sent: { type: Boolean, default: false },
  sent_at: { type: Date },
  active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: true },
  referral_code: { type: String, unique: true, sparse: true, trim: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


// Group mapping for referral codes (SECRET - only known by organizers)
const GROUP_CODES = {
  'BAL2025ECON': 'Bal Economic',
  'BAL2025CARA': 'Bal Carabella',
  'BAL_ADMIN_TEST': 'Administrator',
  'Bal10-11' : 'Balul Tineretului'
};

const User = mongoose.model('User', userSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Group = mongoose.model('Group', groupSchema);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Check if user account is still active
    try {
      const dbUser = await User.findById(user.id);
      if (!dbUser || dbUser.active === false) {
        return res.status(403).json({ error: 'Contul tău a fost dezactivat. Contactează administratorul.' });
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      return res.status(500).json({ error: 'Server error' });
    }
    
    req.user = user;
    next();
  });
};

// Helper function to normalize Romanian diacritical characters
function normalizeRomanianDiacritics(text) {
  if (!text) return text;
  
  return text
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T');
}

// Bot Routes

// Messaging service status endpoint
app.get('/api/bot/status', async (req, res) => {
    const serviceStatus = await messagingService.getStatus();
    console.log('Messaging service status endpoint called:', { serviceInitialized, serviceStatus });
    res.json({
        initialized: serviceInitialized,
        ready: serviceStatus.isReady,
        status: serviceStatus
    });
});

// Messaging service debug endpoint
app.get('/api/bot/debug', async (req, res) => {
    const serviceStatus = await messagingService.getStatus();
    res.json({
        serviceInitialized,
        serviceStatus,
        services: serviceStatus.services,
        isReady: serviceStatus.isReady,
        timestamp: new Date().toISOString()
    });
});

// Messaging service configuration endpoint
app.get('/api/bot/config', async (req, res) => {
    try {
        if (!serviceInitialized) {
            return res.status(503).json({ error: 'Messaging service not initialized' });
        }
        
        const serviceStatus = await messagingService.getStatus();
        res.json({
            message: 'Alternative Messaging Service is configured and ready',
            status: 'ready',
            services: serviceStatus.services,
            config: serviceStatus.config
        });
    } catch (error) {
        console.error('Error getting messaging service config:', error);
        res.status(500).json({ error: 'Failed to get messaging service configuration' });
    }
});

// Start WhatsApp automation (opens browser for QR code scanning)
app.post('/api/bot/start-automation', async (req, res) => {
    try {
        if (!serviceInitialized) {
            return res.status(503).json({ error: 'Messaging service not initialized' });
        }
        
        console.log('Starting WhatsApp automation via API...');
        const result = await messagingService.startAutomation();
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                instructions: {
                    step1: 'A browser window has opened on the server with WhatsApp Web',
                    step2: 'Open WhatsApp on your phone',
                    step3: 'Go to Settings > Linked Devices > Link a Device',
                    step4: 'Scan the QR code shown in the browser',
                    step5: 'Wait for "Successfully logged in" message',
                    note: 'If you cannot access the server display, automation will not work. Use manual links instead.'
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.message,
                fallback: 'System will continue using manual WhatsApp links'
            });
        }
    } catch (error) {
        console.error('Error starting automation:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: 'System will continue using manual WhatsApp links'
        });
    }
});

// Send ticket via messaging service
app.post('/api/bot/send-ticket', authenticateToken, async (req, res) => {
    try {
        const { ticketId, phoneNumber, email, customImagePath } = req.body;
        
        if (!ticketId || !phoneNumber) {
            return res.status(400).json({ error: 'Ticket ID and phone number are required' });
        }
        
        // Check if messaging service is ready
        const serviceStatus = await messagingService.getStatus();
        console.log('Messaging service status check:', serviceStatus);
        if (!serviceStatus.isReady) {
            return res.status(503).json({ error: 'Messaging service is not ready. Please check configuration.' });
        }
        
        // Get ticket details
        const ticket = await Ticket.findOne({ _id: ticketId, group: req.user.group });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Send ticket via messaging service
        const result = await messagingService.sendTicket(ticket, phoneNumber, email, customImagePath);
        
        res.json({
            success: true,
            message: 'Ticket sending attempted with multiple methods',
            result
        });
        
    } catch (error) {
        console.error('Error sending ticket via messaging service:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send bulk tickets via messaging service
app.post('/api/bot/send-bulk-tickets', authenticateToken, async (req, res) => {
    try {
        const { ticketIds, phoneNumbers, emails, customImagePaths } = req.body;
        
        if (!ticketIds || !phoneNumbers || ticketIds.length !== phoneNumbers.length) {
            return res.status(400).json({ error: 'Ticket IDs and phone numbers arrays must match' });
        }
        
        // Check if messaging service is ready
        const serviceStatus = await messagingService.getStatus();
        console.log('Messaging service status check:', serviceStatus);
        if (!serviceStatus.isReady) {
            return res.status(503).json({ error: 'Messaging service is not ready. Please check configuration.' });
        }
        
        // Get tickets details
        const tickets = await Ticket.find({ 
            _id: { $in: ticketIds }, 
            group: req.user.group 
        });
        
        if (tickets.length !== ticketIds.length) {
            return res.status(404).json({ error: 'Some tickets not found' });
        }
        
        // Prepare data for bulk sending
        const ticketsData = tickets.map((ticket, index) => ({
            ...ticket.toObject(),
            telefon: phoneNumbers[index],
            email: emails ? emails[index] : null,
            customImagePath: customImagePaths ? customImagePaths[index] : null
        }));
        
        // Send bulk tickets
        const results = await messagingService.sendBulkTickets(ticketsData);
        
        res.json({
            success: true,
            message: 'Bulk tickets processing completed',
            results
        });
        
    } catch (error) {
        console.error('Error sending bulk tickets via messaging service:', error);
        res.status(500).json({ error: error.message });
    }
});

// Schedule ticket sending
app.post('/api/bot/schedule-ticket', authenticateToken, async (req, res) => {
    try {
        const { ticketId, phoneNumber, email, sendTime, customImagePath } = req.body;
        
        if (!ticketId || !phoneNumber || !sendTime) {
            return res.status(400).json({ error: 'Ticket ID, phone number, and send time are required' });
        }
        
        // Check if messaging service is ready
        const serviceStatus = await messagingService.getStatus();
        console.log('Messaging service status check:', serviceStatus);
        if (!serviceStatus.isReady) {
            return res.status(503).json({ error: 'Messaging service is not ready. Please check configuration.' });
        }
        
        // Get ticket details
        const ticket = await Ticket.findOne({ _id: ticketId, group: req.user.group });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Schedule ticket sending
        const jobId = messagingService.scheduleTicketSending(ticket, phoneNumber, sendTime, email, customImagePath);
        
        res.json({
            success: true,
            message: 'Ticket scheduled successfully',
            jobId,
            sendTime
        });
        
    } catch (error) {
        console.error('Error scheduling ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get scheduled messages
app.get('/api/bot/scheduled-messages', authenticateToken, (req, res) => {
    try {
        const scheduledMessages = messagingService.getScheduledMessages();
        res.json({
            success: true,
            scheduledMessages
        });
    } catch (error) {
        console.error('Error getting scheduled messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel scheduled message
app.delete('/api/bot/scheduled-messages/:jobId', authenticateToken, (req, res) => {
    try {
        const { jobId } = req.params;
        const cancelled = messagingService.cancelScheduledMessage(jobId);
        
        if (cancelled) {
            res.json({
                success: true,
                message: 'Scheduled message cancelled successfully'
            });
        } else {
            res.status(404).json({ error: 'Scheduled message not found' });
        }
    } catch (error) {
        console.error('Error cancelling scheduled message:', error);
        res.status(500).json({ error: error.message });
    }
});


// Send QR code via bot
app.post('/api/bot/send-qr', authenticateToken, async (req, res) => {
    try {
        const { ticketId, phoneNumber } = req.body;
        
        if (!ticketId || !phoneNumber) {
            return res.status(400).json({ error: 'Ticket ID and phone number are required' });
        }
        
        // Check if messaging service is ready
        const serviceStatus = await messagingService.getStatus();
        console.log('Messaging service status check:', serviceStatus);
        if (!serviceStatus.isReady) {
            return res.status(503).json({ error: 'Messaging service is not ready. Please check configuration.' });
        }
        
        // Get ticket and generate QR code
        const ticket = await Ticket.findOne({ _id: ticketId, group: req.user.group });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        const qrCodeDataURL = await QRCode.toDataURL(ticket.qr_code, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.92,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300
        });
        
        // Send QR code via messaging service
        const result = await messagingService.sendQRCode(phoneNumber, qrCodeDataURL);
        
        res.json({
            success: true,
            message: 'QR code sent successfully',
            result
        });
        
    } catch (error) {
        console.error('Error sending QR code via bot:', error);
        res.status(500).json({ error: error.message });
    }
});

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Site Bilete Backend',
    version: '1.0.0',
    features: {
      ticketPreview: true,
      customBALTickets: true,
      publicAccess: true
    }
  });
});

// Ticket preview system health check
app.get('/api/tickets/preview/health', async (req, res) => {
  try {
    // Check if template file exists
    const templatePath = path.join(__dirname, 'model_bilet.jpg');
    const templateExists = fs.existsSync(templatePath);
    
    // Check if fonts directory exists
    const fontsDir = path.join(__dirname, 'fonts');
    const fontsExist = fs.existsSync(fontsDir);
    
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Ticket Preview System',
      checks: {
        templateFile: templateExists,
        fontsDirectory: fontsExist,
        database: dbStatus,
        jimp: 'available',
        qrcode: 'available'
      },
      endpoints: {
        public: '/api/tickets/:id/public',
        preview: '/api/tickets/:id/preview',
        customBAL: '/api/tickets/:id/custom-bal-public'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, referralCode } = req.body;

    // Validate input
    if (!username || !password || !referralCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, password, and referral code are required' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username must be at least 3 characters long' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if referral code is valid
    if (!GROUP_CODES[referralCode]) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid referral code. Please contact an organizer for a valid code.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already exists. Please choose a different username.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const group = GROUP_CODES[referralCode];

    // Create new user
    const newUser = new User({
      username: username.trim(),
      password: hashedPassword,
      group: group
    });

    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser._id, 
        username: newUser.username,
        group: newUser.group
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Return success response
    res.status(201).json({ 
      success: true,
      message: 'User registered successfully', 
      token, 
      user: { 
        id: newUser._id, 
        username: newUser.username,
        group: newUser.group
      } 
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already exists. Please choose a different username.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user account is active
    if (user.active === false) {
      return res.status(403).json({ error: 'Contul tău a fost dezactivat. Contactează administratorul.' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, username: user.username, group: user.group }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, group: user.group } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create ticket
app.post('/api/tickets', authenticateToken, async (req, res) => {
  const { nume, telefon, tip_bilet } = req.body;

  if (!nume || !telefon || !tip_bilet) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validTicketTypes = ['BAL + AFTER', 'BAL', 'AFTER', 'AFTER VIP', 'BAL + AFTER VIP'];
  if (!validTicketTypes.includes(tip_bilet)) {
    return res.status(400).json({ error: 'Invalid ticket type' });
  }

  try {
    const qrData = JSON.stringify({
      userId: req.user.id,
      group: req.user.group,
      nume,
      telefon,
      tip_bilet,
      timestamp: Date.now()
    });
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H', // High error correction for better scanning
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    const ticket = await Ticket.create({
      user_id: req.user.id,
      group: req.user.group,
      nume,
      telefon,
      tip_bilet,
      qr_code: qrData,
    });
    res.json({
      message: 'Ticket created successfully',
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        created_at: ticket.created_at,
        verified: ticket.verified,
        qr_code: qrCodeDataURL
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate ticket QR code' });
    }
    res.status(500).json({ error: 'Error generating or saving ticket' });
  }
});

// Serve QR image for a ticket by id (auth required)
app.get('/api/tickets/:id/qr', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const qrCodeDataURL = await QRCode.toDataURL(ticket.qr_code, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    res.json({
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet
      },
      qr_code: qrCodeDataURL
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load ticket QR' });
  }
});

// Public QR image endpoint (PNG). Allows sharing the QR via link.
app.get('/api/tickets/:id/qr.png', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).send('Not found');
    }
    const buffer = await QRCode.toBuffer(ticket.qr_code, { 
      type: 'png',
      errorCorrectionLevel: 'H',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (e) {
    res.status(500).send('Failed to render QR');
  }
});

// Public custom BAL ticket generation (no auth required for sharing)
// Public endpoint to get ticket data for verification page
app.get('/api/tickets/:id/public', async (req, res) => {
  try {
    console.log(`📋 Fetching public ticket data for ID: ${req.params.id}`);
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      console.log(`❌ Ticket not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    console.log(`✅ Ticket found: ${ticket.nume} (${ticket.tip_bilet})`);

    // Return ticket data without sensitive information
    res.json({
      success: true,
      ticket: {
        _id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        group: ticket.group,
        verified: ticket.verified,
        created_at: ticket.created_at
      }
    });
  } catch (error) {
    console.error('❌ Error fetching public ticket data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper function to generate custom ticket image
async function generateCustomTicket(ticket, isPreview = false) {
  // Load the appropriate template image based on ticket type
  let templatePath, qrSize, qrX, qrY, nameX, nameY, textBoxWidth, textBoxHeight;
  
  if (ticket.tip_bilet === 'AFTER') {
    // Check if group is Bal Carabella for custom template
    if (ticket.group === 'Bal Carabella') {
      // Use after_cara.jpeg template for Bal Carabella AFTER tickets
      templatePath = path.join(__dirname, 'after_cara.jpeg');
      console.log(`📁 Loading Bal Carabella AFTER template from: ${templatePath}`);
      
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;   // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else {
      // Use after.png template for AFTER tickets
      templatePath = path.join(__dirname, 'after.png');
      console.log(`📁 Loading AFTER template from: ${templatePath}`);
      
      // Calculate QR code size (square from x1040, y255 to x1430, y647)
      qrSize = 1430 - 1040; // 390 pixels
      qrX = 1040;  // X position for QR code
      qrY = 255;   // Y position for QR code
      // Position for name (from after.png template coordinates)
      nameX = 72;   // X position for name (left edge of text box)
      nameY = 324;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 941 - 72;  // 869 pixels wide
      textBoxHeight = 579 - 324; // 255 pixels tall
    }
  } else if (ticket.tip_bilet === 'BAL + AFTER VIP') {
    // Check if group is Bal Carabella for custom template
    if (ticket.group === 'Bal Carabella') {
      // Use bal-after-vip_cara.png template for Bal Carabella BAL + AFTER VIP tickets
      templatePath = path.join(__dirname, 'bal-after-vip_cara.jpeg');
      console.log(`📁 Loading Bal Carabella BAL + AFTER VIP template from: ${templatePath}`);
      
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;   // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else {
      // Use BAL+AFTERVIP.png template for BAL + AFTER VIP tickets
      templatePath = path.join(__dirname, 'BAL+AFTERVIP.png');
      console.log(`📁 Loading BAL + AFTER VIP template from: ${templatePath}`);
      
      // Calculate QR code size (square from x1035, y252 to x1425, y642)
      qrSize = 1425 - 1035; // 390 pixels
      qrX = 1035;  // X position for QR code
      qrY = 252;   // Y position for QR code
      
      // Position for name (from BAL + AFTER VIP.png template coordinates)
      nameX = 72;   // X position for name (left edge of text box)
      nameY = 318;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 930 - 72;  // 858 pixels wide
      textBoxHeight = 580 - 318; // 262 pixels tall
    }
  } else if (ticket.tip_bilet === 'AFTER VIP') {
    // Check if group is Bal Carabella for custom template
    if (ticket.group === 'Bal Carabella') {
      // Use after-vip_cara.jpeg template for Bal Carabella AFTER VIP tickets
      templatePath = path.join(__dirname, 'after-vip_cara.jpeg');
      console.log(`📁 Loading Bal Carabella AFTER VIP template from: ${templatePath}`);
      
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;   // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else {
      // Use AFTERVIP.png template for AFTER VIP tickets
      templatePath = path.join(__dirname, 'AFTERVIP.png');
      console.log(`📁 Loading AFTER VIP template from: ${templatePath}`);
      
      // Calculate QR code size (square from x1035, y252 to x1425, y642)
      qrSize = 1425 - 1035; // 390 pixels
      qrX = 1035;  // X position for QR code
      qrY = 252;   // Y position for QR code
      
      // Position for name (from AFTER VIP.png template coordinates)
      nameX = 72;   // X position for name (left edge of text box)
      nameY = 318;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 930 - 72;  // 858 pixels wide
      textBoxHeight = 580 - 318; // 262 pixels tall
    }
  } else if (ticket.tip_bilet === 'BAL') {
    if (ticket.group === 'Bal Carabella') {
      // Use bal_cara.png template for Bal Carabella BAL tickets
      templatePath = path.join(__dirname, 'bal_cara.jpeg');
      console.log(`📁 Loading Bal Carabella BAL template from: ${templatePath}`);
      
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else if(ticket.group === 'Bal10-11') {
      // Use bal_tineret.jpeg template for Bal10-11 group
      templatePath = path.join(__dirname, 'bal_tineret.jpeg');
      console.log(`📁 Loading Bal10-11 template from: ${templatePath}`);
      
      // QR code position: from (572, 237) to (786, 451) - square
      qrSize = 786 - 572; // 214 pixels
      qrX = 572;  // X position for QR code
      qrY = 237;   // Y position for QR code
      
      // Text position: between (61, 285) and (512, 405)
      nameX = 61;   // X position for name (left edge of text box)
      nameY = 285;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 512 - 91;  // 451 pixels wide
      textBoxHeight = 405 - 285; // 120 pixels tall
    } else if (ticket.group === 'Bal Carabella') {
      // Use bal_carabella.png template for Bal Carabella BAL tickets
      templatePath = path.join(__dirname, 'bal_cara.png');
      console.log(`📁 Loading Bal Carabella BAL template from: ${templatePath}`);
      
      // Calculate QR code size (square from 102,316 to 525,741)
      qrSize = 525 - 102; // 423 pixels
      qrX = 102;  // X position for QR code
      qrY = 316;   // Y position for QR code
      
      // Position for name (from template coordinates - center in the text box)
      nameX = 801;   // X position for name (left edge of text box)
      nameY = 409;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1278 - 801;  // 477 pixels wide
      textBoxHeight = 660 - 409; // 251 pixels tall
    } else {
      // Use model_bilet.jpg template for other BAL tickets
      templatePath = path.join(__dirname, 'model_bilet.jpg');
      console.log(`📁 Loading BAL template from: ${templatePath}`);
      
      // Calculate QR code size (square from 1049,270 to 1424,638)
      qrSize = 1424 - 1049; // 375 pixels
      qrX = 1049;  // X position for QR code
      qrY = 270;   // Y position for QR code
      
      // Position for name (from template coordinates - center in the text box)
      nameX = 84;   // X position for name (left edge of text box)
      nameY = 334;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 928 - 84;  // 844 pixels wide
      textBoxHeight = 566 - 334; // 232 pixels tall
    }
  } else if (ticket.tip_bilet === 'BAL + AFTER') {
    // Check if group is Bal Carabella for custom template
    if (ticket.group === 'Bal Carabella') {
      // Use bal-after_cara.png template for Bal Carabella BAL + AFTER tickets
      templatePath = path.join(__dirname, 'bal-after_cara.jpeg');
      console.log(`📁 Loading Bal Carabella BAL + AFTER template from: ${templatePath}`);
      
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;   // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else {
      // Use BILET_AFTERbal.png template for BAL + AFTER tickets
      templatePath = path.join(__dirname, 'BILET_AFTERbal.jpeg');
      console.log(`📁 Loading BAL + AFTER template from: ${templatePath}`);
      
      // Calculate QR code size (square from x1035, y252 to x1425, y642)
      qrSize = 1425 - 1035; // 390 pixels
      qrX = 1055;  // X position for QR code
      qrY = 252;   // Y position for QR code
      
      // Position for name (from BILET_AFTERbal.png template coordinates)
      nameX = 72;   // X position for name (left edge of text box)
      nameY = 318;  // Y position for name (top edge of text box)
      
      // Calculate text box dimensions for proper centering
      textBoxWidth = 930 - 72;  // 858 pixels wide
      textBoxHeight = 580 - 318; // 262 pixels tall
    }
  }
  
  const template = await Jimp.read(templatePath);
  
  // Generate QR code as buffer with correct size
  const qrBuffer = await QRCode.toBuffer(ticket.qr_code, {
    type: 'png',
    errorCorrectionLevel: 'H',
    quality: 0.92,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: qrSize // Use calculated size to fit the template box
  });
  
  // Load QR code image
  const qrImage = await Jimp.read(qrBuffer);
  
  // Load Benzin-BOLD font for name (bolder, more prominent)
  let font;
  try {
    // Try to load Benzin-BOLD font if available
    font = await Jimp.loadFont(path.join(__dirname, 'fonts', 'benzin-bold.ttf'));
  } catch (error) {
    // Fallback to a bolder built-in font
    font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  }
  
  // Clone template to avoid modifying original
  const customTicket = template.clone();
  
  // Composite QR code onto template
  customTicket.composite(qrImage, qrX, qrY);
  
  // Add name text centered in the text box (uppercase, white, bold)
  // Normalize Romanian diacritical characters before displaying
  const normalizedName = normalizeRomanianDiacritics(ticket.nume);
  customTicket.print(font, nameX, nameY, {
    text: normalizedName.toUpperCase(),
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
  }, textBoxWidth, textBoxHeight);
  
  // Optimize image for preview (smaller size, faster loading)
  if (isPreview) {
    // Resize to max 1200px width for preview (maintains aspect ratio)
    const maxWidth = 1200;
    if (customTicket.getWidth() > maxWidth) {
      customTicket.resize(maxWidth, Jimp.AUTO, Jimp.RESIZE_BEZIER);
    }
  }
  
  // Get buffer and return
  const buffer = await customTicket.getBufferAsync(Jimp.MIME_PNG);
  
  return buffer;
}

// Endpoint for direct image download
app.get('/api/tickets/:id/custom-public/image', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if preview version is requested (smaller, optimized for web viewing)
    const isPreview = req.query.preview === 'true';
    
    const buffer = await generateCustomTicket(ticket, isPreview);
    
    // Set caching headers to reduce server load (cache for 1 hour)
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.set('ETag', `"${ticket._id}-${ticket.updated_at}"`); // ETag for conditional requests
    
    // Only set download header if not preview
    if (!isPreview) {
      const normalizedNameForFile = normalizeRomanianDiacritics(ticket.nume);
      res.set('Content-Disposition', `attachment; filename="bilet-${normalizedNameForFile}-${ticket._id}.png"`);
    }
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Custom ticket generation error:', error);
    res.status(500).json({ error: 'Failed to generate custom ticket' });
  }
});

// Preview page with download button
app.get('/api/tickets/:id/custom-public', async (req, res) => {
  try {
    console.log(`🎫 Generating ticket preview page for ID: ${req.params.id}`);
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      console.log(`❌ Ticket not found: ${req.params.id}`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ticket Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1>Ticket Not Found</h1>
          <p>The requested ticket could not be found.</p>
        </body>
        </html>
      `);
    }

    console.log(`📋 Ticket found: ${ticket.nume} (${ticket.tip_bilet})`);

    // Check if ticket or group is inactive
    const ticketActive = ticket.active !== undefined ? ticket.active : true;
    const group = await Group.findOne({ name: ticket.group });
    const groupActive = group ? group.active : true;
    const isInactive = !ticketActive || !groupActive;

    // Generate optimized preview version (smaller, faster loading) for embedding
    const buffer = await generateCustomTicket(ticket, true); // true = preview mode
    const base64Image = buffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;

    // Send HTML page with preview and download button
    const html = `
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bilet - ${ticket.nume}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 100%;
            width: 100%;
            max-width: 1200px;
          }
          
          h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 28px;
          }
          
          .ticket-preview {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 30px;
            background: #f5f5f5;
            border-radius: 15px;
            padding: 20px;
            overflow: auto;
          }
          
          .ticket-preview img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          }
          
          .download-section {
            text-align: center;
          }
          
          .download-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            font-size: 18px;
            font-weight: bold;
            text-decoration: none;
            border-radius: 50px;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
          }
          
          .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
          }
          
          .download-btn:active {
            transform: translateY(0);
          }
          
          .ticket-info {
            text-align: center;
            color: #666;
            margin-top: 20px;
            font-size: 14px;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          
          .footer a {
            color: #667eea;
            text-decoration: none;
            transition: color 0.3s ease;
          }
          
          .footer a:hover {
            color: #764ba2;
            text-decoration: underline;
          }
          
          .event-ended-banner {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            font-size: 18px;
            font-weight: 600;
          }
          
          .event-ended-banner i {
            font-size: 24px;
            margin-right: 10px;
          }
          
          @media (max-width: 768px) {
            .container {
              padding: 20px;
            }
            
            h1 {
              font-size: 22px;
            }
            
            .download-btn {
              padding: 12px 30px;
              font-size: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎫 Biletul Tău</h1>
          
          ${isInactive ? `
          <div class="event-ended-banner">
            <i class="fas fa-exclamation-triangle"></i>
            Evenimentul s-a terminat
          </div>
          ` : ''}
          
          <div class="ticket-preview">
            <img src="${imageDataUrl}" alt="Bilet - ${ticket.nume}" loading="lazy" decoding="async" />
          </div>
          
          <div class="download-section">
            <a href="/api/tickets/${ticket._id}/custom-public/image" class="download-btn" download>
              ⬇️ Descarcă Biletul
            </a>
            <div class="ticket-info">
              <p><strong>Nume:</strong> ${ticket.nume}</p>
              <p><strong>Tip bilet:</strong> ${ticket.tip_bilet}</p>
            </div>
          </div>
          
          <div class="footer">
            <p><a href="/termeni.html" target="_blank">Termeni și Condiții</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
    console.log(`🎉 Ticket preview page generated successfully for ${ticket.nume}`);
    
  } catch (error) {
    console.error('❌ Ticket preview page generation error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1>Error</h1>
        <p>Failed to generate ticket preview. Please try again later.</p>
      </body>
      </html>
    `);
  }
});

// Generic ticket preview for all ticket types (public access)
app.get('/api/tickets/:id/preview', async (req, res) => {
  try {
    console.log(`🎫 Generating ticket preview for ID: ${req.params.id}`);
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      console.log(`❌ Ticket not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    console.log(`📋 Ticket found: ${ticket.nume} (${ticket.tip_bilet})`);

    // For all tickets, use the custom template
    console.log(`🎨 Redirecting to custom ticket generation`);
    return res.redirect(`/api/tickets/${ticket._id}/custom-public`);
    
  } catch (error) {
    console.error('❌ Ticket preview generation error:', error);
    res.status(500).json({ error: 'Failed to generate ticket preview' });
  }
});

// Custom BAL ticket generation with template
app.get('/api/tickets/:id/custom-bal', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Only generate custom ticket for BAL type
    if (ticket.tip_bilet !== 'BAL') {
      return res.status(400).json({ error: 'Custom ticket generation only available for BAL tickets' });
    }

    // Load the template image - use bal_cara.png for Bal Carabella group
    let templatePath;
    if (ticket.group === 'Bal Carabella') {
      templatePath = path.join(__dirname, 'bal_cara.jpeg');
      console.log(`📁 Loading Bal Carabella BAL template from: ${templatePath}`);
    } else {
      templatePath = path.join(__dirname, 'model_bilet.jpg');
      console.log(`📁 Loading BAL template from: ${templatePath}`);
    }
    const template = await Jimp.read(templatePath);
    
    // Calculate QR code size and positions based on group
    let qrSize, qrX, qrY, nameX, nameY, textBoxWidth, textBoxHeight;
    
    if (ticket.group === 'Bal Carabella') {
      // Bal Carabella template coordinates (using bal_cara.png)
      // QR code: square from (103, 316) to (529, 745)
      qrSize = 529 - 103; // 426 pixels
      qrX = 103;  // X position for QR code
      qrY = 316;  // Y position for QR code
      
      // Name: from (795, 406) to (1309, 642)
      nameX = 795;   // X position for name (left edge of text box)
      nameY = 406;  // Y position for name (top edge of text box)
      textBoxWidth = 1309 - 795;  // 514 pixels wide
      textBoxHeight = 642 - 406;  // 236 pixels tall
    } else {
      // Default BAL template coordinates (model_bilet.jpg)
      // QR code: square from 1049,270 to 1424,638
      qrSize = 1424 - 1049; // 375 pixels
      qrX = 1049;  // X position for QR code
      qrY = 270;   // Y position for QR code
      
      // Name: from template coordinates
      nameX = 84;   // X position for name (left edge of text box)
      nameY = 334;  // Y position for name (top edge of text box)
      textBoxWidth = 928 - 84;  // 844 pixels wide
      textBoxHeight = 566 - 334; // 232 pixels tall
    }
    
    // Generate QR code as buffer with correct size
    const qrBuffer = await QRCode.toBuffer(ticket.qr_code, {
      type: 'png',
      errorCorrectionLevel: 'H',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: qrSize // Use calculated size to fit the template box
    });
    
    // Load QR code image
    const qrImage = await Jimp.read(qrBuffer);
    
    // Load Benzin-BOLD font for name (bolder, more prominent)
    let font;
    try {
      // Try to load Benzin-BOLD font if available
      font = await Jimp.loadFont(path.join(__dirname, 'fonts', 'benzin-bold.fnt'));
    } catch (error) {
      console.log('Benzin-BOLD font not found, using fallback font');
      // Fallback to a bolder built-in font
      font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    }
    
    // Clone template to avoid modifying original
    const customTicket = template.clone();
    
    // Composite QR code onto template
    customTicket.composite(qrImage, qrX, qrY);
    
    // Add name text centered in the text box (uppercase, white, bold)
    // Normalize Romanian diacritical characters before displaying
    const normalizedName = normalizeRomanianDiacritics(ticket.nume);
    customTicket.print(font, nameX, nameY, {
      text: normalizedName.toUpperCase(),
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, textBoxWidth, textBoxHeight);
    
    // Get buffer and send as PNG
    const buffer = await customTicket.getBufferAsync(Jimp.MIME_PNG);
    
    res.set('Content-Type', 'image/png');
    const normalizedNameForFile = normalizeRomanianDiacritics(ticket.nume);
    res.set('Content-Disposition', `attachment; filename="bilet-${normalizedNameForFile}-${ticket._id}.png"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Custom BAL ticket generation error:', error);
    res.status(500).json({ error: 'Failed to generate custom ticket' });
  }
});

// Custom AFTER ticket generation with after.png template
app.get('/api/tickets/:id/custom-after', authenticateToken, async (req, res) => {
  try {
    console.log(`🎫 Generating custom AFTER ticket for ID: ${req.params.id}`);
    
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    if (!ticket) {
      console.log(`❌ Ticket not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Only generate custom ticket for AFTER type
    if (ticket.tip_bilet !== 'AFTER') {
      console.log(`❌ Invalid ticket type: ${ticket.tip_bilet}, expected AFTER`);
      return res.status(400).json({ error: 'Custom ticket generation only available for AFTER tickets' });
    }

    console.log(`📋 Ticket found: ${ticket.nume} (${ticket.tip_bilet})`);

    // Load the after.png template image
    const templatePath = path.join(__dirname, 'after.png');
    console.log(`📁 Loading AFTER template from: ${templatePath}`);
    const template = await Jimp.read(templatePath);
    console.log(`✅ AFTER template loaded: ${template.getWidth()}x${template.getHeight()}`);
    
    // Calculate QR code size (square from x1040, y255 to x1430, y647)
    const qrSize = 1430 - 1040; // 390 pixels
    console.log(`🔲 QR code size: ${qrSize}x${qrSize} pixels`);
    
    // Generate QR code as buffer with correct size
    console.log(`🔗 Generating QR code for: ${ticket.qr_code}`);
    const qrBuffer = await QRCode.toBuffer(ticket.qr_code, {
      type: 'png',
      errorCorrectionLevel: 'H',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: qrSize // Use calculated size to fit the template box
    });
    console.log(`✅ QR code generated: ${qrBuffer.length} bytes`);
    
    // Load QR code image
    const qrImage = await Jimp.read(qrBuffer);
    console.log(`✅ QR image loaded: ${qrImage.getWidth()}x${qrImage.getHeight()}`);
    
    // Load Benzin-BOLD font for name (bolder, more prominent)
    let font;
    try {
      // Try to load Benzin-BOLD font if available
      console.log(`🔤 Loading Benzin-BOLD font...`);
      font = await Jimp.loadFont(path.join(__dirname, 'fonts', 'benzin-bold.ttf'));
      console.log(`✅ Benzin-BOLD font loaded successfully`);
    } catch (error) {
      console.log(`⚠️ Benzin-BOLD font not found, using fallback font: ${error.message}`);
      // Fallback to a bolder built-in font
      font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
      console.log(`✅ Fallback font loaded`);
    }
    
    // Clone template to avoid modifying original
    const customTicket = template.clone();
    console.log(`🔄 Template cloned for customization`);
    
    // Position for QR code (from after.png template coordinates)
    const qrX = 1040;  // X position for QR code
    const qrY = 255;   // Y position for QR code
    
    // Position for name (from after.png template coordinates - center in the text box)
    const nameX = 72;   // X position for name (left edge of text box)
    const nameY = 324;  // Y position for name (top edge of text box)
    
    // Calculate text box dimensions for proper centering
    const textBoxWidth = 941 - 72;  // 869 pixels wide
    const textBoxHeight = 579 - 324; // 255 pixels tall
    
    console.log(`🎨 Composing AFTER ticket elements...`);
    console.log(`📍 QR code position: (${qrX}, ${qrY})`);
    console.log(`📍 Name position: (${nameX}, ${nameY}) in box ${textBoxWidth}x${textBoxHeight}`);
    const normalizedNameForLog = normalizeRomanianDiacritics(ticket.nume);
    console.log(`📝 Name text: "${normalizedNameForLog.toUpperCase()}"`);
    
    // Composite QR code onto template
    customTicket.composite(qrImage, qrX, qrY);
    console.log(`✅ QR code composited`);
    
    // Add name text centered in the text box (uppercase, white, bold)
    // Normalize Romanian diacritical characters before displaying
    const normalizedName = normalizeRomanianDiacritics(ticket.nume);
    customTicket.print(font, nameX, nameY, {
      text: normalizedName.toUpperCase(),
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, textBoxWidth, textBoxHeight);
    console.log(`✅ Name text rendered`);
    
    // Get buffer and send as PNG
    console.log(`💾 Generating final image buffer...`);
    const buffer = await customTicket.getBufferAsync(Jimp.MIME_PNG);
    console.log(`✅ Final image generated: ${buffer.length} bytes`);
    
    res.set('Content-Type', 'image/png');
    const normalizedNameForFile = normalizeRomanianDiacritics(ticket.nume);
    res.set('Content-Disposition', `attachment; filename="bilet-after-${normalizedNameForFile}-${ticket._id}.png"`);
    res.send(buffer);
    console.log(`🎉 Custom AFTER ticket generated successfully for ${ticket.nume}`);
    
  } catch (error) {
    console.error('❌ Custom AFTER ticket generation error:', error);
    res.status(500).json({ error: 'Failed to generate custom AFTER ticket' });
  }
});

// Get tickets for user's group only
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({ group: req.user.group }).populate('user_id', 'username').sort({ created_at: 1 });
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get single ticket by ID
app.get('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group }).populate('user_id', 'username');
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update ticket sent status
app.put('/api/tickets/:id/sent', authenticateToken, async (req, res) => {
  try {
    const { sent } = req.body;
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.sent = sent;
    if (sent) {
      ticket.sent_at = new Date();
    } else {
      ticket.sent_at = null;
    }
    
    await ticket.save();
    
    res.json({
      success: true,
      message: `Ticket ${sent ? 'marked as sent' : 'marked as not sent'}`,
      ticket: {
        id: ticket._id,
        sent: ticket.sent,
        sent_at: ticket.sent_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update ticket type (tip_bilet)
app.put('/api/tickets/:id/type', authenticateToken, async (req, res) => {
  try {
    const { tip_bilet } = req.body;
    
    if (!tip_bilet) {
      return res.status(400).json({ error: 'Tip bilet is required' });
    }
    
    const validTicketTypes = ['BAL + AFTER', 'BAL', 'AFTER', 'AFTER VIP', 'BAL + AFTER VIP'];
    if (!validTicketTypes.includes(tip_bilet)) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }
    
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Update ticket type
    ticket.tip_bilet = tip_bilet;
    
    // Regenerate QR code with new ticket type
    const qrData = JSON.stringify({
      userId: ticket.user_id,
      group: ticket.group,
      nume: ticket.nume,
      telefon: ticket.telefon,
      tip_bilet: tip_bilet,
      timestamp: Date.now()
    });
    
    ticket.qr_code = qrData;
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket type updated successfully',
      ticket: {
        id: ticket._id,
        tip_bilet: ticket.tip_bilet
      }
    });
  } catch (error) {
    console.error('Error updating ticket type:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper function to normalize phone number for searching
function normalizePhoneForSearch(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('+40')) {
    // Format: +40712345678 -> keep as is
    return cleaned;
  } else if (cleaned.startsWith('40') && cleaned.length === 11) {
    // Format: 40712345678 -> convert to +40712345678
    return '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Format: 0712345678 -> convert to +40712345678
    return '+40' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Format: 712345678 -> convert to +40712345678
    return '+40' + cleaned;
  }
  
  // Return original if can't normalize
  return phoneNumber;
}

// Helper function to extract just the digits (last 9 digits for Romanian numbers)
function extractPhoneDigits(phoneNumber) {
  if (!phoneNumber) return '';
  // Remove all non-digit characters and get last 9 digits
  const digits = phoneNumber.replace(/\D/g, '');
  return digits.slice(-9); // Get last 9 digits (Romanian mobile number)
}

// Verify ticket (for organizers)
app.post('/api/verify-ticket', async (req, res) => {
  const { qrData } = req.body;

  if (!qrData) {
    return res.status(400).json({ error: 'QR code data is required' });
  }

  try {
    JSON.parse(qrData);
    const ticket = await Ticket.findOne({ qr_code: qrData });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Increment verification count
    ticket.verification_count += 1;
    
    // Add to verification history
    ticket.verification_history.push({
      timestamp: new Date(),
      verified: true
    });

    // Check if ticket has been verified multiple times (fraud detection)
    // For BAL + AFTER and BAL + AFTER VIP tickets, allow 2 successful reads before flagging (flag on 3rd)
    // For all other tickets, allow 1 successful read before flagging (flag on 2nd)
    const isDualAccessTicket = (ticket.tip_bilet === 'BAL + AFTER' || ticket.tip_bilet === 'BAL + AFTER VIP');
    const flagThreshold = isDualAccessTicket ? 3 : 2;
    if (ticket.verification_count >= flagThreshold) {
      ticket.flagged = true;
      ticket.verified = true;
      await ticket.save();
      
      return res.json({
        message: 'Ticket verified successfully',
        warning: '⚠️ ATENȚIE: Acest bilet a fost deja validat anterior!',
        flagged: true,
        verification_count: ticket.verification_count,
        ticket: {
          id: ticket._id,
          nume: ticket.nume,
          telefon: ticket.telefon,
          tip_bilet: ticket.tip_bilet,
          verified: ticket.verified,
          verification_count: ticket.verification_count,
          flagged: ticket.flagged,
          first_verified: ticket.verification_history[0]?.timestamp,
          created_at: ticket.created_at
        }
      });
    }

    // Mark as verified for first time
    ticket.verified = true;
    await ticket.save();

    res.json({
      message: 'Ticket verified successfully',
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        verified: ticket.verified,
        verification_count: ticket.verification_count,
        created_at: ticket.created_at
      }
    });
  } catch (error) {
    console.error('Ticket verification error:', error);
    res.status(400).json({ error: 'Invalid QR code data' });
  }
});

// Verify ticket by phone number (for organizers)
app.post('/api/verify-ticket-by-phone', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Normalize the input phone number
    const normalizedPhone = normalizePhoneForSearch(phoneNumber);
    console.log('Normalized phone for search:', normalizedPhone);
    
    // Extract the core digits (last 9 digits for Romanian numbers)
    const phoneDigits = extractPhoneDigits(phoneNumber);
    console.log('Phone digits extracted:', phoneDigits);
    
    // Generate all possible formats for searching
    const searchFormats = [
      normalizedPhone,                                    // +40712345678
      normalizedPhone.replace('+', ''),                   // 40712345678
      normalizedPhone.replace('+40', '0'),                 // 0712345678
      normalizedPhone.replace('+40', ''),                  // 712345678
      phoneDigits,                                         // 712345678 (last 9 digits)
      '0' + phoneDigits,                                   // 0712345678
      '40' + phoneDigits,                                  // 40712345678
      '+40' + phoneDigits                                  // +40712345678
    ];
    
    // Remove duplicates and empty strings
    const uniqueFormats = [...new Set(searchFormats.filter(f => f && f.length > 0))];
    console.log('Search formats:', uniqueFormats);
    
    // Find tickets matching any of the patterns
    const tickets = await Ticket.find({
      $or: uniqueFormats.map(format => ({ telefon: format }))
        .concat([
          // Also try regex search on the last 9 digits
          { telefon: { $regex: new RegExp(phoneDigits + '$', 'i') } },
          { telefon: { $regex: new RegExp('0' + phoneDigits + '$', 'i') } },
          { telefon: { $regex: new RegExp('40' + phoneDigits + '$', 'i') } },
          { telefon: { $regex: new RegExp('\\+40' + phoneDigits + '$', 'i') } }
        ])
    }).sort({ created_at: -1 }); // Get most recent first
    
    console.log(`Found ${tickets.length} tickets matching phone number`);
    
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ error: 'Nu s-a găsit niciun bilet pentru acest număr de telefon' });
    }

    // If multiple tickets found, return them for user selection
    if (tickets.length > 1) {
      return res.json({
        multiple: true,
        count: tickets.length,
        tickets: tickets.map(t => ({
          id: t._id,
          nume: t.nume,
          telefon: t.telefon,
          tip_bilet: t.tip_bilet,
          verified: t.verified,
          verification_count: t.verification_count,
          created_at: t.created_at,
          group: t.group
        }))
      });
    }

    // Single ticket found - verify it directly
    const ticket = tickets[0];
    
    // Increment verification count
    ticket.verification_count += 1;
    
    // Add to verification history
    ticket.verification_history.push({
      timestamp: new Date(),
      verified: true
    });

    // Check if ticket has been verified multiple times (fraud detection)
    // For BAL + AFTER and BAL + AFTER VIP tickets, allow 2 successful reads before flagging (flag on 3rd)
    // For all other tickets, allow 1 successful read before flagging (flag on 2nd)
    const isDualAccessTicket = (ticket.tip_bilet === 'BAL + AFTER' || ticket.tip_bilet === 'BAL + AFTER VIP');
    const flagThreshold = isDualAccessTicket ? 3 : 2;
    if (ticket.verification_count >= flagThreshold) {
      ticket.flagged = true;
      ticket.verified = true;
      await ticket.save();
      
      return res.json({
        message: 'Ticket verified successfully',
        warning: '⚠️ ATENȚIE: Acest bilet a fost deja validat anterior!',
        flagged: true,
        verification_count: ticket.verification_count,
        ticket: {
          id: ticket._id,
          nume: ticket.nume,
          telefon: ticket.telefon,
          tip_bilet: ticket.tip_bilet,
          verified: ticket.verified,
          verification_count: ticket.verification_count,
          flagged: ticket.flagged,
          first_verified: ticket.verification_history[0]?.timestamp,
          created_at: ticket.created_at
        }
      });
    }

    // Mark as verified for first time
    ticket.verified = true;
    await ticket.save();

    res.json({
      message: 'Ticket verified successfully',
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        verified: ticket.verified,
        verification_count: ticket.verification_count,
        created_at: ticket.created_at
      }
    });
  } catch (error) {
    console.error('Ticket verification by phone error:', error);
    res.status(500).json({ error: 'Error verifying ticket by phone number' });
  }
});

// Verify a specific ticket by ID (for when multiple tickets are found)
app.post('/api/verify-ticket-by-id/:id', async (req, res) => {
  const ticketId = req.params.id;

  if (!ticketId) {
    return res.status(400).json({ error: 'Ticket ID is required' });
  }

  try {
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Nu s-a găsit biletul' });
    }

    // Increment verification count
    ticket.verification_count += 1;
    
    // Add to verification history
    ticket.verification_history.push({
      timestamp: new Date(),
      verified: true
    });

    // Check if ticket has been verified multiple times (fraud detection)
    const isDualAccessTicket = (ticket.tip_bilet === 'BAL + AFTER' || ticket.tip_bilet === 'BAL + AFTER VIP');
    const flagThreshold = isDualAccessTicket ? 3 : 2;
    
    if (ticket.verification_count >= flagThreshold) {
      ticket.flagged = true;
      ticket.verified = true;
      await ticket.save();
      
      return res.json({
        message: 'Ticket verified successfully',
        warning: '⚠️ ATENȚIE: Acest bilet a fost deja validat anterior!',
        flagged: true,
        verification_count: ticket.verification_count,
        ticket: {
          id: ticket._id,
          nume: ticket.nume,
          telefon: ticket.telefon,
          tip_bilet: ticket.tip_bilet,
          verified: ticket.verified,
          verification_count: ticket.verification_count,
          flagged: ticket.flagged,
          first_verified: ticket.verification_history[0]?.timestamp,
          created_at: ticket.created_at
        }
      });
    }

    // Mark as verified for first time
    ticket.verified = true;
    await ticket.save();

    res.json({
      message: 'Ticket verified successfully',
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        verified: ticket.verified,
        verification_count: ticket.verification_count,
        created_at: ticket.created_at
      }
    });
  } catch (error) {
    console.error('Ticket verification by ID error:', error);
    res.status(500).json({ error: 'Error verifying ticket' });
  }
});

// Delete ticket (only by creator or same group)
app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, group: req.user.group });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all tickets (for admin/organizer view)
app.get('/api/admin/tickets', authenticateToken, async (req, res) => {
  try {
    // Check if user is Administrator
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }
    
    const tickets = await Ticket.find({}).sort({ created_at: -1 }).populate('user_id', 'username');
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get tickets logs by group (for Administrator users only)
app.get('/api/admin/tickets-logs/:group', authenticateToken, async (req, res) => {
  try {
    // Check if user is Administrator
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const { group } = req.params;
    
    // Get all tickets for the specified group with creator info
    const tickets = await Ticket.find({ group: group })
      .sort({ created_at: -1 })
      .populate('user_id', 'username')
      .lean();

    // Format tickets with creator information
    const formattedTickets = tickets.map(ticket => ({
      id: ticket._id,
      nume: ticket.nume,
      telefon: ticket.telefon,
      tip_bilet: ticket.tip_bilet,
      group: ticket.group,
      verified: ticket.verified,
      verification_count: ticket.verification_count,
      sent: ticket.sent,
      active: ticket.active !== undefined ? ticket.active : true,
      created_at: ticket.created_at,
      creator_username: ticket.user_id ? ticket.user_id.username : 'Unknown',
      creator_id: ticket.user_id ? ticket.user_id._id : null
    }));

    res.json({
      success: true,
      group: group,
      tickets: formattedTickets,
      count: formattedTickets.length
    });
  } catch (error) {
    console.error('Error fetching ticket logs:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Get all groups
app.get('/api/admin/groups', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const groups = await Group.find({}).sort({ name: 1 });
    
    // Also get groups from existing tickets (for backward compatibility)
    const existingGroups = await Ticket.distinct('group');
    const allGroupNames = new Set([...groups.map(g => g.name), ...existingGroups]);
    
    // Create group objects for groups that don't exist in Group collection
    const groupList = Array.from(allGroupNames).map(name => {
      const dbGroup = groups.find(g => g.name === name);
      return dbGroup || { name, active: true, _id: null };
    });

    res.json({ success: true, groups: groupList });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Create new group
app.post('/api/admin/groups', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const { name, referral_code } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Check if group already exists
    const existingGroup = await Group.findOne({ name: name.trim() });
    if (existingGroup) {
      return res.status(400).json({ error: 'Group already exists' });
    }

    const groupData = { name: name.trim(), active: true };
    if (referral_code && referral_code.trim()) {
      groupData.referral_code = referral_code.trim();
    }

    const newGroup = await Group.create(groupData);
    res.json({ success: true, group: newGroup });
  } catch (error) {
    console.error('Error creating group:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Group name or referral code already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Update group status (activate/deactivate)
app.put('/api/admin/groups/:name/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const { name } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Active status (true/false) is required' });
    }

    // Update or create group
    const group = await Group.findOneAndUpdate(
      { name: name },
      { active: active },
      { upsert: true, new: true }
    );

    res.json({ success: true, group });
  } catch (error) {
    console.error('Error updating group status:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Update ticket status (activate/deactivate)
app.put('/api/admin/tickets/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Active status (true/false) is required' });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { active: active },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Get all users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const users = await User.find({}).select('-password').sort({ created_at: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin Tools - Update user status (activate/deactivate account)
app.put('/api/admin/users/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.group !== 'Administrator') {
      return res.status(403).json({ error: 'Access denied. Administrator access required.' });
    }

    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Active status (true/false) is required' });
    }

    // Prevent deactivating own account
    if (id === req.user.id && !active) {
      return res.status(400).json({ error: 'Nu poți dezactiva propriul cont' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { active: active },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get tickets with filtering by sent status
app.get('/api/tickets/filtered', authenticateToken, async (req, res) => {
  try {
    const { filter } = req.query; // 'all', 'sent', 'not-sent'
    
    let query = { group: req.user.group };
    
    switch(filter) {
      case 'sent':
        query.sent = true;
        break;
      case 'not-sent':
        query.sent = { $ne: true };
        break;
      case 'all':
      default:
        // No additional filter
        break;
    }
    
    const tickets = await Ticket.find(query).sort({ created_at: -1 }).populate('user_id', 'username');
    
    res.json({
      success: true,
      tickets,
      filter,
      count: tickets.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Destroy messaging service
  if (messagingService) {
    await messagingService.destroy();
    console.log('Alternative Messaging Service destroyed.');
  }
  
  // Close MongoDB connection
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});
