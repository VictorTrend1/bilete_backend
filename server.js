const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const path = require('path');
require('dotenv').config();
const { MONGODB_URI } = require('./config');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
  group: { type: String, required: true, trim: true }
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


// Group mapping for referral codes (SECRET - only known by organizers)
const GROUP_CODES = {
  'BAL2025ECON': 'Bal Economic',
  'BAL2025CARA': 'Bal Carabella'
};

const User = mongoose.model('User', userSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

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
    const qrCodeDataURL = await QRCode.toDataURL(qrData);
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
    const ticket = await Ticket.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const qrCodeDataURL = await QRCode.toDataURL(ticket.qr_code);
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
    const buffer = await QRCode.toBuffer(ticket.qr_code, { type: 'png' });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (e) {
    res.status(500).send('Failed to render QR');
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

// Verify ticket (for organizers)
app.post('/api/verify-ticket', async (req, res) => {
  const { qrData } = req.body;

  if (!qrData) {
    return res.status(400).json({ error: 'QR code data is required' });
  }

  try {
    JSON.parse(qrData);
    const ticket = await Ticket.findOneAndUpdate({ qr_code: qrData }, { verified: true }, { new: true });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({
      message: 'Ticket verified successfully',
      ticket: {
        id: ticket._id,
        nume: ticket.nume,
        telefon: ticket.telefon,
        tip_bilet: ticket.tip_bilet,
        verified: ticket.verified,
        created_at: ticket.created_at
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid QR code data' });
  }
});

// Get all tickets (for admin/organizer view)
app.get('/api/admin/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({}).sort({ created_at: 1 }).populate('user_id', 'username');
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});
