const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/api/server-info', (req, res) => {
    res.json({
        success: true,
        ip: req.headers.host,
        port: 443,
        baseUrl: `https://${req.headers.host}`
    });
});
module.exports = app;
