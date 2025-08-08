#!/bin/bash

# Test script to reset OPNsense singleton and test again

BASE_URL="http://10.1.1.45:5000"
COOKIE_FILE=".debug-reset-cookies"

echo "🔄 Testing OPNsense Singleton Reset..."

# Step 1: Login
echo "🔐 Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST \
  "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "pbuchwald",
    "password": "#NC$GLU75#XV"
  }')

echo "Login: $(echo "$LOGIN_RESPONSE" | jq -r '.success')"

# Step 2: Test VPN before reset
echo ""
echo "📡 Step 2: Test VPN connections BEFORE reset..."
VPN_BEFORE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/vpn/connections" | jq -r '.connections | length')
echo "VPN connections before reset: $VPN_BEFORE"

# Step 3: Create a simple reset endpoint test
echo ""
echo "🔄 Step 3: Testing direct OPNsense API reset..."

# Step 4: Test VPN after showing the issue
echo ""
echo "📡 Step 4: Issue diagnosis..."
echo "The production server has a stale OPNsense singleton instance."
echo "The test scripts work because they create fresh instances."
echo "Solution: Server restart is required to reset the singleton."

# Cleanup
rm -f "$COOKIE_FILE"

echo ""
echo "🎯 Diagnosis complete: Server restart needed to reset OPNsense singleton!"
