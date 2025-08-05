# OPNsense API Setup for HNEE VPN Portal

## 🔧 Setting up OPNsense API Access

### Step 1: Create API User in OPNsense
1. Log into your OPNsense web interface: https://vpn.hnee.de
2. Go to **System > Access > Users**
3. Create a new user (e.g., `api-hnee-portal`) or use existing
4. Assign appropriate privileges:
   - **API: Core: System Status** (for system info)
   - **API: WireGuard** (for VPN peer information)
   - **WebCfg - Status: Services** (for service status)

### Step 2: Generate API Key
1. Edit the user you created
2. Go to **API Keys** tab
3. Click **+** to generate new API key/secret pair
4. **IMPORTANT**: Copy both the key and secret immediately!

### Step 3: Configure Backend
Add to your `.env` file:
```bash
# OPNsense API Configuration
OPNSENSE_API_KEY=your_generated_api_key_here
OPNSENSE_API_SECRET=your_generated_api_secret_here
```

## 🔍 Available API Endpoints

### System Status
```bash
GET /api/core/system/status
# Returns: CPU, memory, uptime, load average
```

### WireGuard Service Status
```bash
GET /api/wireguard/service/status
# Returns: service running status
```

### WireGuard Peer Information
```bash
GET /api/wireguard/service/show
# Returns: active peers, traffic, handshakes
```

### Interface Statistics
```bash
GET /api/interfaces/overview/export
# Returns: network interface statistics
```

## 🧪 Testing API Access

Once configured, test with curl:
```bash
# Replace KEY:SECRET with your actual credentials
curl -k -u "KEY:SECRET" https://vpn.hnee.de/api/core/system/status
```

## 📊 What You'll Get

With this setup, your portal will show **real data**:
- ✅ Actual VPN server status
- ✅ Number of active WireGuard peers
- ✅ Server load and uptime
- ✅ Data transfer statistics
- ✅ Last handshake times

## 🔒 Security Notes

- API keys have the same privileges as the user
- Use dedicated API user with minimal required permissions
- Store credentials securely in environment variables
- Consider IP restrictions in OPNsense firewall rules

## 🚨 Fallback Behavior

If API is unavailable, the system falls back to:
- Ping connectivity check
- Mock data with clear indication
- Error logging for debugging
