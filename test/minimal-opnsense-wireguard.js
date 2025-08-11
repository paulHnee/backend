// Minimal Node.js script to GET /api/wireguard/service/show from OPNsense, ignoring SSL errors (like curl -k)

import https from 'https';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root or test folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const apiKey = process.env.OPNSENSE_API_KEY;
const apiSecret = process.env.OPNSENSE_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error('❌ OPNSENSE_API_KEY or OPNSENSE_API_SECRET not set in .env');
  process.exit(1);
}

const options = {
  hostname: process.env.OPNSENSE_HOST || 'vpn.hnee.de',
  port: process.env.OPNSENSE_PORT || 443,
  path: '/api/core/menu/tree',
  method: 'GET',
  rejectUnauthorized: false, // Ignore SSL errors (like curl -k)
  headers: {
    'Authorization': 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64'),
    'Accept': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
