#!/bin/bash

# HNEE VPN API Test Script
# Tests the VPN connections endpoint with proper authentication

BASE_URL="http://10.1.1.45:5000"
COOKIE_FILE=".test-cookies"

echo "🧪 Testing VPN API with authentication..."

# Step 1: Login to get session cookie
echo "🔐 Step 1: Authenticating..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -w "%{http_code}" -X POST \
  "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "pbuchwald",
    "password": "#NC$GLU75#XV"
  }')

echo "Login Response: $LOGIN_RESPONSE"

# Check if login was successful (look for HTTP 200 status)
if echo "$LOGIN_RESPONSE" | grep -q '200$'; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

# Step 2: Test VPN connections endpoint
echo ""
echo "📡 Step 2: Testing VPN connections endpoint..."
VPN_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET \
  "$BASE_URL/api/vpn/connections" \
  -H "Accept: application/json")

echo "VPN Response:"
echo "$VPN_RESPONSE" | jq . 2>/dev/null || echo "$VPN_RESPONSE"

# Step 3: Test VPN stats endpoint (admin only)
echo ""
echo "📊 Step 3: Testing VPN stats endpoint..."
STATS_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET \
  "$BASE_URL/api/vpn/stats" \
  -H "Accept: application/json")

echo "Stats Response:"
echo "$STATS_RESPONSE" | jq . 2>/dev/null || echo "$STATS_RESPONSE"

# Cleanup
rm -f "$COOKIE_FILE"

echo ""
echo "🎯 Test completed!"
