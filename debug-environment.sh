#!/bin/bash

# Debug script to test environment difference

echo "🔍 Environment Debugging..."

echo ""
echo "📋 Test 1: Direct test environment..."
cd /Users/itsz/Documents/combind/backend
node -e "
import 'dotenv/config';
console.log('OPNSENSE_HOST:', process.env.OPNSENSE_HOST);
console.log('OPNSENSE_TIMEOUT:', process.env.OPNSENSE_TIMEOUT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
" 2>/dev/null

echo ""
echo "📋 Test 2: Web server response for reference..."
curl -s -b .debug-cookies "http://10.1.1.45:5000/api/vpn/connections" | jq '.count'

echo ""
echo "📋 Test 3: Quick direct OPNsense test..."
node debug-opnsense-urls.js 2>/dev/null | grep -E "(Total clients|timeout|configured)"

echo ""
echo "🎯 Environment comparison complete!"
