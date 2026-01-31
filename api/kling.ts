import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

const ACCESS_KEY = process.env.VITE_KLING_ACCESS_KEY;
const SECRET_KEY = process.env.VITE_KLING_SECRET_KEY;
const KLING_API_BASE_URL = 'https://api.klingai.com';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Generate JWT token for Kling AI authentication
 */
async function generateJWTToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken;
  }

  if (!SECRET_KEY || !ACCESS_KEY) {
    throw new Error('Missing API credentials');
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

  return token;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Debug: Log credential status (without exposing actual values)
    console.log(`[Kling Proxy] Credentials check - ACCESS_KEY: ${ACCESS_KEY ? 'SET (length: ' + ACCESS_KEY.length + ')' : 'MISSING'}, SECRET_KEY: ${SECRET_KEY ? 'SET (length: ' + SECRET_KEY.length + ')' : 'MISSING'}`);
    
    // Check if credentials are configured
    if (!ACCESS_KEY || !SECRET_KEY) {
      return res.status(500).json({
        error: 'API credentials not configured',
        message: 'Please set VITE_KLING_ACCESS_KEY and VITE_KLING_SECRET_KEY in environment variables'
      });
    }

    // Generate JWT token
    const token = await generateJWTToken();
    console.log(`[Kling Proxy] JWT token generated successfully (length: ${token.length})`);

    // Get the API path from the request query (Vercel catch-all routes)
    const pathParts = req.query.path;
    let apiPath = '';
    
    if (Array.isArray(pathParts)) {
      apiPath = '/' + pathParts.join('/');
    } else if (typeof pathParts === 'string') {
      apiPath = '/' + pathParts;
    }
    
    // Add /v1 prefix to match Kling API versioning
    const fullPath = `/v1${apiPath}`;
    
    console.log(`[Kling Proxy] ${req.method} ${fullPath} (query: ${JSON.stringify(req.query)})`);

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Prepare request body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = JSON.stringify(req.body);
    }

    // Make request to Kling AI API
    const response = await fetch(`${KLING_API_BASE_URL}${fullPath}`, {
      method: req.method as string,
      headers,
      body: body
    });

    console.log(`[Kling Proxy] Response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);

    // Get response content type
    const contentType = response.headers.get('content-type') || '';
    
    // Try to parse as JSON, but handle errors gracefully
    let data;
    const responseText = await response.text();
    
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[Kling Proxy] Failed to parse JSON:', e);
        data = { error: 'Invalid JSON response', raw: responseText.substring(0, 200) };
      }
    } else {
      // Not JSON - probably an error page
      console.error('[Kling Proxy] Received non-JSON response:', responseText.substring(0, 200));
      data = {
        error: 'Non-JSON response from API',
        status: response.status,
        contentType: contentType,
        preview: responseText.substring(0, 200)
      };
    }

    // Forward status code and data
    res.status(response.status).json(data);

    console.log(`[Kling Proxy] Response ${response.status} for ${req.method} ${fullPath}`);
  } catch (error) {
    console.error('[Kling Proxy] Error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
