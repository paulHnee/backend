# OPNsense WireGuard API Endpoints

This document describes the correct OPNsense API endpoint structure for WireGuard management.

## 🎯 **Corrected API Structure**

Based on the actual OPNsense API organization, the WireGuard endpoints are structured as follows:

### **Service Management**
```
POST /api/wireguard/service/status    - Get service status
POST /api/wireguard/service/start     - Start WireGuard service  
POST /api/wireguard/service/stop      - Stop WireGuard service
POST /api/wireguard/service/restart   - Restart WireGuard service
```

### **Server Configuration**
```
POST /api/wireguard/server/searchServer   - Search/list servers
POST /api/wireguard/server/getServer      - Get specific server
POST /api/wireguard/server/addServer      - Add new server
POST /api/wireguard/server/delServer      - Delete server
POST /api/wireguard/server/setServer      - Update server config
```

### **Client Configuration**
```
POST /api/wireguard/client/searchClient   - Search/list clients
POST /api/wireguard/client/getClient      - Get specific client
POST /api/wireguard/client/addClient      - Add new client
POST /api/wireguard/client/delClient      - Delete client
POST /api/wireguard/client/setClient      - Update client config
```

### **General Settings**
```
POST /api/wireguard/general/get           - Get general settings
POST /api/wireguard/general/set           - Update general settings
```

## 🔧 **Implementation in Admin Controller**

Our updated controller now uses the correct API structure:

### **Current Functions:**
- `getPortalStats()` - Uses `/api/wireguard/service/status` for service monitoring
- `getWireGuardPeers()` - Uses multiple endpoints for comprehensive configuration
- `getWireGuardServiceStatus()` - Uses `/api/wireguard/service/status`
- `getWireGuardGeneral()` - Uses `/api/wireguard/general/get`

### **API Endpoints Exposed:**
```
GET  /api/admin/stats                    - Portal dashboard with real VPN status
GET  /api/admin/wireguard/peers          - Complete WireGuard configuration
GET  /api/admin/wireguard/service        - Service status only
GET  /api/admin/wireguard/general        - General WireGuard settings
POST /api/admin/ldap/sync                - LDAP synchronization
```

## 📊 **Response Format Examples**

### **Service Status Response:**
```json
{
  "success": true,
  "service": {
    "running": true,
    "status": {
      "isRunning": true,
      // Additional OPNsense service data
    }
  },
  "timestamp": "2025-08-05T09:12:29.194Z"
}
```

### **Complete Configuration Response:**
```json
{
  "success": true,
  "service": {
    "running": true,
    "status": { /* service status */ }
  },
  "servers": [
    {
      "uuid": "server-uuid",
      "name": "Main VPN Server",
      "enabled": true,
      "port": "51820",
      "address": "10.0.0.1/24",
      "pubkey": "server-public-key",
      "peers": []
    }
  ],
  "clients": [
    {
      "uuid": "client-uuid", 
      "name": "User Client",
      "enabled": true,
      "pubkey": "client-public-key",
      "address": "10.0.0.2/32",
      "serveruuid": "server-uuid",
      "keepalive": "25"
    }
  ],
  "statistics": {
    "totalServers": 1,
    "enabledServers": 1,
    "totalClients": 1,
    "enabledClients": 1
  },
  "general": { /* general settings */ },
  "timestamp": "2025-08-05T09:12:29.194Z"
}
```

## 🚀 **Performance Improvements**

- **Faster Timeouts**: 30s timeout with 3 retries
- **Smart Fallbacks**: Ping → API → Port check → Error
- **Efficient Caching**: Service status cached in portal stats
- **Parallel Requests**: Multiple API calls when needed

## 🔐 **Authentication**

All endpoints require:
- Basic Auth with OPNsense API key/secret
- POST method with JSON body (even for read operations)
- Proper Content-Type headers

## 🎯 **Next Steps**

With the correct API structure implemented, you can now:
1. Set proper API credentials in environment variables
2. Test real API responses from your OPNsense server
3. Add client management functions if needed
4. Implement service control functions for admin users

The controller is now properly aligned with OPNsense's actual API structure!
