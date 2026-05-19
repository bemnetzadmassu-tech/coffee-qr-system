// ============================================
// AUTO-DETECT API URL - Works everywhere!
// ============================================
const API_URL = (() => {
    // Use the current window location (works with localhost, IP, Vercel, etc.)
    return window.location.origin;
})();

console.log('📍 API_URL:', API_URL);

// Store for later use
let currentQR = null;
let currentBarcode = null;

// ============================================
// API HOST MANAGEMENT WITH AUTO DETECTION
// ============================================

let currentApiHost = localStorage.getItem('apiHostType') || 'ip';
let currentIpAddress = localStorage.getItem('ipAddress') || '';
let currentCustomUrl = localStorage.getItem('customUrl') || '';

async function detectServerIP() {
    try {
        const response = await fetch(`${API_URL}/api/server-info`);
        const data = await response.json();
        
        if (data.success && data.ip) {
            localStorage.setItem('detectedIp', data.ip);
            localStorage.setItem('serverPort', data.port);
            
            const ipInput = document.getElementById('ip-address');
            if (ipInput && !ipInput.value) {
                ipInput.value = data.ip;
                currentIpAddress = data.ip;
                localStorage.setItem('ipAddress', data.ip);
            }
            
            console.log(`✅ Auto-detected server IP: ${data.ip}:${data.port}`);
            return data.ip;
        }
    } catch (error) {
        console.log('Could not auto-detect IP:', error);
        return null;
    }
}

function getApiBaseUrl() {
    const hostType = document.getElementById('api-host-type')?.value || currentApiHost;
    const detectedPort = localStorage.getItem('serverPort') || '3000';
    const detectedIp = localStorage.getItem('detectedIp') || '192.168.1.100';
    
    switch(hostType) {
        case 'localhost':
            return `http://localhost:${detectedPort}`;
        case 'ip':
            const ip = document.getElementById('ip-address')?.value || currentIpAddress || detectedIp;
            return `http://${ip}:${detectedPort}`;
        case 'vercel':
            return 'https://coffee-qr-system.vercel.app';
        case 'custom':
            return document.getElementById('custom-url')?.value || currentCustomUrl;
        default:
            return API_URL;
    }
}

function updateApiHost() {
    const hostType = document.getElementById('api-host-type')?.value;
    if (!hostType) return;
    
    currentApiHost = hostType;
    localStorage.setItem('apiHostType', hostType);
    
    const ipGroup = document.getElementById('ip-address-group');
    const customGroup = document.getElementById('custom-url-group');
    
    if (ipGroup) ipGroup.style.display = hostType === 'ip' ? 'block' : 'none';
    if (customGroup) customGroup.style.display = hostType === 'custom' ? 'block' : 'none';
    
    if (hostType === 'ip') {
        const savedIp = localStorage.getItem('ipAddress');
        const ipInput = document.getElementById('ip-address');
        if (savedIp && ipInput) ipInput.value = savedIp;
    }
    
    if (hostType === 'custom') {
        const savedUrl = localStorage.getItem('customUrl');
        const customInput = document.getElementById('custom-url');
        if (savedUrl && customInput) customInput.value = savedUrl;
    }
    
    updateApiInfoDisplay();
}

function updateApiInfoDisplay() {
    const baseUrl = getApiBaseUrl();
    const infoDiv = document.getElementById('current-api-info');
    if (infoDiv) {
        infoDiv.innerHTML = `
            Current API Base URL: <strong>${baseUrl}</strong><br>
            QR codes will redirect to: ${baseUrl}/api/r/YOUR_CODE
        `;
    }
}

function saveIpAddress() {
    const ip = document.getElementById('ip-address')?.value;
    if (ip) {
        localStorage.setItem('ipAddress', ip);
        currentIpAddress = ip;
        updateApiInfoDisplay();
        alert(`✅ IP Address saved: ${ip}`);
    }
}

function saveCustomUrl() {
    const url = document.getElementById('custom-url')?.value;
    if (url) {
        localStorage.setItem('customUrl', url);
        currentCustomUrl = url;
        updateApiInfoDisplay();
        alert(`✅ Custom URL saved: ${url}`);
    }
}

