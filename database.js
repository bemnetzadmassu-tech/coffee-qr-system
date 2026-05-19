const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use /tmp for Vercel, local folder for development
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel ? '/tmp/coffee_qr.db' : './coffee_qr.db';

const db = new sqlite3.Database(dbPath);

// Initialize all tables
db.serialize(() => {
    // QR Codes table - dynamic redirects
    db.run(`
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            data_type TEXT DEFAULT 'url',
            content TEXT NOT NULL,
            destination_url TEXT,
            scan_count INTEGER DEFAULT 0,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_scanned_at DATETIME
        )
    `);
    
    // Barcodes table
    db.run(`
        CREATE TABLE IF NOT EXISTS barcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode_value TEXT UNIQUE NOT NULL,
            product_name TEXT,
            product_price DECIMAL(10,2),
            scan_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Scan logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS scan_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            type TEXT CHECK(type IN ('qr', 'barcode')),
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT
        )
    `);
    
    console.log(`✅ Database initialized at: ${dbPath}`);
});

const dbHelpers = {
    // QR Code functions
    createQRCode: (code, dataType, content, destinationUrl) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO qr_codes (code, data_type, content, destination_url) VALUES (?, ?, ?, ?)`,
                [code, dataType, content, destinationUrl],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },
    
    getQRCode: (code) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM qr_codes WHERE code = ? AND active = 1`,
                [code],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    getAllQRCodes: () => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM qr_codes ORDER BY created_at DESC`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    updateQRCode: (code, destinationUrl) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE qr_codes SET destination_url = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?`,
                [destinationUrl, code],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },
    
    deleteQRCode: (code) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM qr_codes WHERE code = ?`, [code], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },
    
    incrementQRScan: (code) => {
        db.run(
            `UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP WHERE code = ?`,
            [code]
        );
    },
    
    // Barcode functions
    createBarcode: (value, productName, productPrice) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO barcodes (barcode_value, product_name, product_price) VALUES (?, ?, ?)`,
                [value, productName, productPrice],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },
    
    getAllBarcodes: () => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM barcodes ORDER BY created_at DESC`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    incrementBarcodeScan: (value) => {
        db.run(`UPDATE barcodes SET scan_count = scan_count + 1 WHERE barcode_value = ?`, [value]);
    },
    
    // Scan logging
    logScan: (code, type, ip, userAgent) => {
        db.run(
            `INSERT INTO scan_logs (code, type, ip_address, user_agent) VALUES (?, ?, ?, ?)`,
            [code, type, ip, userAgent]
        );
    },
    
    getStats: () => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    (SELECT COUNT(*) FROM qr_codes) as total_qr,
                    (SELECT COUNT(*) FROM barcodes) as total_barcodes,
                    (SELECT SUM(scan_count) FROM qr_codes) as total_qr_scans,
                    (SELECT SUM(scan_count) FROM barcodes) as total_barcode_scans
                `,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }
};

module.exports = dbHelpers;