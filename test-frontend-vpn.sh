#!/bin/bash

# Test script to verify frontend receives VPN devices correctly

BASE_URL="http://10.1.1.45:5000"
COOKIE_FILE=".frontend-test-cookies"

echo "🌐 Testing Frontend VPN Integration..."

# Step 1: Login as pbuchwald (who has 7 VPN devices)
echo "🔐 Step 1: Login as pbuchwald..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST \
  "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "pbuchwald",
    "password": "#NC$GLU75#XV"
  }')

echo "Login successful: $(echo "$LOGIN_RESPONSE" | jq -r '.success')"
echo "User roles: $(echo "$LOGIN_RESPONSE" | jq -r '.user.roles[]' | tr '\n' ' ')"

# Step 2: Test exact frontend VPN connections call
echo ""
echo "📱 Step 2: Getting VPN connections (frontend perspective)..."
VPN_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET \
  "$BASE_URL/api/vpn/connections" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json")

echo "VPN connections found: $(echo "$VPN_RESPONSE" | jq -r '.connections | length')"
echo "User limit: $(echo "$VPN_RESPONSE" | jq -r '.limit')"
echo "Can create more: $(echo "$VPN_RESPONSE" | jq -r '.canCreateMore')"

# Show first few devices
echo ""
echo "📋 First 3 VPN devices:"
echo "$VPN_RESPONSE" | jq -r '.connections[0:3][] | "  - \(.name) (\(.platform)): \(.ipAddress)"'

# Step 3: Test monitoring endpoints for Reports page
echo ""
echo "📊 Step 3: Testing monitoring endpoint for Reports page..."
MONITORING_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET \
  "$BASE_URL/api/monitoring/stats" \
  -H "Accept: application/json")

if echo "$MONITORING_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "Monitoring stats: $(echo "$MONITORING_RESPONSE" | jq -r '.summary.totalVpnPeers // .vpn.totalPeers // "N/A"') total VPN peers"
else
  echo "Monitoring endpoint response: $MONITORING_RESPONSE"
fi

# Step 4: Test VPN stats for admin
echo ""
echo "📈 Step 4: Testing VPN admin stats..."
ADMIN_VPN_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET \
  "$BASE_URL/api/vpn/stats" \
  -H "Accept: application/json")

echo "Admin VPN stats total: $(echo "$ADMIN_VPN_RESPONSE" | jq -r '.stats.totalConnections')"
echo "Active connections: $(echo "$ADMIN_VPN_RESPONSE" | jq -r '.stats.activeConnections')"

# Cleanup
rm -f "$COOKIE_FILE"

echo ""
echo "🎯 Frontend integration test completed!"
