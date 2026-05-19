const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Database setup for Vercel (serverless)
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel ? '/tmp/qr_codes.db' : './qr_codes.db';
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            destination_url TEXT NOT NULL,
            scan_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function generateShortCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server info endpoint (FIXES the auto-detect error)
app.get('/api/server-info', (req, res) => {
    res.json({
        success: true,
        ip: req.headers.host || 'localhost',
        port: 443,
        baseUrl: `https://${req.headers.host}`
    });
});

// Placeholder endpoint (FIXES the placeholder error)
app.get('/api/placeholder', (req, res) => {
    res.json({
        placeholderDomain: 'qr.lubancoffee.com',
        baseUrl: `https://${req.headers.host}`,
        message: 'Your QR codes contain only the ID you enter'
    });
});

// Generate QR code
app.post('/api/qr/generate', async (req, res) => {
    try {
        const { content, customCode, qrDarkColor = '#000000', qrLightColor = '#FFFFFF' } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        const finalShortCode = customCode || generateShortCode();
        
        const qrBuffer = await QRCode.toBuffer(content, {
            type: 'png',
            width: 500,
            margin: 2,
            color: { dark: qrDarkColor, light: qrLightColor },
            errorCorrectionLevel: 'H'
        });
        
        const qrBase64 = qrBuffer.toString('base64');
        
        db.run(
            'INSERT INTO qr_codes (code, destination_url) VALUES (?, ?)',
            [finalShortCode, content],
            (err) => {
                if (err) {
                    return res.status(400).json({ error: 'Short code already exists' });
                }
                
                res.json({
                    success: true,
                    code: finalShortCode,
                    image: `data:image/png;base64,${qrBase64}`,
                    content: content,
                    destination: content
                });
            }
        );
        
    } catch (error) {
        console.error('QR error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Redirect endpoint
app.get('/api/r/:code', (req, res) => {
    const { code } = req.params;
    
    db.get('SELECT * FROM qr_codes WHERE code = ?', [code], (err, row) => {
        if (err || !row) {
            return res.status(404).send('QR code not found');
        }
        
        db.run('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE code = ?', [code]);
        res.redirect(row.destination_url);
    });
});

// List all codes
app.get('/api/qr/list', (req, res) => {
    db.all('SELECT * FROM qr_codes ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, codes: rows });
    });
});

// Update destination
app.put('/api/qr/update/:code', (req, res) => {
    const { code } = req.params;
    const { destinationUrl } = req.body;
    
    db.run(
        'UPDATE qr_codes SET destination_url = ? WHERE code = ?',
        [destinationUrl, code],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Code not found' });
            res.json({ success: true });
        }
    );
});

// Delete code
app.delete('/api/qr/delete/:code', (req, res) => {
    const { code } = req.params;
    
    db.run('DELETE FROM qr_codes WHERE code = ?', [code], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Code not found' });
        res.json({ success: true });
    });
});

// Serve static files from public directory
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// For any other route, serve index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(publicPath, 'index.html'));
    }
});

module.exports = app;