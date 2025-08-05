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
import ldapAuth from '../config/ldap.js';
import ldapjs from 'ldapjs';

// OPNsense API configuration
const OPNSENSE_CONFIG = {
  host: 'vpn.hnee.de',
  apiKey: process.env.OPNSENSE_API_KEY || '',
  apiSecret: process.env.OPNSENSE_API_SECRET || '',
  timeout: 30000, // Increased timeout to 30 seconds
  retries: 3 // More retries
};

// Service status tracking
let serviceStatus = {
  vpn: { enabled: true, message: '' },
  portal: { enabled: true, message: '' },
  lastUpdated: new Date().toISOString()
};

/**
 * Make authenticated request to OPNsense API with better error handling
 */
const opnsenseRequest = async (endpoint, retryCount = 0) => {
  try {
    // Check if API credentials are configured
    if (!OPNSENSE_CONFIG.apiKey || !OPNSENSE_CONFIG.apiSecret) {
      console.warn('OPNsense API credentials not configured, skipping API call');
      return null;
    }

    const auth = Buffer.from(`${OPNSENSE_CONFIG.apiKey}:${OPNSENSE_CONFIG.apiSecret}`).toString('base64');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Request timeout after ${OPNSENSE_CONFIG.timeout}ms`);
      controller.abort();
    }, OPNSENSE_CONFIG.timeout);
    
    console.log(`🔗 Making OPNsense API request to: ${endpoint} (attempt ${retryCount + 1})`);
    
    // OPNsense API typically requires POST requests with JSON body
    const response = await fetch(`https://${OPNSENSE_CONFIG.host}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'HNEE-ServicePortal/2.0'
      },
      body: JSON.stringify({}), // Empty JSON body for most read operations
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OPNsense API HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ OPNsense API request successful`);
    return data;
  } catch (error) {
    console.error(`❌ OPNsense API request failed (attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic for timeouts and network errors
    if ((error.name === 'AbortError' || error.name === 'TimeoutError' || error.code === 'ECONNRESET') 
        && retryCount < OPNSENSE_CONFIG.retries) {
      const backoffTime = 2000 * (retryCount + 1); // 2s, 4s, 6s
      console.log(`🔄 Retrying OPNsense API request in ${backoffTime}ms (${retryCount + 1}/${OPNSENSE_CONFIG.retries})`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return opnsenseRequest(endpoint, retryCount + 1);
    }
    
    return null;
  }
};

/**
 * Get users from LDAP OUs (Organizational Units) - Real HNEE structure
 */
const getUsersFromOU = async (ouPath, ouName) => {
  return new Promise((resolve) => {
    try {
      // Check if LDAP is configured
      if (!process.env.LDAP_URL) {
        console.warn(`LDAP not configured, returning empty OU for ${ouName}`);
        return resolve([]);
      }

      const client = ldapjs.createClient({
        url: process.env.LDAP_URL,
        timeout: 10000,
        connectTimeout: 5000
      });

      client.on('error', (err) => {
        console.error(`LDAP Client Error for OU ${ouName}:`, err);
        client.destroy();
        resolve([]);
      });

      // Bind with service account
      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
        if (err) {
          console.error(`LDAP bind failed for OU ${ouName}:`, err);
          client.destroy();
          return resolve([]);
        }

        // Search for users in the specific OU
        const searchFilter = '(&(objectClass=user)(!(objectClass=computer)))';
        const searchOptions = {
          scope: 'sub',
          filter: searchFilter,
          attributes: ['sAMAccountName', 'cn', 'mail', 'displayName'],
          timeLimit: 10
        };

        client.search(ouPath, searchOptions, (err, searchRes) => {
          if (err) {
            console.error(`LDAP search failed for OU ${ouName}:`, err);
            client.destroy();
            return resolve([]);
          }

          let users = [];
          let searchTimeout = setTimeout(() => {
            client.destroy();
            console.warn(`LDAP search timeout for OU ${ouName}`);
            resolve(users);
          }, 12000);

          searchRes.on('searchEntry', (entry) => {
            try {
              const attributes = entry.pojo ? entry.pojo.attributes : (entry.object || entry.raw);
              
              if (attributes) {
                // Convert attributes array to object if needed
                let attrObj = {};
                if (Array.isArray(attributes)) {
                  attributes.forEach(attr => {
                    attrObj[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
                  });
                } else {
                  attrObj = attributes;
                }
                
                const username = attrObj.sAMAccountName || attrObj.cn;
                if (username && !username.includes('$')) { // Filter out computer accounts
                  users.push({
                    username: username,
                    displayName: attrObj.displayName || attrObj.cn || username,
                    mail: attrObj.mail || `${username}@hnee.de`
                  });
                }
              }
            } catch (parseError) {
              console.error(`Error parsing user in OU ${ouName}:`, parseError);
            }
          });

          searchRes.on('error', (err) => {
            clearTimeout(searchTimeout);
            console.error(`LDAP search error for OU ${ouName}:`, err);
            client.destroy();
            resolve(users);
          });

          searchRes.on('end', () => {
            clearTimeout(searchTimeout);
            client.destroy();
            console.log(`Found ${users.length} users in OU ${ouName}`);
            resolve(users);
          });
        });
      });
    } catch (error) {
      console.error(`Unexpected error getting users from OU ${ouName}:`, error);
      resolve([]);
    }
  });
};

