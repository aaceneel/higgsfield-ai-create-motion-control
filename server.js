/**
 * Kling AI API Proxy Server
 * 
 * This server acts as a secure proxy between your frontend and the Kling AI API.
 * It keeps your API credentials safe and handles CORS issues.
 * 
 * Usage:
 * 1. npm install express cors dotenv jose
 * 2. node server.js
 * 3. Update VITE_KLING_API_BASE_URL in .env to http://localhost:3001/api/v1
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SignJWT } from 'jose';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

const ACCESS_KEY = process.env.VITE_KLING_ACCESS_KEY;
const SECRET_KEY = process.env.VITE_KLING_SECRET_KEY;
const KLING_API_BASE_URL = 'https://api.klingai.com';

// Public URL for file access (set via environment or detected from Cloudflare Tunnel)
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://naval-contained-trek-suggesting.trycloudflare.com';

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// JWT Token cache
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Generate JWT token for Kling AI authentication
 */
async function generateJWTToken() {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken;
  }

  const nbf = now - 5; // Not before: 5 seconds ago
  const exp = now + 1800; // Expires in 30 minutes

  // Convert secret key to Uint8Array
  const secret = new TextEncoder().encode(SECRET_KEY);

  // Create JWT token
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ACCESS_KEY)
    .setNotBefore(nbf)
    .setExpirationTime(exp)
    .sign(secret);

  cachedToken = token;
  tokenExpiry = exp;

  console.log('✅ Generated new JWT token');
  return token;
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Kling AI Proxy Server is running',
    configured: !!(ACCESS_KEY && SECRET_KEY),
    uploadsEnabled: true
  });
});

/**
 * File upload endpoint
 * POST /upload - Upload a single file and get a public URL
 */
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Use public URL (from localtunnel or env) instead of localhost
    const publicUrl = `${PUBLIC_URL}/uploads/${req.file.filename}`;

    console.log(`📤 File uploaded: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`🌐 Public URL: ${publicUrl}`);

    res.json({
      success: true,
      filename: req.file.filename,
      url: publicUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy all /api/v1/* requests to Kling AI API
 */
app.use('/api/v1', async (req, res) => {
  try {
    // Check if credentials are configured
    if (!ACCESS_KEY || !SECRET_KEY) {
      return res.status(500).json({
        error: 'API credentials not configured',
        message: 'Please set VITE_KLING_ACCESS_KEY and VITE_KLING_SECRET_KEY in your .env file'
      });
    }

    // Generate JWT token
    const token = await generateJWTToken();

    // Get the full path after /api
    const apiPath = req.originalUrl.replace('/api', '');

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Handle file uploads differently (FormData)
    let body;
    if (req.is('multipart/form-data') || req.is('application/x-www-form-urlencoded')) {
      // For file uploads, we need to handle FormData
      body = req.body;
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body);
    }

    console.log(`🔄 Proxying ${req.method} ${apiPath}`);
    
    // Log request payload for debugging
    if (body && req.method === 'POST') {
      console.log('📦 Request payload:', body.substring(0, 500));
    }

    // Make request to Kling AI API
    const response = await fetch(`${KLING_API_BASE_URL}${apiPath}`, {
      method: req.method,
      headers,
      body: body
    });

    // Get response data
    const data = await response.json();
    
    // Log response for debugging
    if (response.status !== 200) {
      console.log('❌ Error response:', JSON.stringify(data).substring(0, 300));
    }

    // Forward status code and data
    res.status(response.status).json(data);

    console.log(`✅ Response ${response.status} for ${req.method} ${apiPath}`);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      details: error.toString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Kling AI Proxy Server started');
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`🌐 Public: ${PUBLIC_URL}`);
  console.log(`🔒 API credentials: ${ACCESS_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📤 File uploads: ✅ Enabled at /upload`);
  console.log(`📁 Uploads folder: ${uploadsDir}`);
  console.log('');
  console.log('💡 Update your .env file:');
  console.log(`   VITE_KLING_API_BASE_URL=http://localhost:${PORT}/api/v1`);
  console.log('');
  console.log('🔍 Endpoints:');
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  console.log(`   - File upload: POST http://localhost:${PORT}/upload`);
  console.log(`   - Public uploads: ${PUBLIC_URL}/uploads/`);
});
