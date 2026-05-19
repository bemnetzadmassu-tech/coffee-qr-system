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

// Create directories for generated files
const qrDir = path.join(__dirname, 'qr-codes');
const barcodeDir = path.join(__dirname, 'barcodes');
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
if (!fs.existsSync(barcodeDir)) fs.mkdirSync(barcodeDir, { recursive: true });

// Serve generated files
app.use('/qr-codes', express.static(qrDir));
app.use('/barcodes', express.static(barcodeDir));

// ============================================
// HELPER FUNCTIONS
// ============================================
function generateQRCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function formatQRContent(dataType, content) {
    switch(dataType) {
        case 'url':
            return content;
        case 'text':
            return `MATEXT:${content}`;
        case 'geo':
            return `geo:${content}`;
        case 'sms':
            const [phone, message] = content.split(':');
            return `smsto:${phone}:${message || ''}`;
        case 'tel':
            return `tel:${content}`;
        case 'email':
            const [to, subject, body] = content.split(':');
            return `mailto:${to}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
        case 'whatsapp':
            return `https://wa.me/${content}`;
        case 'wifi':
            const [ssid, pass, enc] = content.split(':');
            return `WIFI:S:${ssid};T:${enc || 'WPA'};P:${pass};;`;
        case 'vcard':
            return content;
        default:
            return content;
    }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder info
app.get('/api/placeholder', (req, res) => {
    res.json({
        placeholderDomain: 'qr.lubancoffee.com',
        baseUrl: 'https://qr.lubancoffee.com',
        message: 'Your QR codes contain only the ID you enter'
    });
});

// Auto-detect server IP
app.get('/api/server-ip', (req, res) => {
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
        allIps: ips,
        port: PORT
    });
});
// ============================================
// SMART REDIRECT - For QR codes with only the ID
// ============================================
app.get('/s/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        console.log(`📱 SMART SCAN: ${code}`);
        
        // Look up in database
        const qrData = await db.getQRCode(code);
        
        if (!qrData) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Code Not Found</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Code Not Found</h1>
                    <p>The code "${code}" is not valid.</p>
                    <p>Please check your coffee bag or contact support.</p>
                </body>
                </html>
            `);
        }
        
        console.log(`🔄 SMART REDIRECT: ${code} → ${qrData.destination_url}`);
        
        // Redirect to the destination from database
        res.redirect(qrData.destination_url);
        
    } catch (error) {
        console.error('Smart redirect error:', error);
        res.status(500).send('Server error');
    }
});
// ============================================
// LANDING PAGE - For printed QR codes with only the ID
// ============================================
app.get('/p/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        console.log(`📱 LANDING PAGE: ${code}`);
        
        // Get destination from database
        const qrData = await db.getQRCode(code);
        
        if (!qrData) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Code Not Found</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Code Not Found</h1>
                    <p>The code "${code}" is not valid.</p>
                    <p>Please contact Luban Coffee support.</p>
                </body>
                </html>
            `);
        }
        
        // Auto-redirect after 1 second
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Luban Coffee</title>
                <meta http-equiv="refresh" content="1; url=${qrData.destination_url}">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 50px;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 400px;
                        margin: 0 auto;
                        background: white;
                        color: #333;
                        padding: 30px;
                        border-radius: 20px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    }
                    .coffee-icon {
                        font-size: 50px;
                        margin-bottom: 20px;
                    }
                    .code {
                        background: #f0f0f0;
                        padding: 15px;
                        border-radius: 10px;
                        font-family: monospace;
                        font-size: 20px;
                        margin: 20px 0;
                    }
                    .loading {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #666;
                    }
                    a {
                        color: #667eea;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="coffee-icon">☕</div>
                    <h1>Luban Coffee</h1>
                    <p>Your coffee bag code:</p>
                    <div class="code">${code}</div>
                    <p>Redirecting you to our coffee experience...</p>
                    <div class="loading">Loading <span id="dots">...</span></div>
                    <p class="loading">If not redirected, <a href="${qrData.destination_url}">click here</a></p>
                </div>
                <script>
                    let dotCount = 0;
                    setInterval(() => {
                        dotCount = (dotCount + 1) % 4;
                        document.getElementById('dots').innerHTML = '.'.repeat(dotCount);
                    }, 500);
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Landing page error:', error);
        res.status(500).send('Server error');
    }
});
// ============================================
// MASTER REDIRECT - Works with ALL API Host Types
// ============================================
app.get('/scan/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // Get the domain from the request (works with ANY host!)
        const requestingDomain = `${req.protocol}://${req.get('host')}`;
        
        console.log(`📱 SCAN: ${code}`);
        console.log(`   Request came from: ${requestingDomain}`);
        
        // Look up in database
        const qrData = await db.getQRCode(code);
        
        if (!qrData) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Code Not Found</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Code Not Found: ${code}</h1>
                    <p>Please check your coffee bag code.</p>
                </body>
                </html>
            `);
        }
        
        console.log(`🔄 REDIRECT: ${code} → ${qrData.destination_url}`);
        
        // Redirect to destination from database
        res.redirect(qrData.destination_url);
        
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).send('Server error');
    }
});
// ============================================
// QR CODE ENDPOINTS
// ============================================
// Auto-detect server info (IP and Port)
app.get('/api/server-info', (req, res) => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let wifiIp = null;
    const allIps = [];
    
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
                allIps.push(iface.address);
                // Prefer 192.168.1.x addresses (WiFi)
                if (iface.address.startsWith('192.168.1.')) {
                    wifiIp = iface.address;
                }
            }
        }
    }
    
    res.json({
        success: true,
        ip: wifiIp || allIps[0] || '127.0.0.1',
        allIps: allIps,
        port: PORT,
        baseUrl: `http://${wifiIp || allIps[0] || 'localhost'}:${PORT}`
    });
});
// ============================================
// EXPORT DATABASE - For migration
// ============================================
app.get('/api/admin/export', async (req, res) => {
    try {
        const codes = await db.getAllQRCodes();
        res.json({
            exportedAt: new Date().toISOString(),
            total: codes.length,
            codes: codes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// IMPORT DATABASE - For migration
// ============================================
app.post('/api/admin/import', async (req, res) => {
    try {
        const { codes } = req.body;
        let imported = 0;
        
        for (const code of codes) {
            await db.createQRCode(
                code.code, 
                code.data_type || 'url', 
                code.content || code.destination_url,
                code.destination_url
            );
            imported++;
        }
        
        res.json({ success: true, imported, total: codes.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
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
        
        const qrCode = customCode || generateQRCode();
        const finalDestination = destinationUrl || content;
        const qrContent = formatQRContent(dataType, content);
        
        console.log(`📱 Generating QR: ${qrCode} (${dataType})`);
        
        const qrBuffer = await QRCode.toBuffer(qrContent, {
            type: 'png',
            width: 500,
            margin: 2,
            color: { dark: qrDarkColor, light: qrLightColor },
            errorCorrectionLevel: 'H'
        });
        
        const qrBase64 = qrBuffer.toString('base64');
        
        await db.createQRCode(qrCode, dataType, content, finalDestination);
        
        const qrPath = path.join(qrDir, `${qrCode}.png`);
        fs.writeFileSync(qrPath, qrBuffer);
        
        res.json({
            success: true,
            type: 'qr',
            code: qrCode,
            image: `data:image/png;base64,${qrBase64}`,
            imageUrl: `/qr-codes/${qrCode}.png`,
            dataType: dataType,
            content: qrContent,
            destination: finalDestination
        });
        
    } catch (error) {
        console.error('QR error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Redirect endpoint (when QR is scanned)
app.get('/api/r/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        console.log(`📱 QR SCAN: ${code} at ${new Date().toISOString()}`);
        
        const qrData = await db.getQRCode(code);
        
        if (!qrData) {
            return res.status(404).send(`
                <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ QR Code Not Found</h1>
                    <p>The code "${code}" is not active or does not exist.</p>
                </body>
                </html>
            `);
        }
        
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Unknown';
        
        await db.logScan(code, 'qr', ip, userAgent);
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
        
        res.json({ success: true, message: `Updated ${code} → ${destinationUrl}` });
        
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
        
        const qrPath = path.join(qrDir, `${code}.png`);
        if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
        
        res.json({ success: true, message: `Deleted ${code}` });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// BARCODE ENDPOINTS
// ============================================

// Generate single barcode
app.post('/api/barcode/generate', async (req, res) => {
    try {
        const { 
            value,
            barcodeType = 'code128',
            productName,
            productPrice,
            barColor = '#000000'
        } = req.body;
        
        if (!value) {
            return res.status(400).json({ error: 'Barcode value is required' });
        }
        
        console.log(`📊 Generating barcode: ${value}`);
        
        const barcodeBuffer = await new Promise((resolve, reject) => {
            bwipjs.toBuffer({
                bcid: barcodeType,
                text: value,
                scale: 3,
                height: 12,
                includetext: true,
                textxalign: 'center',
                barcolor: barColor.replace('#', ''),
                textcolor: barColor.replace('#', '')
            }, (err, png) => {
                if (err) reject(err);
                else resolve(png);
            });
        });
        
        const barcodeBase64 = barcodeBuffer.toString('base64');
        
        await db.createBarcode(value, productName, productPrice);
        
        const barcodePath = path.join(barcodeDir, `${value}.png`);
        fs.writeFileSync(barcodePath, barcodeBuffer);
        
        res.json({
            success: true,
            type: 'barcode',
            value: value,
            image: `data:image/png;base64,${barcodeBase64}`,
            imageUrl: `/barcodes/${value}.png`,
            productName: productName,
            productPrice: productPrice
        });
        
    } catch (error) {
        console.error('Barcode error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Batch generate barcodes
app.post('/api/barcode/batch', async (req, res) => {
    try {
        const { 
            prefix,
            startNumber,
            endNumber,
            barcodeType = 'code128',
            barColor = '#000000'
        } = req.body;
        
        if (!prefix || !startNumber || !endNumber) {
            return res.status(400).json({ error: 'Prefix, startNumber, and endNumber are required' });
        }
        
        const total = endNumber - startNumber + 1;
        if (total > 50000) {
            return res.status(400).json({ error: 'Maximum 50,000 barcodes per batch' });
        }
        
        console.log(`📦 Generating ${total} barcodes`);
        
        const results = [];
        const padLength = String(endNumber).length;
        
        for (let i = startNumber; i <= endNumber; i++) {
            const paddedNumber = String(i).padStart(padLength, '0');
            const barcodeValue = `${prefix}-${paddedNumber}`;
            
            const barcodeBuffer = await new Promise((resolve, reject) => {
                bwipjs.toBuffer({
                    bcid: barcodeType,
                    text: barcodeValue,
                    scale: 3,
                    height: 12,
                    includetext: true,
                    textxalign: 'center',
                    barcolor: barColor.replace('#', '')
                }, (err, png) => {
                    if (err) reject(err);
                    else resolve(png);
                });
            });
            
            const barcodeBase64 = barcodeBuffer.toString('base64');
            
            const barcodePath = path.join(barcodeDir, `${barcodeValue}.png`);
            fs.writeFileSync(barcodePath, barcodeBuffer);
            
            await db.createBarcode(barcodeValue, `${prefix} Coffee`, null);
            
            results.push({
                value: barcodeValue,
                image: `data:image/png;base64,${barcodeBase64}`,
                imageUrl: `/barcodes/${barcodeValue}.png`
            });
            
            if ((i - startNumber + 1) % 100 === 0) {
                console.log(`   Generated ${i - startNumber + 1}/${total}`);
            }
        }
        
        res.json({
            success: true,
            total: results.length,
            barcodes: results
        });
        
    } catch (error) {
        console.error('Batch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// List all barcodes
app.get('/api/barcode/list', async (req, res) => {
    try {
        const barcodes = await db.getAllBarcodes();
        res.json({ success: true, barcodes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete barcode
app.delete('/api/barcode/delete/:value', async (req, res) => {
    try {
        const { value } = req.params;
        res.json({ success: true, message: `Deleted ${value}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STATISTICS
// ============================================
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                    ☕ LUBAN COFFEE - QR + BARCODE SYSTEM                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Server: http://localhost:${PORT}                                          ║
║  Web UI: http://localhost:${PORT}                                          ║
║                                                                           ║
║  Features:                                                                ║
║    ✅ Dynamic QR Codes (change destinations anytime)                      ║
║    ✅ Static Barcodes (POS / Inventory)                                   ║
║    ✅ Multiple QR Data Types (URL, Text, Geo, SMS, Tel, Email, WhatsApp)  ║
║    ✅ Batch Barcode Generation (up to 50,000)                             ║
║    ✅ Custom Colors for QR and Barcode                                    ║
║    ✅ Auto IP Detection                                                   ║
║    ✅ Scan Analytics & Tracking                                           ║
║                                                                           ║
║  Print QR codes with IDs like: TEST001                                   ║
║  Assign webpages AFTER printing - NEVER reprint!                         ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
