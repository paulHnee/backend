/**
 * Simplified AdminController - Service Portal Management
 * 
 * This controller provides essential admin functions for the HNEE Service Portal.
 * Focused on service management rather than system administration.
 * 
 * Features:
 * - Service status monitoring with real OPNsense API data
 * - User limit management
 * - Emergency service controls
 * - Simple audit logging
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 2.0.0 (Simplified)
 */

import { logSecurityEvent } from '../utils/securityLogger.js';

// OPNsense API configuration
const OPNSENSE_CONFIG = {
  host: 'vpn.hnee.de',
  apiKey: process.env.OPNSENSE_API_KEY || '',
  apiSecret: process.env.OPNSENSE_API_SECRET || '',
  timeout: 5000
};

// Service status tracking
let serviceStatus = {
  vpn: { enabled: true, message: '' },
  portal: { enabled: true, message: '' },
  lastUpdated: new Date().toISOString()
};

/**
 * Make authenticated request to OPNsense API
 */
const opnsenseRequest = async (endpoint) => {
  try {
    if (!OPNSENSE_CONFIG.apiKey || !OPNSENSE_CONFIG.apiSecret) {
      throw new Error('OPNsense API credentials not configured');
    }

    const auth = Buffer.from(`${OPNSENSE_CONFIG.apiKey}:${OPNSENSE_CONFIG.apiSecret}`).toString('base64');
    
    const response = await fetch(`https://${OPNSENSE_CONFIG.host}/api/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(OPNSENSE_CONFIG.timeout)
    });

    if (!response.ok) {
      throw new Error(`OPNsense API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('OPNsense API request failed:', error);
    return null;
  }
};

/**
 * Get real VPN status from OPNsense
 */
const getVPNServerStatus = async () => {
  try {
    // Check if WireGuard service is running
    const wireguardStatus = await opnsenseRequest('wireguard/service/status');
    
    // Get WireGuard peer information
    const peers = await opnsenseRequest('wireguard/service/show');
    
    // Get system status
    const systemStatus = await opnsenseRequest('core/system/status');
    
    if (!wireguardStatus && !peers && !systemStatus) {
      // Fallback to basic connectivity check
      const pingResult = await checkServerConnectivity();
      return {
        serverReachable: pingResult,
        serviceRunning: pingResult, // Assume service is running if reachable
        activeConnections: 0,
        serverStatus: pingResult ? 'healthy' : 'unreachable',
        lastChecked: new Date().toISOString(),
        dataSource: 'connectivity-check'
      };
    }

    // Parse OPNsense data
    const activeConnections = peers?.peers ? Object.keys(peers.peers).length : 0;
    const serviceRunning = wireguardStatus?.status === 'running';
    
    return {
      serverReachable: true,
      serviceRunning: serviceRunning,
      activeConnections: activeConnections,
      serverStatus: serviceRunning ? 'healthy' : 'service-down',
      systemLoad: systemStatus?.load_avg?.[0] || 'unknown',
      uptime: systemStatus?.uptime || 'unknown',
      lastChecked: new Date().toISOString(),
      dataSource: 'opnsense-api'
    };

  } catch (error) {
    console.error('Error getting VPN server status:', error);
    
    // Fallback to ping check
    const pingResult = await checkServerConnectivity();
    return {
      serverReachable: pingResult,
      serviceRunning: false,
      activeConnections: 0,
      serverStatus: pingResult ? 'api-error' : 'unreachable',
      error: error.message,
      lastChecked: new Date().toISOString(),
      dataSource: 'fallback'
    };
  }
};

/**
 * Basic server connectivity check
 */
const checkServerConnectivity = async () => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout, stderr } = await execAsync('ping -c 2 -W 2000 vpn.hnee.de');
    
    // Check if we got any successful packets (handle both "packet" and "packets")
    const successMatch = stdout.match(/(\d+) packets? transmitted, (\d+) (?:packets? )?received/);
    if (successMatch) {
      const [, transmitted, received] = successMatch;
      return parseInt(received) > 0;
    }
    
    return false;
  } catch (error) {
    console.error('Ping failed:', error.message);
    return false;
  }
};

/**
 * Get service portal statistics with real OPNsense data
 */
