const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create directories for generated files (Vercel uses /tmp)
const isVercel = process.env.VERCEL === '1';
const qrDir = isVercel ? '/tmp/qr-codes' : path.join(__dirname, 'qr-codes');
const barcodeDir = isVercel ? '/tmp/barcodes' : path.join(__dirname, 'barcodes');

if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
if (!fs.existsSync(barcodeDir)) fs.mkdirSync(barcodeDir, { recursive: true });

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// QR CODE ENDPOINTS
// ============================================

// Generate QR code
app.post('/api/qr/generate', async (req, res) => {
    try {
        const { 
            dataType = 'url',
            content,
            customCode,
            destinationUrl,
            qrDarkColor = '#4A2C1A',
            qrLightColor = '#F5E6D3'
        } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        const qrCode = customCode || generateShortCode();
        const finalDestination = destinationUrl || content;
        
        console.log(`📱 Generating QR: ${qrCode}`);
        
        const qrBuffer = await QRCode.toBuffer(content, {
            type: 'png',
            width: 500,
            margin: 2,
            color: { dark: qrDarkColor, light: qrLightColor },
            errorCorrectionLevel: 'H'
        });
        
        const qrBase64 = qrBuffer.toString('base64');
        
        await db.createQRCode(qrCode, dataType, content, finalDestination);
        
        res.json({
            success: true,
            code: qrCode,
            image: `data:image/png;base64,${qrBase64}`,
            content: content,
            destination: finalDestination
        });
        
    } catch (error) {
        console.error('QR error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function
function generateShortCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Redirect endpoint
app.get('/api/r/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        console.log(`📱 QR SCAN: ${code}`);
        
        const qrData = await db.getQRCode(code);
        
        if (!qrData) {
            return res.status(404).send('QR code not found');
        }
        
        await db.incrementQRScan(code);
        
        console.log(`🔄 Redirecting ${code} → ${qrData.destination_url}`);
        res.redirect(qrData.destination_url);
        
    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Server error');
    }
});

// List all QR codes
app.get('/api/qr/list', async (req, res) => {
    try {
        const codes = await db.getAllQRCodes();
        res.json({ success: true, codes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update QR code destination
app.put('/api/qr/update/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { destinationUrl } = req.body;
        
        const changes = await db.updateQRCode(code, destinationUrl);
        
        if (changes === 0) {
            return res.status(404).json({ error: 'QR code not found' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete QR code
app.delete('/api/qr/delete/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const changes = await db.deleteQRCode(code);
        
        if (changes === 0) {
            return res.status(404).json({ error: 'QR code not found' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Server info
app.get('/api/server-info', (req, res) => {
    const networkInterfaces = os.networkInterfaces();
    const ips = [];
    
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
                ips.push(iface.address);
            }
        }
    }
    
    res.json({
        success: true,
        ip: ips[0] || '127.0.0.1',
        port: PORT,
        isVercel: isVercel
    });
});

// Export for Vercel
module.exports = app;

// Start server (only when not running on Vercel)
if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}