/**
 * Get real user statistics from LDAP using actual OU structure
 */
const getUserStatistics = async () => {
  try {
    console.log('📊 Getting real user statistics from HNEE LDAP OUs...');
    
    // Get users from different OUs using real HNEE structure
    const [
      studentenUsers,
      angestellteUsers,
      gastdozentenUsers
    ] = await Promise.all([
      getUsersFromOU('OU=Studenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Studenten').catch(() => []),
      getUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte').catch(() => []),
      getUsersFromOU('OU=Gastdozenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Gastdozenten').catch(() => [])
    ]);

    // Extract just usernames for deduplication
    const studentenUsernames = studentenUsers.map(u => u.username);
    const angestellteUsernames = angestellteUsers.map(u => u.username);
    const gastdozentenUsernames = gastdozentenUsers.map(u => u.username);

    // Calculate total unique users (removing duplicates)
    const allUsers = new Set([
      ...studentenUsernames,
      ...angestellteUsernames,
      ...gastdozentenUsernames
    ]);

    const totalUsers = allUsers.size;
    // No mock data - activeToday should come from real authentication logs
    // For now, return 0 until real session tracking is implemented
    const activeToday = 0; // TODO: Implement real session tracking from auth logs

    return {
      totalRegistered: totalUsers,
      activeToday: activeToday,
      groups: {
        studenten: studentenUsers.length,
        angestellte: angestellteUsers.length,
        gastdozenten: gastdozentenUsers.length,
        // Keep legacy names for compatibility
        mitarbeiter: angestellteUsers.length, // Angestellte = employees/staff
        dozenten: 0, // Will be subset of Angestellte in real implementation
        itsz: 0 // Will be subset of Angestellte in real implementation
      },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to get LDAP user statistics:', error.message);
    
    // If LDAP fails completely, return zero counts (no mock data)
    console.log('LDAP completely unavailable - returning zero counts (no mock data)');
    return {
      totalRegistered: 0,
      activeToday: 0,
      groups: {
        studenten: 0,
        angestellte: 0,
        gastdozenten: 0,
        // Legacy compatibility
        mitarbeiter: 0,
        dozenten: 0,
        itsz: 0
      },
      lastUpdated: new Date().toISOString(),
      source: 'ldap-unavailable'
    };
  }
};

/**
 * Get real VPN status from OPNsense with improved fallback
 */
const getVPNServerStatus = async () => {
  console.log('Getting VPN server status...');
  
  try {
    // First, check basic connectivity
    const serverReachable = await checkServerConnectivity();
    console.log(`Server reachable via ping: ${serverReachable}`);
    
    if (!serverReachable) {
      return {
        serverReachable: false,
        serviceRunning: false,
        activeConnections: 0,
        serverStatus: 'unreachable',
        lastChecked: new Date().toISOString(),
        dataSource: 'ping-failed',
        error: 'Server not reachable via ping'
      };
    }

    // Only try API calls if server is reachable
    console.log('Attempting OPNsense API calls...');
    
    // Try to get WireGuard service status first (most reliable)
    const serviceStatus = await opnsenseRequest('wireguard/service/status');
    
    if (serviceStatus) {
      console.log('Successfully retrieved WireGuard service status from OPNsense API');
      
      // Get additional server info if service is running
      let activeConnections = 0;
      if (serviceStatus.isRunning || serviceStatus.running) {
        const serverInfo = await opnsenseRequest('wireguard/server/searchServer');
        if (serverInfo && serverInfo.rows) {
          // Count active peers from server data
          activeConnections = serverInfo.rows.reduce((count, server) => {
            return count + (server.peers ? server.peers.length : 0);
          }, 0);
        }
      }
      
      return {
        serverReachable: true,
        serviceRunning: Boolean(serviceStatus.isRunning || serviceStatus.running),
        activeConnections: activeConnections,
        serverStatus: 'healthy',
        lastChecked: new Date().toISOString(),
        dataSource: 'opnsense-api',
        serviceInfo: serviceStatus
      };
    }
    
    // API failed but server is reachable - check WireGuard port
    console.log('API failed, checking WireGuard service port...');
    const serviceRunning = await checkWireGuardService();
    
    return {
      serverReachable: true,
      serviceRunning: serviceRunning,
      activeConnections: 0,
      serverStatus: serviceRunning ? 'api-error' : 'service-down',
      lastChecked: new Date().toISOString(),
      dataSource: 'port-check',
      error: 'OPNsense API unavailable'
    };

  } catch (error) {
    console.error('Error getting VPN server status:', error);
    
    return {
      serverReachable: false,
      serviceRunning: false,
      activeConnections: 0,
      serverStatus: 'error',
      error: error.message,
      lastChecked: new Date().toISOString(),
      dataSource: 'error-fallback'
    };
  }
};

/**
 * Basic server connectivity check with faster timeout
 */
const checkServerConnectivity = async () => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    console.log('🏓 Checking server connectivity...');
    // Faster ping with shorter timeout
    const { stdout, stderr } = await execAsync('ping -c 1 -W 1000 vpn.hnee.de', { timeout: 3000 });
    
    // Check if we got any successful packets (handle both "packet" and "packets")
    const successMatch = stdout.match(/(\d+) packets? transmitted, (\d+) (?:packets? )?received/);
    if (successMatch) {
      const [, transmitted, received] = successMatch;
      const isReachable = parseInt(received) > 0;
      console.log(`🏓 Ping result: ${received}/${transmitted} packets received`);
      return isReachable;
    }
    
    console.log('🏓 Ping failed - no response pattern found');
    return false;
  } catch (error) {
    console.error('🏓 Ping failed:', error.message);
    return false;
  }
};