export const getPortalStats = async (req, res) => {
  try {
    // Get real VPN server status
    const vpnStatus = await getVPNServerStatus();
    
    const stats = {
      vpn: {
        totalConnections: vpnStatus.activeConnections || 0,
        activeConnections: vpnStatus.activeConnections || 0,
        serverStatus: vpnStatus.serverStatus,
        serverReachable: vpnStatus.serverReachable,
        serviceRunning: vpnStatus.serviceRunning,
        systemLoad: vpnStatus.systemLoad,
        uptime: vpnStatus.uptime,
        lastChecked: vpnStatus.lastChecked,
        dataSource: vpnStatus.dataSource
      },
      users: {
        activeToday: 45, // This would come from your application database
        totalRegistered: 234 // This would come from LDAP or your database
      },
      services: serviceStatus,
      timestamp: new Date().toISOString()
    };
    
    logSecurityEvent(req.user?.username, 'VIEW_PORTAL_STATS', 'Portal stats retrieved');
    res.json(stats);
  } catch (error) {
    console.error('Error getting portal stats:', error);
    res.status(500).json({ error: 'Failed to retrieve portal statistics' });
  }
};

// /**
//  * Toggle service availability (emergency control)
//  */
// export const toggleService = async (req, res) => {
//   try {
//     const { service, enabled, message } = req.body;
//     const username = req.user?.username || 'unknown';
    
//     if (!['vpn', 'portal'].includes(service)) {
//       return res.status(400).json({ error: 'Invalid service name' });
//     }
    
//     serviceStatus[service] = {
//       enabled: Boolean(enabled),
//       message: message || '',
//       lastUpdatedBy: username,
//       lastUpdated: new Date().toISOString()
//     };
    
//     const action = enabled ? 'ENABLE_SERVICE' : 'DISABLE_SERVICE';
//     logSecurityEvent(username, action, `${service} service ${enabled ? 'enabled' : 'disabled'}`);
    
//     res.json({
//       message: `${service} service ${enabled ? 'enabled' : 'disabled'} successfully`,
//       status: serviceStatus[service]
//     });
//   } catch (error) {
//     console.error('Error toggling service:', error);
//     res.status(500).json({ error: 'Failed to toggle service' });
//   }
// };

// /**
//  * Reset user VPN connections (emergency function)
//  */
// export const resetUserVPN = async (req, res) => {
//   try {
//     const { username: targetUser } = req.body;
//     const adminUser = req.user?.username || 'unknown';
    
//     if (!targetUser) {
//       return res.status(400).json({ error: 'Username required' });
//     }
    
//     // In a real implementation, this would delete user's VPN connections
//     // For now, we'll just log the action
    
//     logSecurityEvent(adminUser, 'RESET_USER_VPN', `VPN connections reset for user: ${targetUser}`);
    
//     res.json({
//       message: `VPN connections reset successfully for user: ${targetUser}`,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error resetting user VPN:', error);
//     res.status(500).json({ error: 'Failed to reset user VPN connections' });
//   }
// };

/**
 * Get detailed WireGuard peer information from OPNsense
 */
export const getWireGuardPeers = async (req, res) => {
  try {
    const peers = await opnsenseRequest('wireguard/service/show');
    
    if (!peers) {
      return res.status(503).json({ 
        error: 'Cannot connect to OPNsense API',
        fallback: true
      });
    }

    const peerList = peers.peers ? Object.entries(peers.peers).map(([key, peer]) => ({
      id: key,
      publicKey: peer.public_key,
      endpoint: peer.endpoint || 'N/A',
      allowedIPs: peer.allowed_ips || 'N/A',
      latestHandshake: peer.latest_handshake || 'Never',
      transferRx: peer.transfer_rx || '0',
      transferTx: peer.transfer_tx || '0',
      persistentKeepalive: peer.persistent_keepalive || 'N/A'
    })) : [];

    logSecurityEvent(req.user?.username, 'VIEW_WIREGUARD_PEERS', 'WireGuard peer information retrieved');
    
    res.json({
      success: true,
      peers: peerList,
      totalPeers: peerList.length,
      serverInfo: {
        interface: peers.interface || 'N/A',
        listenPort: peers.listen_port || 'N/A',
        publicKey: peers.public_key || 'N/A'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting WireGuard peers:', error);
    res.status(500).json({ error: 'Failed to retrieve WireGuard peer information' });
  }
};


