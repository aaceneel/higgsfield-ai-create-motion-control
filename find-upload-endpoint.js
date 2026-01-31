/**
 * Search for file upload endpoints
 */

import { SignJWT } from 'jose';
import fetch from 'node-fetch';

const ACCESS_KEY = 'A4LDgYpYANAHfTbRHmLKFtR4DyhKHemM';
const SECRET_KEY = 'nHAyDQCpECJmgD8QBNrfJGY9PpYbR44P';
const API_BASE_URL = 'https://api.klingai.com';

async function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const secret = new TextEncoder().encode(SECRET_KEY);
  
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ACCESS_KEY)
    .setNotBefore(now - 5)
    .setExpirationTime(now + 1800)
    .sign(secret);
}

async function testEndpoint(path) {
  const token = await generateToken();
  
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const text = await response.text();
    
    if (response.status !== 404) {
      console.log(`✅ FOUND: ${path} - Status: ${response.status}`);
      console.log(`   Response: ${text.substring(0, 150)}`);
      return true;
    }
  } catch (error) {
    // Ignore errors
  }
  return false;
}

async function main() {
  console.log('\n🔍 Searching for upload endpoints...\n');
  
  const paths = [
    '/v1/upload',
    '/v1/upload/image',
    '/v1/upload/video',
    '/v1/asset/upload',
    '/v1/assets/upload',
    '/v1/media/upload',
    '/v1/files',
    '/v1/storage/upload',
    '/v1/oss/upload',
    '/v1/videos/upload',
    '/v1/images/upload',
  ];
  
  for (const path of paths) {
    await testEndpoint(path);
  }
  
  console.log('\n✅ Search complete\n');
}

main().catch(console.error);