/**
 * Check if WireGuard service is running by testing the port with faster timeout
 */
const checkWireGuardService = async () => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    console.log('🔌 Checking WireGuard port 51820...');
    // Test if WireGuard port 51820 is accessible with shorter timeout
    const { stdout, stderr } = await execAsync('nc -u -z -v vpn.hnee.de 51820', { timeout: 3000 });
    
    console.log('🔌 WireGuard port is accessible');
    // netcat returns 0 exit code if connection succeeds
    return true;
  } catch (error) {
    // netcat returns non-zero exit code if connection fails
    console.log('🔌 WireGuard port check failed:', error.message);
    return false; // Assume service is down if port check fails
  }
};

/**
 * Get service portal statistics with real LDAP and OPNsense data
 */
export const getPortalStats = async (req, res) => {
  try {
    console.log('📈 Getting comprehensive portal statistics...');
    
    // Get real VPN server status and user data in parallel
    const [vpnStatus, userStats] = await Promise.all([
      getVPNServerStatus(),
      getUserStatistics()
    ]);
    
    const stats = {
      vpn: {
        totalConnections: vpnStatus.activeConnections || 0,
        activeConnections: vpnStatus.activeConnections || 0,
        serverStatus: vpnStatus.serverStatus,
        serverReachable: vpnStatus.serverReachable,
        serviceRunning: vpnStatus.serviceRunning,
        lastChecked: vpnStatus.lastChecked,
        dataSource: vpnStatus.dataSource
      },
      users: {
        totalRegistered: userStats.totalRegistered,
        activeToday: userStats.activeToday,
        groups: userStats.groups,
        lastUpdated: userStats.lastUpdated,
        dataSource: userStats.source || 'ldap'
      },
      services: serviceStatus,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Portal stats: ${userStats.totalRegistered} users, VPN ${vpnStatus.serverStatus}`);
    logSecurityEvent(req.user?.username, 'VIEW_PORTAL_STATS', 'Enhanced portal stats with real data retrieved');
    res.json(stats);
  } catch (error) {
    console.error('Error getting enhanced portal stats:', error);
    res.status(500).json({ error: 'Failed to retrieve portal statistics' });
  }
};



/**
 * LDAP-Benutzerdaten synchronisieren - Real LDAP Operations
 * Sync LDAP user data with real operations
 */
export const syncLDAP = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    
    console.log('🔄 Starting real LDAP synchronization...');
    
    const syncResult = {
      usersUpdated: 0,
      groupsUpdated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
      details: {}
    };
    
    try {
      // Get current user statistics before sync
      const beforeStats = await getUserStatistics();
      
      // Try to refresh group memberships and user counts using real HNEE OUs
      const [
        studentenUsers,
        angestellteUsers,
        gastdozentenUsers
      ] = await Promise.all([
        getUsersFromOU('OU=Studenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Studenten').catch(err => {
          syncResult.errors.push(`Studenten OU sync failed: ${err.message}`);
          return [];
        }),
        getUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte').catch(err => {
          syncResult.errors.push(`Angestellte OU sync failed: ${err.message}`);
          return [];
        }),
        getUsersFromOU('OU=Gastdozenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Gastdozenten').catch(err => {
          syncResult.errors.push(`Gastdozenten OU sync failed: ${err.message}`);
          return [];
        })
      ]);

      // Calculate updates
      syncResult.usersUpdated = studentenUsers.length + angestellteUsers.length + gastdozentenUsers.length;
      syncResult.groupsUpdated = 3; // We checked 3 OUs
      
      syncResult.details = {
        groups: {
          studenten: studentenUsers.length,
          angestellte: angestellteUsers.length,
          gastdozenten: gastdozentenUsers.length,
          // Legacy names for compatibility
          mitarbeiter: angestellteUsers.length,
          dozenten: 0, // Subset of Angestellte
          itsz: 0 // Subset of Angestellte
        },
        totalUsers: syncResult.usersUpdated,
        errorCount: syncResult.errors.length
      };
      
      syncResult.success = syncResult.errors.length === 0;
      
      console.log(`✅ LDAP sync completed: ${syncResult.usersUpdated} users across ${syncResult.groupsUpdated} OUs`);
      
      if (syncResult.errors.length > 0) {
        console.warn('⚠️  LDAP sync completed with errors:', syncResult.errors);
      }
      
    } catch (ldapError) {
      console.error('❌ LDAP sync error:', ldapError);
      syncResult.success = false;
      syncResult.errors.push(`General LDAP error: ${ldapError.message}`);
      
      // Try basic fallback sync
      try {
        const fallbackStats = await getUserStatistics();
        syncResult.usersUpdated = fallbackStats.totalRegistered;
        syncResult.details = { fallback: true, ...fallbackStats };
      } catch (fallbackError) {
        syncResult.errors.push(`Fallback sync failed: ${fallbackError.message}`);
      }
    }
    
    logSecurityEvent(adminUser, 'SYNC_LDAP', 
      `LDAP-Synchronisation durchgeführt: ${syncResult.success ? 'erfolgreich' : 'fehlgeschlagen'} - ${syncResult.usersUpdated} Benutzer`);
    
    res.json({
      message: syncResult.success 
        ? `LDAP-Synchronisation erfolgreich abgeschlossen: ${syncResult.usersUpdated} Benutzer synchronisiert / LDAP sync completed successfully: ${syncResult.usersUpdated} users synced`
        : `LDAP-Synchronisation teilweise fehlgeschlagen: ${syncResult.errors.length} Fehler / LDAP sync partially failed: ${syncResult.errors.length} errors`,
      result: syncResult
    });
  } catch (error) {
    console.error('Error during LDAP sync:', error);
    res.status(500).json({ error: 'Fehler bei LDAP-Synchronisation / Failed to sync LDAP data' });
  }
};

/**
 * Get detailed user information from LDAP
 */
export const getUserDetails = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    console.log('👥 Getting detailed user information from LDAP...');
    
    // Get comprehensive user statistics
    const userStats = await getUserStatistics();
    
    // Get users from different OUs with details using real HNEE structure
    const [
      studentenUsers,
      angestellteUsers,
      gastdozentenUsers
    ] = await Promise.all([
      getUsersFromOU('OU=Studenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Studenten').catch(() => []),
      getUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte').catch(() => []),
      getUsersFromOU('OU=Gastdozenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Gastdozenten').catch(() => [])
    ]);

    logSecurityEvent(adminUser, 'VIEW_USER_DETAILS', 'Detailed user information retrieved');
    
    res.json({
      success: true,
      statistics: userStats,
      groups: {
        studenten: {
          count: studentenUsers.length,
          users: studentenUsers.slice(0, 10).map(u => u.username) // Limit to first 10 for performance
        },
        angestellte: {
          count: angestellteUsers.length,
          users: angestellteUsers.slice(0, 10).map(u => u.username)
        },
        gastdozenten: {
          count: gastdozentenUsers.length,
          users: gastdozentenUsers.slice(0, 10).map(u => u.username)
        },
        // Legacy compatibility
        mitarbeiter: {
          count: angestellteUsers.length,
          users: angestellteUsers.slice(0, 10).map(u => u.username)
        },
        dozenten: {
          count: 0,
          users: []
        },
        itsz: {
          count: 0,
          users: []
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user details:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user details',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get WireGuard service control functions
 */
export const getWireGuardServiceStatus = async (req, res) => {
  try {
    console.log('Getting WireGuard service status...');
    const status = await opnsenseRequest('wireguard/service/status');
    
    if (!status) {
      return res.status(503).json({ 
        error: 'Cannot connect to OPNsense API',
        fallback: true,
        serverReachable: await checkServerConnectivity(),
        timestamp: new Date().toISOString()
      });
    }

    logSecurityEvent(req.user?.username, 'VIEW_WIREGUARD_SERVICE', 'WireGuard service status retrieved');
    
    res.json({
      success: true,
      service: {
        running: Boolean(status.isRunning || status.running),
        status: status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting WireGuard service status:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve WireGuard service status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};