async function applyHostToAll() {
    const baseUrl = getApiBaseUrl();
    
    if (!confirm(`Apply ${baseUrl} to ALL QR codes?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/api/qr/list`);
        const data = await response.json();
        
        if (!data.codes || data.codes.length === 0) {
            alert('No QR codes found');
            return;
        }
        
        let updated = 0;
        for (const code of data.codes) {
            const newDestination = `${baseUrl}/api/r/${code.code}`;
            const updateResponse = await fetch(`${API_URL}/api/qr/update/${code.code}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destinationUrl: newDestination })
            });
            if (updateResponse.ok) updated++;
        }
        
        alert(`✅ Updated ${updated} of ${data.codes.length} QR codes`);
        loadQRCodes();
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function refreshCurrentHost() {
    updateApiInfoDisplay();
    loadQRCodes();
}

// ============================================
// GENERATE QR CODE - FIXED VERSION
// ============================================
async function generateQR() {
    const qrContent = document.getElementById('dest-url')?.value;
    const shortCode = document.getElementById('short-code')?.value;
    const qrDark = document.getElementById('qr-dark')?.value || '#4A2C1A';
    const qrLight = document.getElementById('qr-light')?.value || '#F5E6D3';
    
    if (!qrContent) {
        alert('Please enter QR Code ID (e.g., TEST001 or /scan/TEST001)');
        return;
    }
    
    console.log('📱 Generating QR with:', qrContent);
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${API_URL}/api/qr/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: qrContent,
                customCode: shortCode || qrContent.replace('/scan/', '').replace(/^\/+/, ''),
                dataType: 'url',
                qrDarkColor: qrDark,
                qrLightColor: qrLight
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        currentQR = data;
        
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="preview"><img src="${data.image}" alt="QR Code"></div>
                <p><strong>QR Contains:</strong> <code>${data.content}</code></p>
                <p><strong>Short Code:</strong> <code>${data.code}</code></p>
                <div class="success-box">
                    ✅ <strong>QR Code Generated!</strong><br><br>
                    Print this QR code on your coffee bags.<br>
                    Use the Manage tab to set where it redirects.<br>
                    <strong>You can change the destination ANYTIME without reprinting!</strong>
                </div>
                <button class="btn-secondary" onclick="downloadQR()">📥 Download QR Code</button>
            `;
            resultDiv.classList.add('show');
        }
        
        loadQRCodes();
        
    } catch (error) {
        console.error('Generate error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Generate QR Code';
    }
}

function downloadQR() {
    if (currentQR?.imageUrl) {
        window.open(currentQR.imageUrl);
    } else if (currentQR?.image) {
        const link = document.createElement('a');
        link.download = `${currentQR.code || 'qr'}.png`;
        link.href = currentQR.image;
        link.click();
    }
}

// ============================================
// LOAD AND MANAGE CODES
// ============================================
async function loadQRCodes() {
    try {
        const response = await fetch(`${API_URL}/api/qr/list`);
        const data = await response.json();
        
        const codesListDiv = document.getElementById('qr-codes-list');
        if (!codesListDiv) return;
        
        if (!data.codes || data.codes.length === 0) {
            codesListDiv.innerHTML = '<p>No QR codes yet. Generate some!</p>';
            return;
        }
        
        const apiBaseUrl = getApiBaseUrl();
        
        let html = '';
        for (const code of data.codes) {
            const fullRedirectUrl = `${apiBaseUrl}/api/r/${code.code}`;
            html += `
                <div class="code-item">
                    <div><strong>📱 ${code.code}</strong></div>
                    <div style="font-size: 12px; margin-top: 5px;">🎯 Current destination: ${code.destination_url || 'Not set'}</div>
                    <div style="font-size: 11px; color: #666; margin-top: 3px;">🔗 API redirect URL: ${fullRedirectUrl}</div>
                    <div style="font-size: 12px;">📊 Scans: ${code.scan_count || 0}</div>
                    <div style="margin-top: 10px;">
                        <input type="text" id="edit-${code.code}" placeholder="Final destination URL (e.g., https://google.com)" style="padding: 6px; width: 250px;">
                        <button class="btn-secondary" onclick="updateQRCode('${code.code}')">✏️ Update</button>
                        <button class="btn-danger" onclick="deleteQRCode('${code.code}')">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }
        codesListDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Load codes error:', error);
        const codesListDiv = document.getElementById('qr-codes-list');
        if (codesListDiv) codesListDiv.innerHTML = '<p>Error loading QR codes</p>';
    }
}

async function updateQRCode(code) {
    const newUrl = document.getElementById(`edit-${code}`)?.value;
    if (!newUrl) {
        alert('Enter a destination URL');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/qr/update/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinationUrl: newUrl })
        });
        
        if (response.ok) {
            alert(`✅ QR code ${code} now redirects to: ${newUrl}`);
            loadQRCodes();
        } else {
            alert('Update failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteQRCode(code) {
    if (!confirm(`Delete QR code ${code}?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/api/qr/delete/${code}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert(`✅ Deleted ${code}`);
            loadQRCodes();
        } else {
            alert('Delete failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Luban Coffee QR System...');
    console.log('📍 API URL:', API_URL);
    
    // Auto-detect server IP
    await detectServerIP();
    
    // Set API host selector
    const hostSelect = document.getElementById('api-host-type');
    if (hostSelect) {
        hostSelect.value = currentApiHost;
        updateApiHost();
    }
    
    // IP address input
    const ipInput = document.getElementById('ip-address');
    if (ipInput) {
        const savedIp = localStorage.getItem('ipAddress');
        if (savedIp) ipInput.value = savedIp;
        ipInput.addEventListener('change', saveIpAddress);
    }
    
    // Custom URL input
    const customUrlInput = document.getElementById('custom-url');
    if (customUrlInput) {
        customUrlInput.addEventListener('change', saveCustomUrl);
    }
    
    // Load data
    await loadQRCodes();
    updateApiInfoDisplay();
    
    console.log('✅ System ready!');
});