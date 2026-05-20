const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (use PostgreSQL for production)
const qrDatabase = new Map();

// Generate QR code
app.post('/api/qr/generate', async (req, res) => {
  try {
    const { content, customCode, qrDarkColor, qrLightColor } = req.body;
    const code = customCode || content;
    
    // Generate QR code as base64
    const qrImage = await QRCode.toDataURL(content, {
      color: {
        dark: qrDarkColor || '#000000',
        light: qrLightColor || '#FFFFFF'
      },
      width: 300,
      margin: 2
    });
    
    // Store in database
    qrDatabase.set(code, {
      code: code,
      content: content,
      destination_url: null,
      scan_count: 0,
      created_at: new Date().toISOString(),
      image: qrImage
    });
    
    res.json({
      success: true,
      code: code,
      content: content,
      image: qrImage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all QR codes
app.get('/api/qr/list', (req, res) => {
  const codes = Array.from(qrDatabase.values());
  res.json({ codes: codes });
});

// Update QR code destination
app.put('/api/qr/update/:code', (req, res) => {
  const { code } = req.params;
  const { destinationUrl } = req.body;
  
  if (qrDatabase.has(code)) {
    const qr = qrDatabase.get(code);
    qr.destination_url = destinationUrl;
    qrDatabase.set(code, qr);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'QR code not found' });
  }
});

// Delete QR code
app.delete('/api/qr/delete/:code', (req, res) => {
  const { code } = req.params;
  
  if (qrDatabase.has(code)) {
    qrDatabase.delete(code);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'QR code not found' });
  }
});

// Redirect handler (this is what users scan!)
app.get('/api/r/:code', (req, res) => {
  const { code } = req.params;
  
  if (qrDatabase.has(code)) {
    const qr = qrDatabase.get(code);
    qr.scan_count++;
    qrDatabase.set(code, qr);
    
    if (qr.destination_url) {
      res.redirect(qr.destination_url);
    } else {
      res.send(`
        <h1>QR Code: ${code}</h1>
        <p>This QR code is not yet configured.</p>
        <p>Please contact the administrator.</p>
      `);
    }
  } else {
    res.status(404).send('QR code not found');
  }
});

// Placeholder endpoint
app.get('/api/placeholder', (req, res) => {
  res.json({ 
    message: 'Luban Coffee QR System API',
    status: 'online',
    codes_count: qrDatabase.size
  });
});

// Server info
app.get('/api/server-info', (req, res) => {
  res.json({
    success: true,
    port: process.env.PORT || 3000,
    ip: req.headers.host,
    environment: 'vercel'
  });
});

module.exports = app;
